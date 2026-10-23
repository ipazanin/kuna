import type { BillingItem } from '../../workbook/domain/billingPlan'
import { readBillingPlan } from '../../workbook/domain/billingPlanReading'
import { definedClientSlugs } from '../../workbook/domain/clientsReading'
import { newRecordId, recordIdOf } from '../../workbook/domain/recordId'
import { BILLING_RECORDS, CLIENT_RECORDS } from '../../workbook/domain/recordKind'
import type { WriteRules } from '../../workbook/domain/writeRules'
import type { BillingItemDraft } from '../domain/fillRestOfYear'

/** Items to invoice, checked by their reader against the clients as they are now. */
export const BILLING_WRITES: WriteRules<BillingItem> = {
  kind: BILLING_RECORDS,
  reads: [CLIENT_RECORDS],
  undoable: true,
  read: (read, records) => readBillingPlan(read, definedClientSlugs(records.of(CLIENT_RECORDS))),
  refusals: () => [],
}

/** A new item to invoice, its text trimmed and its client in lower case, with an id of its own. */
export function newBillingItem(draft: BillingItemDraft): BillingItem {
  return {
    item: draft.item.trim(),
    date: draft.date,
    amount: draft.amount,
    client: draft.client.trim().toLowerCase(),
    description: draft.description.trim(),
    id: recordIdOf(BILLING_RECORDS, newRecordId()),
  }
}
