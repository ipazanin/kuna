import { keepSession } from './bankSecrets'
import type { BankSecretStore, BankUsage } from './bankSecrets'
import { readBanks } from './bankRead'
import type { BankRead, OlderRowsMissing } from './bankRead'
import type { AccountProposal, LinkedOfBank } from '../domain/bankAccountSetup'
import type { BankApplication, BankBalance, BankFields, BankSession, BankTransaction } from '../domain/bankAnswer'
import { balanceDifferences } from '../domain/bankBalance'
import type { BalanceDifference, StatedBalance } from '../domain/bankBalance'
import { heldBanks } from '../domain/bankLinks'
import type { PendingLink } from '../domain/bankReturn'
import { words } from '../domain/words'
import { writeDryRun } from '../../statements/application/statementWrites'
import { rowsAfterDryRun, statementDryRun } from '../../statements/domain/statementDryRun'
import type { StatementDryRun } from '../../statements/domain/statementDryRun'
import type { RuleLinks } from '../../links/domain/linkFiling'
import { SETTING_WRITES } from '../../workbook/application/settingWrites'
import { setSetting } from '../../../../shared/storage/application/settingWrites'
import type { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { BANK_SYNC_APPLICATION_KEY, LINKABLE_BANKS, bankFetchedKey, bankLinkKey } from '../../workbook/domain/spendingSettings'
import type { LinkableBank } from '../../workbook/domain/spendingSettings'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { WriteReceipt } from '../../../../shared/storage/application/recordWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** A bank's new session, which this browser keeps as a secret, and until when it lasts. */
export interface BankLinkMade {
  readonly sessionId: string
  readonly validUntil: string
}

/** What Spending asks of the bank sync script, each call signed in the page with the person's own key. */
export interface BankSyncPort {
  /** The application the key belongs to, which also proves the key signs. */
  application(): Promise<BankApplication>
  /** Starts a bank's approval and says where to send the tab. */
  startLink(bankName: string, redirectUrl: string, state: string): Promise<string>
  /** Trades the code a bank came back with for a session. */
  finishLink(code: string): Promise<BankLinkMade>
  /** Ends a session at Enable Banking. One the bank already ended is no failure. */
  closeSession(sessionId: string): Promise<void>
  /** Each kept session with the accounts it reaches. */
  sessions(): Promise<readonly BankSession[]>
  /** Every page of an account's transactions from the day. `longest` asks for what the bank has from there, where a plain fetch asks for exactly that period and a bank may refuse it. */
  transactions(accountUid: string, from: CivilDate, longest: boolean): Promise<readonly BankTransaction[]>
  balances(accountUid: string): Promise<readonly BankBalance[]>
  /** The names and counts of what each kept session's bank sends, never a value. */
  bankFields(): Promise<readonly BankFields[]>
}

/** The script ran and threw, as opposed to the call never reaching it. */
export class BankScriptFailure extends Error {
  override readonly name = 'BankScriptFailure'
}

function forgetBankLinks(unit: UnitOfWork, book: Pick<SpendingBook, 'readings'>): void {
  const facts = book.readings.settings.facts
  LINKABLE_BANKS.forEach((bank) => {
    setSetting(unit, SETTING_WRITES, facts, bankLinkKey(bank), '')
    setSetting(unit, SETTING_WRITES, facts, bankFetchedKey(bank), '')
  })
}

/**
 * The Enable Banking application the book's bank sync uses, which every device reads to fetch its key. Another application
 * than the one before also clears each bank's link end and last fetch, since a session belongs to the application that opened it.
 */
export function saveApplicationId(unit: UnitOfWork, book: Pick<SpendingBook, 'readings' | 'settings'>, applicationId: string): void {
  const id = applicationId.trim()
  const before = book.settings.bankSyncApplication
  setSetting(unit, SETTING_WRITES, book.readings.settings.facts, BANK_SYNC_APPLICATION_KEY, id)
  if (before !== '' && before !== id) forgetBankLinks(unit, book)
}

/** Turns the bank sync off: no application, and no bank's link end or last fetch. */
export function forgetBankSync(unit: UnitOfWork, book: Pick<SpendingBook, 'readings'>): void {
  setSetting(unit, SETTING_WRITES, book.readings.settings.facts, BANK_SYNC_APPLICATION_KEY, '')
  forgetBankLinks(unit, book)
}

/** When a bank last answered, which every device sharing the file reads to leave it alone for six hours. */
function saveFetched(unit: UnitOfWork, book: Pick<SpendingBook, 'readings'>, bank: LinkableBank, at: number): void {
  setSetting(unit, SETTING_WRITES, book.readings.settings.facts, bankFetchedKey(bank), new Date(at).toISOString())
}

/** The day a bank's approval runs out. */
export function saveLink(unit: UnitOfWork, book: Pick<SpendingBook, 'readings'>, bank: LinkableBank, validUntil: string): void {
  setSetting(unit, SETTING_WRITES, book.readings.settings.facts, bankLinkKey(bank), validUntil.slice(0, 10))
}

type SpendingStore = Pick<ReturnType<typeof useSpendingBooks>, 'state' | 'write' | 'settled'>

/** What one fetch did, and what it left for the setup list. */
export interface BankSyncOutcome {
  readonly dryRun: StatementDryRun
  readonly problems: readonly string[]
  readonly linked: readonly LinkedOfBank[]
  /** The drafts with their rows, held only while the page is open. */
  readonly proposals: readonly AccountProposal[]
  readonly differences: readonly BalanceDifference[]
  /** What the banks say the accounts they answered for hold. */
  readonly stated: readonly StatedBalance[]
  readonly olderRows: readonly OlderRowsMissing[]
  /** The write it made, which Undo puts back, or null when nothing was new. */
  readonly receipt: WriteReceipt | null
}

/** What the set-up list of bank accounts works from. */
export type BankSetup = Pick<BankSyncOutcome, 'linked' | 'proposals' | 'differences' | 'stated' | 'olderRows'>

export interface BankImportPorts {
  /** The script, told when a person started the fetch, which lifts the banks' limit on unattended reads. */
  script(applicationId: string, personHere: boolean): Promise<BankSyncPort>
  readonly store: SpendingStore
  /** The banks answered, with what this device keeps to repeat while the step holds back. A call that never reached them keeps nothing. */
  asked(read: BankRead): void
  day(): CivilDate
  /** The records in Loans the sync links a new row to, as a rule whose rows pay a loan says, or null where nothing links. */
  links(): RuleLinks | null
  /** Epoch milliseconds. */
  now(): number
}

export interface BankImporter {
  /**
   * Asks the banks and imports what is new in one write, so one Undo takes it all back, with the time each bank answered.
   * A second call while one runs gets the same fetch, since each uses up one of a bank's few fetches a day. Without a person
   * there it leaves alone each bank any device asked within six hours. `freshLink` is the bank linked just before it.
   */
  run(personHere: boolean, freshLink?: LinkableBank): Promise<BankSyncOutcome>
}

function openBook(store: SpendingStore): NonNullable<SpendingStore['state']['workbook']> {
  const book = store.state.workbook
  if (book === null) throw new Error(words.noFile)
  return book
}

export function bankImporter(ports: BankImportPorts): BankImporter {
  const { store } = ports
  let running: Promise<BankSyncOutcome> | null = null

  async function fetchOnce(personHere: boolean, freshLink: LinkableBank | undefined): Promise<BankSyncOutcome> {
    const day = ports.day()
    const asking = openBook(store)
    const held = personHere ? [] : heldBanks(asking.settings, ports.now())
    const read = await readBanks(await ports.script(asking.settings.bankSyncApplication, personHere), asking, day, freshLink === undefined ? [] : [freshLink], undefined, held)
    const answeredAt = ports.now()
    ports.asked(read)
    await store.settled()
    const stillLive = read.ended.filter((bank) => (openBook(store).settings.bankLinks[bank] ?? '') >= day)
    if (stillLive.length > 0) {
      // Yesterday, so the home card and Settings say it ended and the step stops asking for it. The bank gives no day of its own.
      const book = openBook(store)
      await store.write(words.linkEndedTitle, (unit) => stillLive.forEach((bank) => saveLink(unit, book, bank, addDays(day, -1))))
      await store.settled()
    }
    // The file as it stands now, not as it stood before the banks answered, which can take minutes and a file dropped meanwhile.
    const book = openBook(store)
    const dryRun = statementDryRun(book, read.statement, day, ports.links())
    const differences = balanceDifferences(read.stated, rowsAfterDryRun(book.transactions, dryRun), day)
    const changes = dryRun.added.length + dryRun.changed.length + (dryRun.pending?.gone.length ?? 0)
    const stamp = (unit: UnitOfWork): void => read.fetched.forEach((bank) => saveFetched(unit, book, bank, answeredAt))
    const receipt =
      changes === 0
        ? null
        : await store.write(words.imported, (unit) => {
            writeDryRun(unit, book.stored, dryRun)
            stamp(unit)
          })
    if (changes === 0 && read.fetched.length > 0) await store.write(words.fetched, stamp)
    const { linked, proposals, problems, olderRows } = read
    return { dryRun, problems, linked, proposals, differences, stated: read.stated, olderRows, receipt }
  }

  return {
    run(personHere, freshLink) {
      running ??= fetchOnce(personHere, freshLink).finally(() => {
        running = null
      })
      return running
    },
  }
}

export interface PendingLinks {
  load(): PendingLink | null
  save(pending: PendingLink | null): void
}

export interface BankLinkPorts {
  readonly script: BankSyncPort
  readonly pending: PendingLinks
  readonly store: SpendingStore
  readonly secrets: BankSecretStore
  readonly usage: BankUsage
}

/**
 * Trades the code a bank came back with, keeps the session as a secret and writes down the day the link ends. The session
 * it replaces is closed, since nothing could reach it afterwards. A code works once, so the session is kept at once and
 * the day until the write lands, and a retry only writes. A code the script refuses is forgotten, since it will never work.
 */
export async function finishBankLink({ script, pending, store, secrets, usage }: BankLinkPorts): Promise<void> {
  const held = pending.load()
  if (held === null || held.code === null) return
  let validUntil = held.validUntil
  if (validUntil === null) {
    let made: BankLinkMade
    try {
      made = await script.finishLink(held.code)
    } catch (failure) {
      if (failure instanceof BankScriptFailure) pending.save(null)
      throw failure
    }
    const replaced = keepSession(secrets, usage, held.bank, made.sessionId)
    validUntil = made.validUntil
    pending.save({ ...held, validUntil })
    // The old session is no longer kept anywhere, so failing to close it leaves nothing to undo and the link stands.
    if (replaced !== null) await script.closeSession(replaced).catch(() => undefined)
  }
  const book = openBook(store)
  const until = validUntil
  await store.write(words.linked, (unit) => saveLink(unit, book, held.bank, until))
  pending.save(null)
}
