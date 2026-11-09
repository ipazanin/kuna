import { readBanks } from './bankRead'
import type { BankRead, OlderRowsMissing } from './bankRead'
import type { AccountProposal, LinkedOfBank } from '../domain/bankAccountSetup'
import type { BankBalance, BankSession, BankTransaction } from '../domain/bankAnswer'
import { balanceDifferences } from '../domain/bankBalance'
import type { BalanceDifference } from '../domain/bankBalance'
import { heldBanks } from '../domain/bankLinks'
import type { PendingLink } from '../domain/bankReturn'
import { words } from '../domain/words'
import { writeDryRun } from '../../statements/application/statementWrites'
import { rowsAfterDryRun, statementDryRun } from '../../statements/domain/statementDryRun'
import type { StatementDryRun } from '../../statements/domain/statementDryRun'
import { SETTING_WRITES } from '../../workbook/application/settingWrites'
import { setSetting } from '../../../../shared/storage/application/settingWrites'
import type { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { BANK_SYNC_DEPLOYMENT_KEY, bankFetchedKey, bankLinkKey } from '../../workbook/domain/spendingSettings'
import type { LinkableBank } from '../../workbook/domain/spendingSettings'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { WriteReceipt } from '../../../../shared/storage/application/recordWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** What Spending asks of the bank sync script, in the script's five functions. */
export interface BankSyncPort {
  /** Starts a bank's approval and says where to send the tab. */
  startLink(bankName: string, redirectUrl: string, state: string): Promise<string>
  /** Trades the code a bank came back with for a session the script holds, and says until when it lasts. */
  finishLink(code: string): Promise<string>
  sessions(): Promise<readonly BankSession[]>
  /** Every page of an account's transactions from the day. `longest` asks for what the bank has from there, where a plain fetch asks for exactly that period and a bank may refuse it. */
  transactions(accountUid: string, from: CivilDate, longest: boolean): Promise<readonly BankTransaction[]>
  balances(accountUid: string): Promise<readonly BankBalance[]>
}

/** The script ran and threw, as opposed to the call never reaching it. */
export class BankScriptFailure extends Error {
  override readonly name = 'BankScriptFailure'
}

/** The script's deployment saved, or cleared by a blank one, which turns the sync off. */
export function saveDeployment(unit: UnitOfWork, book: Pick<SpendingBook, 'readings'>, deployment: string): void {
  setSetting(unit, SETTING_WRITES, book.readings.settings.facts, BANK_SYNC_DEPLOYMENT_KEY, deployment.trim())
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
  readonly olderRows: readonly OlderRowsMissing[]
  /** The write it made, which Undo puts back, or null when nothing was new. */
  readonly receipt: WriteReceipt | null
}

/** What the set-up list of bank accounts works from. */
export type BankSetup = Pick<BankSyncOutcome, 'linked' | 'proposals' | 'differences' | 'olderRows'>

export interface BankImportPorts {
  /** The script, told when a person started the fetch, which lifts the banks' limit on unattended reads. */
  script(deployment: string, personHere: boolean): Promise<BankSyncPort>
  readonly store: SpendingStore
  /** The banks answered, with what this device keeps to repeat while the step holds back. A call that never reached them keeps nothing. */
  asked(read: BankRead): void
  day(): CivilDate
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
    const read = await readBanks(await ports.script(asking.settings.bankSyncDeployment, personHere), asking, day, freshLink === undefined ? [] : [freshLink], undefined, held)
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
    const dryRun = statementDryRun(book, read.statement, day)
    const differences = balanceDifferences(read.stated, rowsAfterDryRun(book.transactions, dryRun), day)
    const changes = dryRun.added.length + dryRun.changed.length
    const stamp = (unit: UnitOfWork): void => read.fetched.forEach((bank) => saveFetched(unit, book, bank, answeredAt))
    const receipt =
      changes === 0
        ? null
        : await store.write(words.imported, (unit) => {
            writeDryRun(unit, dryRun)
            stamp(unit)
          })
    if (changes === 0 && read.fetched.length > 0) await store.write(words.fetched, stamp)
    const { linked, proposals, problems, olderRows } = read
    return { dryRun, problems, linked, proposals, differences, olderRows, receipt }
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
}

/**
 * Trades the code a bank came back with and writes down the day the link ends. A code works once, so what it was traded for
 * is kept until the write lands and a retry only writes. A code the script refuses is forgotten, since it will never work.
 */
export async function finishBankLink({ script, pending, store }: BankLinkPorts): Promise<void> {
  const held = pending.load()
  if (held === null || held.code === null) return
  let validUntil = held.validUntil
  if (validUntil === null) {
    try {
      validUntil = await script.finishLink(held.code)
    } catch (failure) {
      if (failure instanceof BankScriptFailure) pending.save(null)
      throw failure
    }
    pending.save({ ...held, validUntil })
  }
  const book = openBook(store)
  const until = validUntil
  await store.write(words.linked, (unit) => saveLink(unit, book, held.bank, until))
  pending.save(null)
}
