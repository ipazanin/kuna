import { latestBalances } from '../../../../cash/domain/balances'
import { daysToPaid } from '../../../../receivables/domain/daysToPaid'
import { receivablesOf } from '../../../../receivables/domain/invoiceMatching'
import type { Asset } from '../assets/assets'
import { displayName } from '../../../../workbook/domain/displayName'
import { newestBookingOf } from '../../../../workbook/domain/workbook'
import type { Transaction } from '../../../../workbook/domain/workbook'
import type { HrDooWorkbook } from '../hrDooPart'
import { addDays, civilDate } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { addMonths, lastDayOf, monthKey, monthOf, yearOfMonth } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import { ZERO, negateMoney, subtractMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { withDrill } from '../accrual/accrualAdjustment'
import { outstandingFigure } from '../cit/matchCitPayments'
import type { MatchedCitObligation } from '../cit/matchCitPayments'
import { PACK_ROLES } from '../packRoles'
import { deducted, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { CategoryForecast, ForecastCalendar, ForecastLine, ForecastMonth } from './forecastLines'
import { words } from './words'

/** What moves the cash, each in the month it is paid or received. */
export type CashKind = 'open-invoices' | 'vat' | 'revenue' | 'costs' | 'purchases' | 'dividend' | 'corporate-tax' | 'carried-revenue' | 'carried-costs'

export interface CashEvent {
  readonly month: MonthKey
  readonly kind: CashKind
  /** Positive when money comes in. */
  readonly figure: TracedFigure
}

export interface CashMonth {
  readonly month: MonthKey
  /** From the bank balances for a month the ledger has passed, projected after it. */
  readonly basis: 'ledger' | 'forecast'
  /** At the end of the month. A projected month's steps start from the month before. */
  readonly closing: TracedFigure
}

/** How long clients take to pay, from the invoice matching: the median days from issue to payment. */
export interface PaymentLag {
  readonly days: number
  readonly label: string
}

export interface CashProjection {
  readonly months: readonly CashMonth[]
  readonly atYearEnd: TracedFigure
  /** Revenue of the year still to be received after it ends. */
  readonly receivableAtYearEnd: TracedFigure
  /** What the year leaves to the next one's cash: revenue received and costs paid after 31 December. */
  readonly later: readonly CashEvent[]
}

/** The planned dividend as it leaves the cash: its tax and what of the net is not set off against what the owner owes. */
export interface DividendCash {
  readonly month: MonthKey
  readonly cashOut: TracedFigure
}

export interface CashInputs {
  readonly year: number
  readonly calendar: ForecastCalendar
  /** The workbook as it stood on the day of the forecast. */
  readonly known: HrDooWorkbook
  readonly asOf: CivilDate
  readonly revenue: ForecastLine
  readonly categories: readonly CategoryForecast[]
  /** Purchases of the plan the ledger has not reached, kept as assets. */
  readonly plannedAssets: readonly Asset[]
  readonly dividend: DividendCash | null
  /** Every corporate tax obligation from the first tax period, matched to the bank rows. */
  readonly citObligations: readonly MatchedCitObligation[]
  readonly vatPosition: TracedFigure
  readonly paymentLag: PaymentLag
  /** The year before's projection, for a year the ledger has not reached. Null before the first tax period. */
  readonly carried: () => CashProjection | null
}

const KIND_LABELS: Readonly<Record<CashKind, string>> = words.cash.kinds

const KIND_ORDER: readonly CashKind[] = ['carried-revenue', 'carried-costs', 'open-invoices', 'vat', 'revenue', 'costs', 'purchases', 'dividend', 'corporate-tax']

/** The median days from issue to payment of every invoice paid so far, or a day when none is, so the revenue of a month comes in the month after. */
export function paymentLagOf(known: HrDooWorkbook): PaymentLag {
  const receivables = receivablesOf(known.transactions, known.categories, known.invoices, known.clients)
  const median = daysToPaid(
    receivables.clients.flatMap((client) => client.invoices),
    null,
  ).median
  return median === null ? { days: 1, label: words.cash.noInvoicePaid } : { days: Math.round(median), label: words.cash.clientsPay(Math.round(median)) }
}

/**
 * Cash at the end of each month of the year. A month the ledger has passed reads its bank balance.
 * The rest starts from cash on the newest booking, or from the year before's projection, and adds
 * each forecast month as it is paid: revenue when the client pays, its lag from the invoice matching
 * counted from the end of the month delivered, open invoices from their issue day, costs in their
 * month, costs paid in arrears in the month after, the VAT position the month after the newest
 * booking, planned purchases at their net cost, the planned dividend, and the corporate tax by its
 * due day. Costs paid ahead are already paid, and what the running month has paid so far is not
 * paid twice.
 */
export function cashProjection(inputs: CashInputs): CashProjection {
  const { year, calendar, known } = inputs
  const months = calendar.months
  const december = monthKey(year, 12)
  const balanceAt = (month: MonthKey): TracedFigure => {
    const cash = latestBalances(known.transactions.filter((row) => row.date <= lastDayOf(month))).cashOnHand
    return withDrill(tracedFigure(words.cash.atMonthEnd(monthLabel(month)), cash.amount, 'ledger', []), cash.drill)
  }
  if (calendar.lastComplete !== null && calendar.lastComplete >= december) {
    const ledgerMonths = months.map((month): CashMonth => ({ month, basis: 'ledger', closing: balanceAt(month) }))
    const atYearEnd = { ...(ledgerMonths[11] as CashMonth).closing, label: words.cash.atYearEnd(year) }
    const decemberRevenue = (inputs.revenue.months[11] as ForecastMonth).figure
    const receivableAtYearEnd = tracedFigure(words.cash.receivedAfter(year), decemberRevenue.amount, decemberRevenue.basis, decemberRevenue.rules, [decemberRevenue])
    return { months: ledgerMonths, atYearEnd, receivableAtYearEnd, later: [] }
  }

  const runsInYear = calendar.running !== null && yearOfMonth(calendar.running) === year
  const opensIn = runsInYear ? (calendar.running as MonthKey) : monthKey(year, 1)
  const start = runsInYear ? cashOnNewestBooking(known.transactions) : carriedStart(inputs)
  const events = [...(runsInYear ? nowEvents(inputs, opensIn) : carriedEvents(inputs)), ...forecastEvents(inputs, opensIn, runsInYear)]
  const inYear = events.filter((event) => event.month <= december)
  const later = events.filter((event) => event.month > december)

  let previous = start
  const projected = months.map((month): CashMonth => {
    if (month < opensIn) {
      return { month, basis: 'ledger', closing: balanceAt(month) }
    }
    const flows = KIND_ORDER.flatMap((kind) =>
      grouped(
        inYear.filter((event) => event.month === month && event.kind === kind),
        kind,
      ),
    )
    const closing = summed(
      words.cash.atMonthEndForecast(monthLabel(month)),
      [{ ...previous, label: month === opensIn ? previous.label : words.cash.atMonthEnd(monthLabel(addMonths(month, -1))) }, ...flows],
      'ledger',
    )
    previous = closing
    return { month, basis: 'forecast', closing }
  })
  const atYearEnd = summed(
    words.cash.atYearEndForecast(year),
    [
      start,
      ...KIND_ORDER.flatMap((kind) =>
        grouped(
          inYear.filter((event) => event.kind === kind),
          kind,
        ),
      ),
    ],
    'ledger',
  )
  const receivedLater = later.filter((event) => event.kind === 'revenue' || event.kind === 'open-invoices').map((event) => event.figure)
  return {
    months: projected,
    atYearEnd,
    receivableAtYearEnd: summed(words.cash.receivedAfter(year), receivedLater, 'ledger'),
    later,
  }
}

/** The bank balance on the newest booking, named with its day. */
export function cashOnNewestBooking(transactions: readonly Transaction[]): TracedFigure {
  const { cashOnHand } = latestBalances(transactions)
  return withDrill({ ...tracedFigure(words.cash.cashOn, cashOnHand.amount, 'ledger', []), on: newestBookingOf(transactions) }, cashOnHand.drill)
}

function grouped(events: readonly CashEvent[], kind: CashKind): TracedFigure[] {
  return events.length === 0
    ? []
    : [
        summed(
          KIND_LABELS[kind],
          events.map((event) => event.figure),
          'ledger',
        ),
      ]
}

function carriedStart({ year, carried }: CashInputs): TracedFigure {
  const before = carried()
  return before === null ? tracedFigure(words.cash.nothingBefore(year), ZERO, 'ledger', []) : before.atYearEnd
}

/** What the year before left to receive and to pay, in the month it lands. */
function carriedEvents({ year, carried }: CashInputs): CashEvent[] {
  const before = carried()
  return (before?.later ?? []).filter((event) => yearOfMonth(event.month) === year).map((event): CashEvent => ({ ...event, kind: event.figure.amount >= 0 ? 'carried-revenue' : 'carried-costs' }))
}

/** On the newest booking: the invoices still open, as their clients pay, and the VAT position, settled the month after. */
function nowEvents({ known, asOf, vatPosition, paymentLag }: CashInputs, running: MonthKey): CashEvent[] {
  const receivables = receivablesOf(known.transactions, known.categories, known.invoices, known.clients)
  const open = receivables.clients.flatMap((client) => client.invoices.filter((matched) => matched.remaining > 0))
  const invoices = open.map((matched): CashEvent => {
    const expected = addDays(matched.invoice.issued, paymentLag.days)
    const on = expected > asOf ? expected : addDays(asOf, 1)
    return { month: monthOf(on), kind: 'open-invoices', figure: { ...tracedFigure(words.cash.invoiceExpected(matched.invoice.number), matched.remaining, 'invoices', []), on } }
  })
  return [...invoices, { month: addMonths(running, 1), kind: 'vat', figure: { ...vatPosition, label: KIND_LABELS.vat } }]
}

function forecastEvents(inputs: CashInputs, opensIn: MonthKey, runsInYear: boolean): CashEvent[] {
  return [...revenueEvents(inputs), ...costEvents(inputs), ...purchaseEvents(inputs), ...dividendEvents(inputs), ...taxEvents(inputs, opensIn, runsInYear)]
}

function revenueEvents({ revenue, paymentLag }: CashInputs): CashEvent[] {
  return revenue.months.filter(isForecast).map((entry): CashEvent => {
    const on = addDays(lastDayOf(entry.month), paymentLag.days)
    return { month: monthOf(on), kind: 'revenue', figure: { ...tracedFigure(words.cash.revenueExpected(monthLabel(entry.month)), entry.figure.amount, entry.figure.basis, [], [entry.figure]), on } }
  })
}

function costEvents({ calendar, categories }: CashInputs): CashEvent[] {
  return categories.flatMap(({ category, forecast }) => {
    const arrears = category.roles.includes(PACK_ROLES.arrears)
    const name = displayName(category.slug, category.label)
    return forecast.months.filter(isForecast).flatMap((entry): CashEvent[] => {
      const amount = !arrears && entry.month === calendar.running ? afterPaidSoFar(entry) : entry.figure.amount
      if (amount === 0) {
        return []
      }
      const label = words.cash.cost(name, monthLabel(entry.month), arrears)
      return [{ month: arrears ? addMonths(entry.month, 1) : entry.month, kind: 'costs', figure: tracedFigure(label, amount, entry.figure.basis, [], [entry.figure]) }]
    })
  })
}

function purchaseEvents({ plannedAssets }: CashInputs): CashEvent[] {
  return plannedAssets.map((asset): CashEvent => ({
    month: monthOf(asset.bought),
    kind: 'purchases',
    figure: { ...tracedFigure(asset.name, negateMoney(asset.costNet), 'plan', []), on: asset.bought },
  }))
}

function dividendEvents({ dividend }: CashInputs): CashEvent[] {
  return dividend === null ? [] : [{ month: dividend.month, kind: 'dividend', figure: deducted(dividend.cashOut) }]
}

/**
 * The corporate tax due by the year end and not yet paid, in the month it is due, or the running
 * month when it is overdue. A later year takes only what falls due in it.
 */
function taxEvents({ year, citObligations }: CashInputs, opensIn: MonthKey, runsInYear: boolean): CashEvent[] {
  const yearEnd = civilDate(year, 12, 31)
  const yearBefore = civilDate(year - 1, 12, 31)
  return citObligations
    .filter((entry) => entry.outstanding > 0 && entry.obligation.dueOn <= yearEnd && (runsInYear || entry.obligation.dueOn > yearBefore))
    .map((entry): CashEvent => {
      const due = monthOf(entry.obligation.dueOn)
      return { month: due < opensIn ? opensIn : due, kind: 'corporate-tax', figure: deducted(outstandingFigure(entry)) }
    })
}

function isForecast(entry: ForecastMonth): boolean {
  return entry.bases.includes('planned') || entry.bases.includes('averaged')
}

/** What the running month still has to pay of its forecast, nothing once the ledger has paid that much. */
function afterPaidSoFar(entry: ForecastMonth): Money {
  const paid = entry.soFar?.amount ?? ZERO
  const left = subtractMoney(entry.figure.amount, paid)
  return Math.sign(left) === Math.sign(entry.figure.amount) ? left : ZERO
}
