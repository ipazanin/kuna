import { filedIn } from '../../owner-share/domain/ownerShare'
import type { ShareDefault } from '../../owner-share/domain/ownerShare'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { refuseOn } from '../../../../shared/storage/application/workbookWriteRefused'
import { recordWithId } from '../../../../shared/storage/domain/recordsRead'
import { LEDGER_WRITES } from '../../imports/application/ledgerWrites'
import type { CompanyBooks } from '../../workbook/domain/readWorkbook'
import { NOTHING_STORED, rowItemsOf, wholeItemId } from '../../workbook/domain/splits'
import { words } from '../../workbook/domain/words'
import type { RowVerdict } from '../domain/verdictChanges'
import { writeRowItems } from './itemWrites'
import { filedInOneCategory } from '../domain/categoryChange'
import { storedSplitsOf } from '../../workbook/domain/storedSplits'

/**
 * Files each ledger row under its new verdict, the row as the app read it: its one item takes the category with its default share.
 * A row of several items in one category, as a payment placed on several invoices is, has every item take the new category,
 * each keeping its amount and note. A row of items in different categories keeps them, so a verdict on it only says who filed it,
 * and one that names another category is refused, since its split says where its money goes. A row the books on screen no longer
 * hold is left out.
 */
export function fileRows(unit: UnitOfWork, books: CompanyBooks, verdicts: readonly RowVerdict[], categories: readonly ShareDefault[]): void {
  const { records, workbook } = books
  const itemsOf = rowItemsOf(workbook.splits)
  for (const { id, verdict } of verdicts) {
    const row = workbook.transactions.find((candidate) => candidate.id === id && candidate.split === undefined)
    const entry = recordWithId(records.ledger, id)?.record
    if (row === undefined || entry === undefined) continue
    const items = itemsOf(row)
    if (items.length > 1 && filedInOneCategory(items) && verdict.category !== items[0]!.category) {
      const refiled = items.map((item) => {
        const { category, ownerShare } = filedIn(item, verdict.category, categories)
        return { id: item.id, amount: item.amount, note: item.note, category, ownerShare }
      })
      writeRowItems(unit, records, row, storedSplitsOf(records)(row), refiled, verdict.flaggedBy)
      continue
    }
    if (items.length > 1) {
      refuseOn(verdict.category === row.category || filedInOneCategory(items) ? [] : [words.items.fileTheSplit(row.account, row.date, row.amount)])
      unit.of(LEDGER_WRITES).change(entry, { ...entry, flaggedBy: verdict.flaggedBy })
      continue
    }
    const filed = filedIn({ category: row.category, ownerShare: row.ownerShare }, verdict.category, categories)
    writeRowItems(unit, records, row, NOTHING_STORED, [{ id: wholeItemId(row), amount: row.amount, note: '', ...filed }], verdict.flaggedBy)
  }
}
