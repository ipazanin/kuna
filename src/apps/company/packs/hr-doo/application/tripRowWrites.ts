import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { partReplacements } from '../../../../../shared/categorising/domain/partReplacements'
import type { PartReplacement } from '../../../../../shared/categorising/domain/partReplacements'
import type { UnitOfWork } from '../../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../../shared/storage/domain/recordId'
import { filedIn, movedTo } from '../../../owner-share/domain/ownerShare'
import { writeRowItems } from '../../../transactions/application/itemWrites'
import type { ItemDraft } from '../../../transactions/application/itemWrites'
import type { CompanyBooks } from '../../../workbook/domain/readWorkbook'
import { storedSplitOf, storesItems } from '../../../workbook/domain/rowItems'
import { rowItemsOf, wholeItemId } from '../../../workbook/domain/splits'
import type { SplitPart } from '../../../workbook/domain/splits'
import type { Transaction } from '../../../workbook/domain/workbook'
import { TRIP_WRITES } from '../domain/hrDooWrites'
import type { Trip } from '../domain/trips/trip'
import type { TripRowLink, TripRowSplit } from '../domain/trips/tripBankRows'

/**
 * The trip with one of its links naming these items, or none, as the books keep it: by the items on books with an items tab,
 * and by the row id of their row on books from before items, which stands for every item of the row.
 */
function withLink(trip: Trip, link: TripRowLink, row: Transaction | null, items: readonly RecordId[], onItemsTab: boolean): Trip {
  const listed = row === null || !onItemsTab ? [] : items
  const rowId = row === null || onItemsTab ? null : row.rowId
  return link === 'advance' ? { ...trip, advanceItems: listed, advanceRow: rowId } : { ...trip, payoutItems: listed, payoutRow: rowId }
}

/** Links one of a trip's links to every item of a ledger row, or unlinks it with null. The row's items stay as they are. */
export function linkTripRow(unit: UnitOfWork, books: CompanyBooks, trip: Trip, link: TripRowLink, row: Transaction | null): void {
  const items = row === null ? [] : rowItemsOf(books.workbook.splits)(row).map((item) => item.id)
  unit.of(TRIP_WRITES).change(trip, withLink(trip, link, row, items, storesItems(books.records)))
}

/** Sets aside a payment Kuna offered for the trip, which a person says is not its advance or payout, with every item of its row. */
export function dismissTripRow(unit: UnitOfWork, books: CompanyBooks, trip: Trip, row: Transaction): void {
  if (storesItems(books.records)) {
    const items = rowItemsOf(books.workbook.splits)(row).map((item) => item.id)
    unit.of(TRIP_WRITES).change(trip, { ...trip, dismissedItems: [...trip.dismissedItems, ...items.filter((id) => !trip.dismissedItems.includes(id))] })
  } else if (row.rowId !== null && !trip.dismissedRows.includes(row.rowId)) {
    unit.of(TRIP_WRITES).change(trip, { ...trip, dismissedRows: [...trip.dismissedRows, row.rowId] })
  }
}

/** Marks the trip's JOPPD code 17 line as reported on the day, or clears the mark with null. */
export function markTripReported(unit: UnitOfWork, trip: Trip, on: CivilDate | null): void {
  unit.of(TRIP_WRITES).change(trip, { ...trip, reportedOn: on })
}

/**
 * The settlement's parts as items. When the row was split, a part in a category an item of the link holds keeps that item's id,
 * note and share. When it was one item, the first part keeps that item's id and every part takes its category's share. The rest
 * is a new item.
 */
function filedItems(split: TripRowSplit, before: readonly SplitPart[], categories: CompanyBooks['workbook']['categories']): { readonly parts: ItemDraft[]; readonly rest: ItemDraft[] } {
  const openable = before.length > 1 ? split.items : []
  const taken = new Set<RecordId>()
  const parts = split.parts.map((part, index): ItemDraft => {
    const opened = openable.find((item) => item.category === part.category && !taken.has(item.id)) ?? null
    if (opened !== null) taken.add(opened.id)
    const filed = movedTo(opened ?? { category: '', ownerShare: null }, part.category, categories)
    const whole = index === 0 && before.length === 1 && split.row.rowId !== null ? wholeItemId(split.row) : null
    return { id: opened?.id ?? whole, amount: part.amount, category: filed.category, note: opened?.note ?? '', ownerShare: filed.ownerShare }
  })
  const [largest] = split.items
  const rest =
    split.rest === null || largest === undefined
      ? []
      : [{ id: null, amount: split.rest.amount, category: split.rest.category, note: '', ownerShare: movedTo(largest, split.rest.category, categories).ownerShare }]
  return { parts, rest }
}

/**
 * Files each linked payment by the settlement in one write: the items the trip names take the settlement's parts, the rest of
 * what they paid stays one item outside the trip, and the row's other items stay as they are. A row left with one item takes
 * the category it is filed in with that category's share and the person's review label. A part in a category an item of the
 * link already holds keeps that item's id and note. The trip then names the items its settlement filed. Gives what each part
 * replaces.
 */
export function fileTripRows(unit: UnitOfWork, books: CompanyBooks, trip: Trip, splits: readonly TripRowSplit[], reviewLabel: string): readonly PartReplacement<RecordId>[] {
  const { records, workbook } = books
  const { categories } = workbook
  const onItemsTab = storesItems(records)
  const itemsOf = rowItemsOf(workbook.splits)
  let filedTrip = trip
  const replaced = splits.flatMap((split) => {
    const before = itemsOf(split.row)
    const kept = split.others
    const { parts, rest } = filedItems(split, before, categories)
    const items = [...kept, ...parts, ...rest]
    const [only] = items
    const one = items.length === 1 && only !== undefined
    const written = writeRowItems(
      unit,
      records,
      split.row,
      storedSplitOf(records, workbook, split.row),
      one ? [{ ...filedIn(only, only.category, categories), id: wholeItemId(split.row) }] : items,
      one ? reviewLabel : null,
    )
    const filed = written.slice(kept.length, kept.length + parts.length).map((item) => item.id)
    filedTrip = withLink(filedTrip, split.link, split.row, filed, onItemsTab)
    return partReplacements(before, written)
  })
  if (onItemsTab) unit.of(TRIP_WRITES).change(trip, filedTrip)
  return replaced
}
