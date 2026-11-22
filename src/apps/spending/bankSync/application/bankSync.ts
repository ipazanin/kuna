import { endLinks, forgetBankLinks, saveFetched, saveLink } from './bankLinkWrites'
import { readBanks } from './bankRead'
import type { BankRead, OlderRowsMissing } from './bankRead'
import type { AccountProposal, LinkedOfBank } from '../domain/bankAccountSetup'
import { balanceDifferences } from '../domain/bankBalance'
import type { BalanceDifference, StatedBalance } from '../domain/bankBalance'
import { words } from '../domain/words'
import { writeDryRun } from '../../statements/application/statementWrites'
import { rowsAfterDryRun, statementDryRun } from '../../statements/domain/statementDryRun'
import type { StatementDryRun } from '../../statements/domain/statementDryRun'
import type { RuleLinks } from '../../links/domain/linkFiling'
import { SETTING_WRITES } from '../../workbook/application/settingWrites'
import { setSetting } from '../../../../shared/storage/application/settingWrites'
import type { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { BANK_SYNC_APPLICATION_KEY } from '../../workbook/domain/spendingSettings'
import type { BankSyncPort } from '../../../../shared/bank-sync/application/bankSyncPort'
import { sameLink } from '../../../../shared/bank-sync/domain/bankLink'
import type { LinkName } from '../../../../shared/bank-sync/domain/bankLink'
import { heldLinks, liveLinks } from '../../../../shared/bank-sync/domain/bankLinkDays'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { WriteReceipt } from '../../../../shared/storage/application/recordWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/**
 * The Enable Banking application the book's bank sync uses, which every device reads to fetch its key. Another application
 * than the one before also clears each bank's link end and last fetch, since a session belongs to the application that opened it.
 */
export function saveApplicationId(unit: UnitOfWork, book: Pick<SpendingBook, 'readings' | 'settings' | 'bankLinks'>, applicationId: string): void {
  const id = applicationId.trim()
  const before = book.settings.bankSyncApplication
  setSetting(unit, SETTING_WRITES, book.readings.settings.facts, BANK_SYNC_APPLICATION_KEY, id)
  if (before !== '' && before !== id) forgetBankLinks(unit, book)
}

/** Turns the bank sync off: no application, and no bank's link end or last fetch. */
export function forgetBankSync(unit: UnitOfWork, book: Pick<SpendingBook, 'readings' | 'bankLinks'>): void {
  setSetting(unit, SETTING_WRITES, book.readings.settings.facts, BANK_SYNC_APPLICATION_KEY, '')
  forgetBankLinks(unit, book)
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
   * there it leaves alone each bank any device asked within six hours. `freshLink` is the link made just before it.
   */
  run(personHere: boolean, freshLink?: LinkName): Promise<BankSyncOutcome>
}

function openBook(store: SpendingStore): NonNullable<SpendingStore['state']['workbook']> {
  const book = store.state.workbook
  if (book === null) throw new Error(words.noFile)
  return book
}

export function bankImporter(ports: BankImportPorts): BankImporter {
  const { store } = ports
  let running: Promise<BankSyncOutcome> | null = null

  async function fetchOnce(personHere: boolean, freshLink: LinkName | undefined): Promise<BankSyncOutcome> {
    const day = ports.day()
    const asking = openBook(store)
    const held = personHere ? [] : heldLinks(asking.bankLinks, ports.now())
    const read = await readBanks(await ports.script(asking.settings.bankSyncApplication, personHere), asking, day, freshLink === undefined ? [] : [freshLink], undefined, held)
    const answeredAt = ports.now()
    ports.asked(read)
    await store.settled()
    const stillLive = read.ended.filter((ended) => liveLinks(openBook(store).bankLinks, day).some((link) => sameLink(link, ended)))
    if (stillLive.length > 0) {
      // Yesterday, so the home card and Settings say it ended and the step stops asking for it. The bank gives no day of its own.
      const book = openBook(store)
      await store.write(words.linkEndedTitle, (unit) => endLinks(unit, book, stillLive, addDays(day, -1)))
      await store.settled()
    }
    // The file as it stands now, not as it stood before the banks answered, which can take minutes and a file dropped meanwhile.
    const book = openBook(store)
    const dryRun = statementDryRun(book, read.statement, day, ports.links())
    const differences = balanceDifferences(read.stated, rowsAfterDryRun(book.transactions, dryRun), day)
    const changes = dryRun.added.length + dryRun.changed.length + (dryRun.pending?.gone.length ?? 0)
    const stamp = (unit: UnitOfWork): void => saveFetched(unit, book, read.fetched, answeredAt)
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

/** Writes down in the Spending file the link a bank came back with, and the day Enable Banking says it ends. */
export function writeBankLink(store: SpendingStore, link: LinkName, validUntil: string): Promise<unknown> {
  const book = openBook(store)
  return store.write(words.linked, (unit) => saveLink(unit, book, link, validUntil))
}
