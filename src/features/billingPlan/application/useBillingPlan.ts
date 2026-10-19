import { computed, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'

import type { CivilDate } from '../../../shared/calendar/civilDate'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { billingTotals } from '../domain/billingTotals'
import type { BillingTotals } from '../domain/billingTotals'
import { expectedInvoices } from '../domain/expectedInvoices'
import type { ExpectedInvoice } from '../domain/expectedInvoices'
import { fillRestOfYear } from '../domain/fillRestOfYear'
import type { RestOfYearFill } from '../domain/fillRestOfYear'
import { itemStatistics } from '../domain/itemStatistics'
import type { ItemStatistics } from '../domain/itemStatistics'
import { plannedAgainstInvoiced } from '../domain/plannedAgainstInvoiced'
import type { ClientBillingMatch } from '../domain/plannedAgainstInvoiced'

/** The billing plan of the workbook on screen, seen on one day. */
export interface BillingPlanFigures {
  readonly totals: BillingTotals
  readonly matches: readonly ClientBillingMatch[]
  readonly statistics: ItemStatistics
  readonly expected: readonly ExpectedInvoice[]
  readonly fill: RestOfYearFill
}

/** Null until a workbook is on screen and there is a day to see it on. */
export function useBillingPlan(asOf: MaybeRefOrGetter<CivilDate | null>): ComputedRef<BillingPlanFigures | null> {
  const { state } = useWorkbook()
  return computed(() => {
    const workbook = state.workbook
    const day = toValue(asOf)
    if (workbook === null || day === null) {
      return null
    }
    const { billingPlan, invoices } = workbook
    return {
      totals: billingTotals(billingPlan, invoices),
      matches: plannedAgainstInvoiced(billingPlan, invoices),
      statistics: itemStatistics(billingPlan),
      expected: expectedInvoices(billingPlan, invoices),
      fill: fillRestOfYear(billingPlan, workbook.settings.billing, day),
    }
  })
}
