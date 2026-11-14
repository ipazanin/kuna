import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import type { Money } from '../../../../../shared/money/money'
import { filedIn, movedTo } from '../../../owner-share/domain/ownerShare'
import type { ShareDefault } from '../../../owner-share/domain/ownerShare'
import { newRecordId, recordIdOf } from '../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../shared/storage/domain/recordId'
import type { UnitOfWork } from '../../../../../shared/storage/application/repository'
import { recordsOf } from '../../../../../shared/storage/domain/recordsRead'
import { recordsOfKindIn } from '../../../workbook/domain/readWorkbook'
import type { WorkbookRecords } from '../../../workbook/domain/readWorkbook'
import type { RowRepayments } from '../../../workbook/domain/repayments'
import { ledgerOfRecords } from '../../../workbook/domain/readWorkbook'
import { definedCategories } from '../../../workbook/domain/categoriesReading'
import { storedItemsOfRow, storedSplitOf, storesItems } from '../../../workbook/domain/rowItems'
import { ITEM_RECORDS } from '../../../workbook/domain/coreKinds'
import type { Transaction } from '../../../workbook/domain/workbook'
import { writeRowItems } from '../../../transactions/application/itemWrites'
import type { ItemDraft } from '../../../transactions/application/itemWrites'
import { repaymentParts, repaymentsPlaced } from '../domain/advanceRepayments'
import type { RepaymentChoice } from '../domain/advanceRepayments'
import { OWNER_ADVANCE_WRITES } from '../domain/hrDooWrites'
import { OWNER_ADVANCE_RECORDS } from '../domain/hrDooKinds'
import type { OwnerAdvanceEntry } from '../domain/ownerAdvancesReading'

/** A cost the owner paid privately, as the advance form gives it. */
export interface OwnerAdvanceDraft {
  readonly date: CivilDate
  /** Above zero. */
  readonly amount: Money
  readonly description: string
  readonly category: string
}

/**
 * The advance the form gives, its description trimmed and its category in lower case: a new one with
 * an id of its own, or the advance it changes under the id that one keeps. A new advance, or one put
 * in another category, takes its category's default share, and one that keeps its category keeps its share.
 */
export function ownerAdvanceOfDraft(draft: OwnerAdvanceDraft, categories: readonly ShareDefault[], before: OwnerAdvanceEntry | null = null): OwnerAdvanceEntry {
  const category = draft.category.trim().toLowerCase()
  const described = { date: draft.date, amount: draft.amount, description: draft.description.trim() }
  return before === null
    ? filedIn({ ...described, category: '', ownerShare: null, id: recordIdOf(OWNER_ADVANCE_RECORDS, newRecordId()) }, category, categories)
    : movedTo({ ...before, ...described }, category, categories)
}

/** Has each advance the new rows pay back name the items that pay it, after those it names already. */
export function linkRepayments(unit: UnitOfWork, records: WorkbookRecords, repayments: readonly RowRepayments[]): void {
  const paid = new Map<RecordId, RecordId[]>()
  for (const item of repayments.flatMap((repayment) => repayment.items)) {
    if (item.of !== null) paid.set(item.of, [...(paid.get(item.of) ?? []), item.id])
  }
  if (paid.size === 0) return
  const advances = unit.of(OWNER_ADVANCE_WRITES)
  for (const advance of recordsOf(recordsOfKindIn(records, OWNER_ADVANCE_RECORDS))) {
    const items = paid.get(advance.id)
    if (items !== undefined) advances.change(advance, { ...advance, repaidBy: [...(advance.repaidBy ?? []), ...items] })
  }
}

/**
 * Adds or changes an advance, in books that keep items with the payments chosen as what paid it back. A payment it names already
 * stays as it is. A new one pays back what is still open of the cost, as `repaymentsPlaced` says: an item that pays back all of
 * it takes the advance's description as its note, and one that pays back part of it gives that part to an item of its own with
 * that note, while the rest keeps the item's id. A payment that pays back nothing is left out. Books from before items keep the
 * advance as they always did, matched to the payments on every read.
 */
export function writeOwnerAdvance(unit: UnitOfWork, records: WorkbookRecords, before: OwnerAdvanceEntry | null, advance: OwnerAdvanceEntry, chosen: readonly RepaymentChoice[]): void {
  const { repaidBy: _repaidBy, ...cost } = advance
  const repaidBy = storesItems(records) ? placeRepayments(unit, records, advance, chosen) : []
  const written: OwnerAdvanceEntry = repaidBy.length === 0 ? cost : { ...cost, repaidBy }
  if (before === null) unit.of(OWNER_ADVANCE_WRITES).add(written)
  else unit.of(OWNER_ADVANCE_WRITES).change(before, written)
}

/** The items that pay the advance back once the chosen payments are placed on it, in the order chosen, each row's items written once. */
function placeRepayments(unit: UnitOfWork, records: WorkbookRecords, advance: OwnerAdvanceEntry, chosen: readonly RepaymentChoice[]): RecordId[] {
  const applied = repaymentsPlaced(advance.amount, chosen)
  const ledger = ledgerOfRecords(records, definedCategories(records.categories))
  const itemOf = new Map<RecordId, RecordId>()
  const rows = new Map<RecordId, Transaction>()
  chosen.forEach((choice, index) => {
    if (!choice.named && applied[index]! > 0) {
      const row = choice.payment.split?.whole ?? choice.payment
      rows.set(row.id, row)
    }
  })
  for (const row of rows.values()) {
    const items = storedItemsOfRow(records.items, row).flatMap((item): ItemDraft[] => {
      const index = chosen.findIndex((choice) => !choice.named && choice.item === item.id)
      if (index < 0 || applied[index]! <= 0) return [item]
      const parts = repaymentParts(item, [{ advance, applied: applied[index]! }], () => recordIdOf(ITEM_RECORDS, newRecordId()))
      itemOf.set(item.id, parts.find((part) => part.advance !== null)!.id)
      return parts.map((part) => ({ id: part.id, amount: part.amount, category: item.category, note: part.note, ownerShare: item.ownerShare }))
    })
    writeRowItems(unit, records, row, storedSplitOf(records, ledger, row), items)
  }
  return chosen.flatMap((choice) => {
    const placed = itemOf.get(choice.item)
    return choice.named ? [choice.item] : placed === undefined ? [] : [placed]
  })
}
