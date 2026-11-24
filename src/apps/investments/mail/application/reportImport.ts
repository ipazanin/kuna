import { writeLeftOut } from './mailReaderWrites'
import { unattendedWaits } from '../domain/unattendedImport'
import type { ImportWait } from '../domain/unattendedImport'
import { writeWorkbookImport } from '../../imports/application/workbookImport'
import { NO_CHOICES, settledImport } from '../../imports/domain/importChoices'
import type { WorkbookRows } from '../../imports/domain/importDryRun'
import { importableRecords } from '../../imports/domain/importedRecords'
import { ratesWanted } from '../../imports/domain/workbookRates'
import type { RatesWanted } from '../../prices/domain/priceDemand'
import { transactionCount } from '../../transactions/domain/listedTransactions'
import type { InvestmentsBooks } from '../../workbook/domain/investmentsBooks'
import type { MailReader } from '../../workbook/domain/mailReader'
import type { RateBook } from '../../../../shared/money/rateBook'
import { wasUndone } from '../../../../shared/storage/application/createWorkbookStore'
import type { SessionWrite, WorkbookStore } from '../../../../shared/storage/application/createWorkbookStore'
import type { WriteReceipt } from '../../../../shared/storage/application/recordWrites'
import { WorkbookWriteRefused } from '../../../../shared/storage/application/workbookWriteRefused'
import { newRecordId } from '../../../../shared/storage/domain/recordId'

export interface MailedImportPorts {
  readonly store: Pick<WorkbookStore<InvestmentsBooks>, 'state' | 'write'>
  readonly reading: WorkbookRows
  readonly reader: MailReader
  /** A file of the sync's mail does not fit the recipe. */
  readonly misfit: boolean
  /** The import keys of rows an earlier import of this page put in and Undo took back. */
  readonly undone: ReadonlySet<string>
  /** The ECB rates of the prices file as they are now, which a fetch adds to. */
  rates(): RateBook
  fetchRates(wanted: RatesWanted): Promise<unknown>
  /** The write's title, which its Undo names, by the records it adds. */
  title(records: number): string
}

/** What a sync did with a mailed report: imported it in one write, left it for the person and why, found nothing new, or was refused. */
export type MailedImport =
  | { readonly kind: 'imported'; readonly receipt: WriteReceipt; readonly records: number; readonly keys: readonly string[] }
  | { readonly kind: 'waits'; readonly waits: readonly ImportWait[] }
  | { readonly kind: 'nothing' }
  | { readonly kind: 'refused'; readonly reason: string }

/**
 * Imports a mailed report's new rows by itself when the review would ask nothing, through the write Accept makes with
 * no click: the records with the accounts' sources saved, in one unit of work, so one Undo takes it all back. The rates
 * the rows need are fetched once first. A report that would ask, or a write the rules refuse, writes nothing.
 */
export async function importMailedReport(ports: MailedImportPorts): Promise<MailedImport> {
  const { store, reading, reader } = ports
  const wanted = ratesWanted(reading.rows, ports.rates())
  if (wanted !== null) await ports.fetchRates(wanted).catch(() => null)
  const book = store.state.workbook?.book
  if (book === undefined) return { kind: 'nothing' }
  const rates = ports.rates()
  const ids = new Map<string, string>()
  const newIds = (key: string): string => {
    const id = ids.get(key) ?? newRecordId()
    ids.set(key, id)
    return id
  }
  // A split or a spin-off waits for the person, so no split or close is looked up to answer one.
  const settled = settledImport(reading, book, rates, NO_CHOICES, newIds)
  const waits = unattendedWaits(settled, book, { misfit: ports.misfit, lackingRates: ratesWanted(reading.rows, rates)?.currencies ?? [], undone: ports.undone })
  if (waits.length > 0) return { kind: 'waits', waits }
  const { added } = settled.dryRun
  const records = transactionCount(added)
  if (records === 0) return { kind: 'nothing' }
  try {
    const receipt = await store.write(ports.title(records), (unit) => {
      writeWorkbookImport(unit, added, [], [])
      writeLeftOut(unit, store.state.workbook?.book ?? book, reader, [])
    })
    if (receipt === null) return { kind: 'nothing' }
    return { kind: 'imported', receipt, records, keys: importableRecords(added).flatMap((imported) => imported.record.importKeys) }
  } catch (failure) {
    if (failure instanceof WorkbookWriteRefused) return { kind: 'refused', reason: failure.message }
    throw failure
  }
}

/** The imports the syncs of one page made, so rows Undo took back wait for the person instead of going in again at the next sync. */
export interface SyncImports {
  add(outcome: MailedImport): void
  /** The import keys of the rows those imports wrote that a later write of the session undid. */
  undone(writes: readonly SessionWrite[]): ReadonlySet<string>
}

export function syncImports(): SyncImports {
  const imports: Extract<MailedImport, { readonly kind: 'imported' }>[] = []
  return {
    add(outcome) {
      if (outcome.kind === 'imported') imports.push(outcome)
    },
    undone(writes) {
      return new Set(
        imports.flatMap(({ receipt, keys }) => {
          const write = writes.find((written) => written.receipt === receipt)
          return write !== undefined && wasUndone(write, writes) ? keys : []
        }),
      )
    },
  }
}
