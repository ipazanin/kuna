import { yearOf } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { lastDayOf, monthKey, monthOf, monthsFrom } from '../../../shared/calendar/monthKey'
import { monthLabel } from '../../../shared/calendar/monthLabel'
import type { BillingTerms } from '../../settings/domain/settings'
import type { BillingItem } from '../../workbook/domain/billingPlan'

/** A plan row before it is on the tab. */
export type BillingItemDraft = Omit<BillingItem, 'sheetRow'>

export type RestOfYearFill =
  | { readonly kind: 'rows'; readonly rows: readonly BillingItemDraft[] }
  | { readonly kind: 'refused'; readonly reason: string }

/**
 * The rows "Fill the rest of the year" adds for the billing client: the monthly fee and the
 * subscription, each dated on the last day of every month from the month of `asOf` to December. A
 * month that already has the item for the client is skipped, so the action can run again after
 * rows are adjusted. The yearly bonus is never filled in.
 */
export function fillRestOfYear(plan: readonly BillingItem[], terms: BillingTerms, asOf: CivilDate): RestOfYearFill {
  if (terms.client === '') {
    return { kind: 'refused', reason: 'Choose the client the rows are for first.' }
  }
  const monthly = [
    { item: terms.monthlyItem, amount: terms.monthlyAmount },
    { item: terms.subscriptionItem, amount: terms.subscriptionAmount },
  ].flatMap(({ item, amount }) => (item === '' || amount === null ? [] : [{ item, amount }]))
  if (monthly.length === 0) {
    return { kind: 'refused', reason: 'Set the monthly fee or the monthly subscription, each with its item, first.' }
  }
  const planned = new Set(plan.filter((row) => row.client === terms.client).map((row) => `${monthOf(row.date)} ${row.item}`))
  const months = monthsFrom(monthOf(asOf), monthKey(yearOf(asOf), 12))
  return {
    kind: 'rows',
    rows: months.flatMap((month) =>
      monthly
        .filter(({ item }) => !planned.has(`${month} ${item}`))
        .map(({ item, amount }) => ({ item, date: lastDayOf(month), amount, client: terms.client, description: monthLabel(month) })),
    ),
  }
}
