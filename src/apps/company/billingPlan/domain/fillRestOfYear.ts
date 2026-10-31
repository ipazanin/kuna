import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { firstDayOf, lastDayOf, monthKey, monthOf, monthsFrom, yearOfMonth } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { BillingTerms } from '../../settings/domain/settings'
import { billingItemOrder } from '../../workbook/domain/billingPlan'
import type { BillingItem } from '../../workbook/domain/billingPlan'
import { words } from './words'

/** A plan row before it is on the tab. */
export type BillingItemDraft = Omit<BillingItem, 'id'>

export type RestOfYearFill = { readonly kind: 'rows'; readonly rows: readonly BillingItemDraft[] } | { readonly kind: 'refused'; readonly reason: string }

// A description becomes the line of an invoice, so its month stays English whatever the language on screen.
const LONG_NAME = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' })
const SHORT_NAME = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' })

/**
 * The rows "Fill the rest of the year" adds for the billing client: the monthly fee and the
 * subscription, each dated on the last day of every month of `year` from the month of `asOf` to
 * December, so a later year fills from January and an earlier one fills nothing. A month that
 * already has the item for the client is skipped, so the action can run again after rows are
 * adjusted. The yearly bonus is never filled in.
 *
 * Each row takes the description of the client's latest row of the same item, with the new month
 * put where that row's month is named, so "Fee for September" becomes "Fee for October" and
 * "Design tool seat" stays as it is. An item with no row yet is described by its month.
 */
export function fillRestOfYear(plan: readonly BillingItem[], terms: BillingTerms, asOf: CivilDate, year: number = yearOf(asOf)): RestOfYearFill {
  if (terms.client === '') {
    return { kind: 'refused', reason: words.fill.noClient }
  }
  const monthly = [
    { item: terms.monthlyItem, amount: terms.monthlyAmount },
    { item: terms.subscriptionItem, amount: terms.subscriptionAmount },
  ].flatMap(({ item, amount }) => (item === '' || amount === null ? [] : [{ item, amount }]))
  if (monthly.length === 0) {
    return { kind: 'refused', reason: words.fill.noTerms }
  }
  const clientRows = plan.filter((row) => row.client === terms.client)
  const planned = new Set(clientRows.map((row) => `${monthOf(row.date)} ${row.item}`))
  const latest = new Map<string, BillingItem>()
  for (const row of [...clientRows].sort(billingItemOrder)) {
    latest.set(row.item, row)
  }
  const first = year === yearOf(asOf) ? monthOf(asOf) : monthKey(year, 1)
  const months = year < yearOf(asOf) ? [] : monthsFrom(first, monthKey(year, 12))
  return {
    kind: 'rows',
    rows: months.flatMap((month) =>
      monthly
        .filter(({ item }) => !planned.has(`${month} ${item}`))
        .map(({ item, amount }) => ({ item, date: lastDayOf(month), amount, client: terms.client, description: descriptionFor(latest.get(item), month) })),
    ),
  }
}

function descriptionFor(previous: BillingItem | undefined, month: MonthKey): string {
  if (previous === undefined) {
    const { long, shorts, year } = namesOf(month)
    return `${shorts[0] ?? long} ${year}`
  }
  const from = namesOf(monthOf(previous.date))
  const to = namesOf(month)
  const names = [from.long, ...from.shorts].flatMap((name) => [name, name.toUpperCase()])
  const mention = new RegExp(`\\b(${names.join('|')})\\b(?:\\s(${from.year}|${from.year.slice(2)})\\b)?`, 'g')
  return previous.description.replace(mention, (_mention, name: string, year: string | undefined) => {
    const swapped = name.toLowerCase() === from.long.toLowerCase() ? to.long : (to.shorts[0] ?? to.long)
    const cased = name === name.toUpperCase() ? swapped.toUpperCase() : swapped
    return year === undefined ? cased : `${cased} ${to.year.slice(-year.length)}`
  })
}

/**
 * The names a month goes by in running text, capitalised so that "may" in a sentence is left
 * alone: the long name, then the short ones, the three-letter form first so that "Sept" is read but "Sep" is written.
 */
function namesOf(month: MonthKey): { readonly long: string; readonly shorts: readonly string[]; readonly year: string } {
  const day = new Date(firstDayOf(month))
  const long = LONG_NAME.format(day)
  const shorts = [...new Set([long.slice(0, 3), SHORT_NAME.format(day)])].filter((short) => short !== long)
  return { long, shorts, year: String(yearOfMonth(month)) }
}
