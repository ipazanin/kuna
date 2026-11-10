import { LEDGER_WRITES } from '../../imports/application/ledgerWrites'
import { installedPack } from '../../packs/packContribution'
import { SPLIT_WRITES } from '../../transactions/application/splitWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { definedCategories } from '../domain/categoriesReading'
import { readLedger } from '../domain/ledgerReading'
import type { WorkbookRecords } from '../domain/readWorkbook'
import { rowsOfSplitKey } from '../domain/splits'
import type { Transaction } from '../domain/workbook'

/**
 * Gives every ledger row that has no row id a new one, and in the same write links what finds such a row by its content to
 * the row's id: each split part whose day, account, amount and balance find exactly one row, and the pack's records.
 */
export function giveRowsIds(unit: UnitOfWork, records: WorkbookRecords, newId: () => string = newRecordId): void {
  const categories = definedCategories(records.categories)
  const entries = recordsOf(records.ledger)
  const given = entries.map((entry) => (entry.rowId === null ? newId() : null))
  const ledger = unit.of(LEDGER_WRITES)
  entries.forEach((entry, position) => {
    const rowId = given[position] ?? null
    if (rowId !== null) ledger.change(entry, { ...entry, rowId })
  })
  // The reader keeps the ledger's order, so each row stands where its entry does.
  const transactions = readLedger(records.ledger, categories).facts.map((row, position): Transaction => ({ ...row, rowId: given[position] ?? row.rowId }))
  const parts = unit.of(SPLIT_WRITES)
  for (const part of recordsOf(records.splits)) {
    const found = part.key.rowId === null ? rowsOfSplitKey(transactions, part.key) : []
    const rowId = found.length === 1 ? found[0]!.rowId : null
    if (rowId !== null) parts.change(part, { ...part, key: { ...part.key, rowId } })
  }
  installedPack().linkToRows(unit, records, { transactions, categories })
}
