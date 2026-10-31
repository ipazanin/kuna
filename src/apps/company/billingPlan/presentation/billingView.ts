import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthKey, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { ZERO, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney, formatPercent } from '../../../../shared/money/moneyFormat'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { billingItemOrder } from '../../workbook/domain/billingPlan'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { Client, Invoice } from '../../workbook/domain/workbook'
import type { BillingPlanFigures } from '../application/useBillingPlan'
import type { MatchedBillingItem } from '../domain/plannedAgainstInvoiced'
import { itemColours, itemYearsChart } from './billingCharts'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'

export type BillingStatus = 'invoiced' | 'part' | 'open'

/** How a row or a month reads by what the invoices billed of it. */
export const BILLING_STATUS: Readonly<Record<BillingStatus, { readonly label: string; readonly color: 'success' | 'warning' | 'neutral' }>> = {
  invoiced: { label: words.status.invoiced, color: 'success' },
  part: { label: words.status.part, color: 'warning' },
  open: { label: words.status.open, color: 'neutral' },
}

export interface BillingInvoiceShare {
  readonly key: string
  readonly number: string
  readonly amount: Money
}

/** One plan row with what the invoices billed of it. */
export interface BillingRowLine {
  readonly id: RecordId
  readonly item: string
  readonly colour: string
  readonly date: CivilDate
  readonly description: string
  readonly client: string
  readonly clientName: string
  readonly amount: Money
  readonly open: Money
  readonly status: BillingStatus
  readonly invoices: readonly BillingInvoiceShare[]
}

/** What an invoice issued in a month billed above the plan rows it could reach. */
export interface WithoutPlanLine {
  readonly key: RecordId
  readonly number: string
  readonly clientName: string
  readonly issued: CivilDate
  readonly amount: Money
}

export interface BillingMonthLine {
  readonly month: MonthKey
  readonly label: string
  readonly planned: Money
  readonly invoiced: Money
  readonly open: Money
  readonly withoutPlan: Money
  /** Null for a month with no plan rows, only invoices above the plan. */
  readonly status: BillingStatus | null
  readonly rows: readonly BillingRowLine[]
  readonly withoutPlanLines: readonly WithoutPlanLine[]
}

export interface BillingCheckLine {
  readonly label: string
  readonly amount: Money
}

/** Every year a plan row or an invoice falls in, the year of the newest booking and the year after, which the forecast reaches, oldest first. */
export function billingYears(figures: BillingPlanFigures, asOf: CivilDate): number[] {
  return [...new Set([...figures.totals.years.map((entry) => entry.year), yearOf(asOf), yearOf(asOf) + 1])].sort((earlier, later) => earlier - later)
}

/** What the Plan tab of Invoicing shows for one year. */
export function billingView(figures: BillingPlanFigures, register: { readonly clients: readonly Client[]; readonly invoices: readonly Invoice[] }, year: number, tokens: ChartTokens) {
  const { clients, invoices } = register
  const nameOf = (slug: string): string => clients.find((client) => client.slug === slug)?.name || slug
  const colours = itemColours(
    figures.statistics.items.map((total) => total.item),
    tokens,
  )
  const rowLine = (matched: MatchedBillingItem): BillingRowLine => ({
    id: matched.row.id,
    item: matched.row.item,
    colour: colours.get(matched.row.item) ?? tokens.deemphasis,
    date: matched.row.date,
    description: matched.row.description,
    client: matched.row.client,
    clientName: nameOf(matched.row.client),
    amount: matched.row.amount,
    open: matched.open,
    status: statusOf(matched.row.amount, matched.open),
    invoices: matched.invoices.map((share, index) => ({ key: `${share.invoice.id}-${index}`, number: share.invoice.number, amount: share.amount })),
  })

  const matchedRows = figures.matches
    .flatMap((match) => match.months.flatMap((month) => month.items))
    .filter((matched) => yearOf(matched.row.date) === year)
    .sort((earlier, later) => billingItemOrder(earlier.row, later.row))
  const rows = matchedRows.map(rowLine)
  const withoutPlan = figures.matches
    .flatMap((match) => match.withoutPlan)
    .filter((share) => yearOf(share.invoice.issued) === year)
    .map((share): WithoutPlanLine => ({
      key: share.invoice.id,
      number: share.invoice.number,
      clientName: nameOf(share.invoice.client),
      issued: share.invoice.issued,
      amount: share.amount,
    }))

  const months = monthsFrom(monthKey(year, 1), monthKey(year, 12)).map((month): BillingMonthLine => {
    const monthRows = rows.filter((row) => monthOf(row.date) === month)
    const withoutPlanLines = withoutPlan.filter((line) => monthOf(line.issued) === month)
    const planned = sumMoney(monthRows.map((row) => row.amount))
    const open = sumMoney(monthRows.map((row) => row.open))
    return {
      month,
      label: monthLabel(month),
      planned,
      invoiced: subtractMoney(planned, open),
      open,
      withoutPlan: sumMoney(withoutPlanLines.map((line) => line.amount)),
      status: monthRows.length === 0 ? null : statusOf(planned, open),
      rows: monthRows,
      withoutPlanLines,
    }
  })
  const listedMonths = months.filter((month) => month.rows.length > 0 || month.withoutPlanLines.length > 0)

  const yearTotals = figures.totals.years.find((entry) => entry.year === year) ?? { year, planned: ZERO, invoiced: ZERO }
  const openRows = rows.filter((row) => row.open > 0)
  const openInYear = sumMoney(openRows.map((row) => row.open))
  const issuedInYear = invoices.filter((invoice) => yearOf(invoice.issued) === year).length

  const all = figures.totals
  const yearStatistics = figures.statistics.years.find((entry) => entry.year === year)
  const items =
    yearStatistics?.items.map((entry) => ({
      item: entry.item,
      colour: colours.get(entry.item) ?? tokens.deemphasis,
      amount: entry.amount,
      share: yearStatistics.total === 0 ? 0 : entry.amount / yearStatistics.total,
    })) ?? []
  const largest = items[0]
  return {
    yearLine: {
      planned: yearTotals.planned,
      invoiced: yearTotals.invoiced,
      notInvoiced: openInYear,
      rowCount: rows.length,
      openRowCount: openRows.length,
      issuedInYear,
    },
    months: listedMonths,
    monthsSummary:
      listedMonths.length === 0
        ? words.view.noMonths
        : words.view.months(listedMonths.filter((month) => month.status === 'invoiced').length, listedMonths.filter((month) => month.status !== null).length, formatMoney(openInYear)),
    rowsSummary:
      rows.length === 0
        ? words.view.noRows
        : `${plural(words.view.rows(rows.length), rows.length)}, ${openRows.length === 0 ? words.view.everyInvoiced : plural(words.view.openRows(openRows.length), openRows.length)}`,
    rows: [...rows].sort((earlier, later) => later.date.localeCompare(earlier.date) || billingItemOrder(earlier, later)),
    items,
    itemsSummary: largest === undefined ? words.view.noItems(year) : plural(words.view.items(items.length, year, largest.item, formatPercent(largest.share)), items.length),
    itemsChart: itemYearsChart(
      figures.statistics.years,
      figures.statistics.items.map((total) => total.item),
      tokens,
    ),
    itemYears: figures.statistics.years.length,
    totalsSummary: words.view.totals(formatMoney(all.planned), formatMoney(all.invoiced)),
    check: {
      sums: [
        { label: words.view.totalAmount, amount: all.planned },
        { label: words.view.invoicedAmount, amount: all.invoiced },
        { label: words.view.notInvoiced, amount: all.notInvoiced },
      ],
      actual: all.years.filter((entry) => entry.invoiced !== 0).map((entry): BillingCheckLine => ({ label: String(entry.year), amount: entry.invoiced })),
    },
  }
}

export type BillingView = ReturnType<typeof billingView>

function statusOf(amount: Money, open: Money): BillingStatus {
  if (open === 0) return 'invoiced'
  return open === amount ? 'open' : 'part'
}
