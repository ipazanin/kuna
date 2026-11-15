import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { setSettings } from '../../settings/application/settingWrites'
import { CLIENT_PAYMENTS_PLACED_KEY, flagText } from '../../settings/domain/settings'
import { ITEM_WRITES, itemChanged } from '../../transactions/application/itemWrites'
import { presentedWorkbook } from '../../transactions/domain/presentedWorkbook'
import { ITEM_RECORDS } from '../../workbook/domain/coreKinds'
import type { CompanyBooks } from '../../workbook/domain/readWorkbook'
import { storesItems } from '../../workbook/domain/rowItems'
import { itemIdOfRow } from '../../workbook/domain/splits'
import type { ItemRecord } from '../../workbook/domain/splitsReading'
import type { Invoice, Transaction } from '../../workbook/domain/workbook'
import { receivablesOf } from '../domain/invoiceMatching'
import { invoicePartsOf, placedOnInvoice } from '../domain/invoicePayments'
import type { PaymentChoice } from '../domain/invoicePayments'
import { INVOICE_WRITES } from './invoiceWrites'

/**
 * Starts placing client payments on books with an items tab that match them on every read: each stored client payment's item is
 * split by what today's matching puts on each invoice, and the settings record that the books store it from now on. Does nothing
 * on books from before items or on books that place their payments already.
 */
export function startPlacingPayments(unit: UnitOfWork, books: CompanyBooks, newId: () => string = newRecordId): void {
  if (!storesItems(books.records) || books.workbook.settings.clientPaymentsPlaced) return
  const held = recordsOf(books.records.items)
  const parts = startedParts(books, held, () => recordIdOf(ITEM_RECORDS, newId()))
  writeItems(
    unit,
    held,
    held.flatMap((item) => parts.get(item.id) ?? [item]),
  )
  recordPlacing(unit, books)
}

/**
 * Adds the invoice, or changes the one the books hold, and when its client or number gives it a new id the payments placed on it
 * follow it. With payments chosen, on books with an items tab, they are what pays it from now on, as `placedOnInvoice` says, in the
 * same write. On books that match their payments on every read, placing them starts there, as `startPlacingPayments` does. Null
 * leaves the payments as they are.
 */
export function writeInvoice(unit: UnitOfWork, books: CompanyBooks, before: Invoice | null, after: Invoice, chosen: readonly PaymentChoice[] | null, newId: () => string = newRecordId): void {
  if (before === null) unit.of(INVOICE_WRITES).add(after)
  else unit.of(INVOICE_WRITES).change(before, after)
  const { records, workbook } = books
  const placing = chosen !== null && storesItems(records)
  if (!placing && (before === null || before.id === after.id)) return
  const held = recordsOf(records.items)
  const partId = () => recordIdOf(ITEM_RECORDS, newId())
  const starting = placing && !workbook.settings.clientPaymentsPlaced
  const parts = starting ? startedParts(books, held, partId) : new Map<RecordId, readonly ItemRecord[]>()
  const followed = held.flatMap((item) => parts.get(item.id) ?? [item]).map((item) => (before !== null && item.invoice === before.id ? { ...item, invoice: after.id } : item))
  if (!placing) {
    writeItems(unit, held, followed)
    return
  }
  const partOf = (choice: PaymentChoice) => (parts.get(choice.item) ?? held.filter((item) => item.id === choice.item)).find((item) => item.invoice === (choice.named ? before?.id : null))
  const paying = chosen.flatMap((choice) => {
    const part = partOf(choice)
    return part === undefined ? [] : [{ item: part.id, amount: choice.amount, named: choice.named }]
  })
  writeItems(unit, held, placedOnInvoice(followed, after, paying, partId))
  if (starting) recordPlacing(unit, books)
}

/** Each stored client payment's item split by what today's matching puts on each invoice, by the item's id, as `invoicePartsOf` says. */
function startedParts({ workbook }: CompanyBooks, held: readonly ItemRecord[], partId: () => RecordId): ReadonlyMap<RecordId, readonly ItemRecord[]> {
  const heldById = new Map(held.map((item) => [item.id, item]))
  const itemOf = (row: Transaction) => heldById.get(itemIdOfRow(row))
  return invoicePartsOf(receivablesOf(presentedWorkbook(workbook)), itemOf, partId)
}

/** Leaves the items tab holding `written` in place of `held`: each item by its id is added, changed or removed. */
function writeItems(unit: UnitOfWork, held: readonly ItemRecord[], written: readonly ItemRecord[]): void {
  const items = unit.of(ITEM_WRITES)
  const heldById = new Map(held.map((item) => [item.id, item]))
  for (const item of written) {
    const before = heldById.get(item.id)
    if (before === undefined) items.add(item)
    else if (itemChanged(before, item)) items.change(before, item)
  }
  const kept = new Set(written.map((item) => item.id))
  held.filter((item) => !kept.has(item.id)).forEach((item) => items.remove(item))
}

/** Records in the settings that the books store which invoice each client payment pays. */
function recordPlacing(unit: UnitOfWork, { records }: CompanyBooks): void {
  setSettings(unit, records.settings, [{ key: CLIENT_PAYMENTS_PLACED_KEY, value: flagText(true) }])
}
