import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { setSettings } from '../../settings/application/settingWrites'
import { CLIENT_PAYMENTS_PLACED_KEY, flagText } from '../../settings/domain/settings'
import { ITEM_WRITES } from '../../transactions/application/itemWrites'
import { presentedWorkbook } from '../../transactions/domain/presentedWorkbook'
import { ITEM_RECORDS } from '../../workbook/domain/coreKinds'
import type { CompanyBooks } from '../../workbook/domain/readWorkbook'
import { storesItems } from '../../workbook/domain/rowItems'
import { itemIdOfRow } from '../../workbook/domain/splits'
import type { Transaction } from '../../workbook/domain/workbook'
import { receivablesOf } from '../domain/invoiceMatching'
import { matchedInvoiceItems } from '../domain/invoicePayments'

/**
 * Starts placing client payments on books with an items tab that match them on every read: each stored client payment's item is
 * split by what today's matching puts on each invoice, and the settings record that the books store it from now on. Does nothing
 * on books from before items or on books that place their payments already.
 */
export function startPlacingPayments(unit: UnitOfWork, books: CompanyBooks, newId: () => string = newRecordId): void {
  const { records, workbook } = books
  if (!storesItems(records) || workbook.settings.clientPaymentsPlaced) return
  const held = recordsOf(records.items)
  const heldById = new Map(held.map((item) => [item.id, item]))
  const itemOf = (row: Transaction) => heldById.get(itemIdOfRow(row))
  const placed = matchedInvoiceItems(receivablesOf(presentedWorkbook(workbook)), held, itemOf, () => recordIdOf(ITEM_RECORDS, newId()))
  const items = unit.of(ITEM_WRITES)
  for (const item of placed) {
    const before = heldById.get(item.id)
    if (before === undefined) items.add(item)
    else if (before.amount !== item.amount || before.note !== item.note || before.invoice !== item.invoice) items.change(before, item)
  }
  setSettings(unit, records.settings, [{ key: CLIENT_PAYMENTS_PLACED_KEY, value: flagText(true) }])
}
