import type { RouteLocationRaw } from 'vue-router'

import { yearOf } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { monthKey, monthOf, monthsFrom } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { monthLabel } from '../../../shared/calendar/monthLabel'
import { ZERO, subtractMoney, sumMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { formatWholeMoney } from '../../../shared/money/moneyFormat'
import type { ChartTokens } from '../../../shared/charts/chartTokens'
import type { Client, Invoice } from '../../workbook/domain/workbook'
import type { BillingPlanFigures } from '../application/useBillingPlan'
import type { MatchedBillingItem } from '../domain/plannedAgainstInvoiced'
import { itemColours, itemYearsChart } from './billingCharts'

export type BillingStatus = 'invoiced' | 'part' | 'open'

/** How a row or a month reads by what the invoices billed of it. */
export const BILLING_STATUS: Readonly<Record<BillingStatus, { readonly label: string; readonly color: 'success' | 'warning' | 'neutral' }>> = {
  invoiced: { label: 'Invoiced', color: 'success' },
  part: { label: 'Part invoiced', color: 'warning' },
  open: { label: 'Not invoiced yet', color: 'neutral' },
}

export interface BillingInvoiceShare {
  readonly key: string
  readonly number: string
  readonly amount: Money
}

/** One plan row with what the invoices billed of it. */
export interface BillingRowLine {
  readonly key: string
  readonly sheetRow: number
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
  readonly key: string
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

export interface BillingTile {
  readonly label: string
  readonly value: string
  readonly caption: string
  readonly definition: string
  readonly to: RouteLocationRaw | null
}

export interface BillingCheckLine {
  readonly label: string
  readonly amount: Money
}

export interface BillingLinks {
  /** A month in the list of months, opened. */
  month(month: MonthKey): RouteLocationRaw
  readonly rows: RouteLocationRaw
  readonly months: RouteLocationRaw
}

/** Every year a plan row or an invoice falls in, and the year of the newest booking, oldest first. */
export function billingYears(figures: BillingPlanFigures, asOf: CivilDate): number[] {
  return [...new Set([...figures.totals.years.map((entry) => entry.year), yearOf(asOf)])].sort((earlier, later) => earlier - later)
}

/** What the Billing plan screen shows for one year, seen on `asOf`. */
export function billingView(
  figures: BillingPlanFigures,
  register: { readonly clients: readonly Client[]; readonly invoices: readonly Invoice[] },
  year: number,
  links: BillingLinks,
  tokens: ChartTokens,
) {
  const { clients, invoices } = register
  const nameOf = (slug: string): string => clients.find((client) => client.slug === slug)?.name || slug
  const colours = itemColours(
    figures.statistics.items.map((total) => total.item),
    tokens,
  )
  const rowLine = (matched: MatchedBillingItem): BillingRowLine => ({
    key: `${matched.row.client}-${matched.row.sheetRow}`,
    sheetRow: matched.row.sheetRow,
    item: matched.row.item,
    colour: colours.get(matched.row.item) ?? tokens.deemphasis,
    date: matched.row.date,
    description: matched.row.description,
    client: matched.row.client,
    clientName: nameOf(matched.row.client),
    amount: matched.row.amount,
    open: matched.open,
    status: statusOf(matched.row.amount, matched.open),
    invoices: matched.invoices.map((share, index) => ({ key: `${share.invoice.client}-${share.invoice.sheetRow}-${index}`, number: share.invoice.number, amount: share.amount })),
  })

  const matchedRows = figures.matches
    .flatMap((match) => match.months.flatMap((month) => month.items))
    .filter((matched) => yearOf(matched.row.date) === year)
    .sort((earlier, later) => earlier.row.date.localeCompare(later.row.date) || earlier.row.sheetRow - later.row.sheetRow)
  const rows = matchedRows.map(rowLine)
  const withoutPlan = figures.matches
    .flatMap((match) => match.withoutPlan)
    .filter((share) => yearOf(share.invoice.issued) === year)
    .map(
      (share): WithoutPlanLine => ({
        key: `${share.invoice.client}-${share.invoice.sheetRow}`,
        number: share.invoice.number,
        clientName: nameOf(share.invoice.client),
        issued: share.invoice.issued,
        amount: share.amount,
      }),
    )

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
  const next = figures.expected[0] ?? null
  const issuedInYear = invoices.filter((invoice) => yearOf(invoice.issued) === year).length

  const tiles: BillingTile[] = [
    {
      label: `Planned in ${year}`,
      value: formatWholeMoney(yearTotals.planned),
      caption: rows.length === 0 ? 'No plan rows in the year' : `${rows.length} ${rows.length === 1 ? 'plan row' : 'plan rows'}`,
      definition: 'Every row of the outgoing-plan tab dated in the year, by the day it becomes billable.',
      to: links.rows,
    },
    {
      label: `Invoiced in ${year}`,
      value: formatWholeMoney(yearTotals.invoiced),
      caption: `${issuedInYear} ${issuedInYear === 1 ? 'invoice' : 'invoices'} issued in the year`,
      definition: 'Every invoice on the invoices tab issued in the year, whether it billed plan rows of this year, of last year, or none.',
      to: links.months,
    },
    {
      label: 'Not yet invoiced',
      value: formatWholeMoney(openInYear),
      caption: openRows.length === 0 ? `Every ${year} plan row is invoiced` : `${openRows.length} ${openRows.length === 1 ? 'row' : 'rows'} of ${year} still open`,
      definition:
        'What the invoices have not billed of the plan rows dated in the year. Each client’s invoices bill its rows oldest first, up to the end of the month they were issued in, and the next month’s rows with €1 or more left.',
      to: links.months,
    },
    {
      label: 'Next expected invoice',
      value: next === null ? '–' : formatWholeMoney(next.amount),
      caption: next === null ? 'Every plan row is invoiced' : `${monthLabel(next.month)}, ${nameOf(next.client)}`,
      definition: 'The oldest month with plan rows no invoice has billed yet, for one client. Months after it follow in the list.',
      to: next === null ? null : links.month(next.month),
    },
  ]

  const all = figures.totals
  const yearStatistics = figures.statistics.years.find((entry) => entry.year === year)
  return {
    tiles,
    months: listedMonths,
    monthsSummary:
      listedMonths.length === 0
        ? 'No month with plan rows'
        : `${listedMonths.length} ${listedMonths.length === 1 ? 'month' : 'months'}, ${formatWholeMoney(yearTotals.planned)} planned, ${formatWholeMoney(openInYear)} not invoiced yet`,
    rowsSummary:
      rows.length === 0
        ? 'No plan rows in the year'
        : `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}, ${openRows.length === 0 ? 'every one invoiced' : `${openRows.length} not invoiced yet`}`,
    rows: [...rows].sort((earlier, later) => later.date.localeCompare(earlier.date) || earlier.sheetRow - later.sheetRow),
    items:
      yearStatistics?.items.map((entry) => ({
        item: entry.item,
        colour: colours.get(entry.item) ?? tokens.deemphasis,
        amount: entry.amount,
        share: yearStatistics.total === 0 ? 0 : entry.amount / yearStatistics.total,
      })) ?? [],
    itemsChart: itemYearsChart(
      figures.statistics.years,
      figures.statistics.items.map((total) => total.item),
      tokens,
    ),
    itemYears: figures.statistics.years.length,
    check: {
      sums: [
        { label: 'Total amount', amount: all.planned },
        { label: 'Invoiced amount', amount: all.invoiced },
        { label: 'Not invoiced', amount: all.notInvoiced },
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
