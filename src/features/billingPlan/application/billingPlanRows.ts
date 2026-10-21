import { civilDateFromSerial, serialFromCivilDate } from '../../../shared/calendar/civilDate'
import { amountOf } from '../../../shared/money/money'
import { cellText } from '../../../shared/text/cellText'
import type { TabRowRules } from '../../workbook/application/tabRowWrites'
import type { RowCells } from '../../workbook/domain/rowChanges'
import { BILLING_PLAN_COLUMNS, readBillingPlan } from '../../workbook/infrastructure/billingPlanTabReader'
import { definedClientSlugs } from '../../workbook/infrastructure/workbookReader'
import type { BillingItemDraft } from '../domain/fillRestOfYear'

/** A row to add, as the tab holds it: the date as a serial number, so the cell is a date cell like one typed in the Sheet. */
export function billingCellsOf(draft: BillingItemDraft): RowCells {
  return {
    item: draft.item.trim(),
    date: serialFromCivilDate(draft.date),
    amount: amountOf(draft.amount),
    client: draft.client.trim().toLowerCase(),
    description: draft.description.trim(),
  }
}

/** The `outgoing-plan` tab's five columns, checked by its reader against the clients tab as it is now. */
export const BILLING_PLAN_ROWS: TabRowRules = {
  tab: 'outgoing-plan',
  noun: { one: 'plan row', many: 'plan rows', article: 'a' },
  columns: BILLING_PLAN_COLUMNS,
  required: BILLING_PLAN_COLUMNS,
  caseless: ['client'],
  dates: ['date'],
  reads: ['clients'],
  read: (rows, fresh) => readBillingPlan(rows, definedClientSlugs(fresh.clients?.rows ?? [])),
  refusals: () => [],
  label: (cells) => {
    const date = typeof cells.date === 'number' && Number.isFinite(cells.date) ? civilDateFromSerial(cells.date) : cellText(cells.date)
    return [cellText(cells.item), cellText(cells.client), date].filter((part) => part !== '').join(', ') || 'blank'
  },
}
