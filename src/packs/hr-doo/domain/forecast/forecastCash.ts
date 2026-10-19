import { latestBalances } from '../../../../features/cash/domain/balances'
import { receivablesOf } from '../../../../features/receivables/domain/invoiceMatching'
import { newestBookingOf } from '../../../../features/workbook/domain/workbook'
import type { Transaction, Workbook } from '../../../../features/workbook/domain/workbook'
import { civilDate } from '../../../../shared/calendar/civilDate'
import { addMonths, monthKey, yearOfMonth } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { ZERO, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { withDrill } from '../accrual/accrualAdjustment'
import { outstandingFigure } from '../cit/matchCitPayments'
import type { MatchedCitObligation } from '../cit/matchCitPayments'
import { PACK_ROLES } from '../packRoles'
import { deducted, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { CategoryForecast, ForecastCalendar, ForecastLine, ForecastMonth } from './forecastLines'

/** What the year before leaves to the year's cash: its cash at the end, and the December figures that settle in January. */
export interface CarriedCash {
  readonly cashAtYearEnd: TracedFigure
  readonly decemberReceivable: TracedFigure
  readonly decemberArrears: TracedFigure
}

export interface CashInputs {
  readonly year: number
  readonly calendar: ForecastCalendar
  /** The workbook as it stood on the day of the forecast. */
  readonly known: Workbook
  readonly revenue: ForecastLine
  readonly categories: readonly CategoryForecast[]
  readonly plannedPurchases: ForecastLine
  /** Every corporate tax obligation from the first tax period, matched to the bank rows. */
  readonly citObligations: readonly MatchedCitObligation[]
  readonly vatPosition: TracedFigure
  /** The year before's forecast, for a year the ledger has not reached. Null before the first tax period. */
  readonly carried: () => CarriedCash | null
}

/**
 * Cash at the end of the year. A year the ledger has closed reads it from the balances. Otherwise
 * it starts from cash on the newest booking, with open invoices collected and the VAT position
 * settled by the year end, or from the year before's forecast. Then it adds the forecast months as
 * they would be paid: revenue in the month after, so December's comes in January, costs in their
 * month, costs paid in arrears in the month after, and the corporate tax due by 31 December. Costs
 * paid ahead are already paid, and what the running month has paid so far is not paid twice.
 */
export function cashAtYearEnd(inputs: CashInputs): TracedFigure {
  const { year, calendar, known } = inputs
  const december = monthKey(year, 12)
  if (calendar.lastComplete !== null && calendar.lastComplete >= december) {
    const cash = latestBalances(known.transactions.filter((row) => row.date <= civilDate(year, 12, 31))).cashOnHand
    return withDrill(tracedFigure(`Cash at the end of ${year}`, cash.amount, 'ledger', []), cash.drill)
  }
  const runsInYear = calendar.running !== null && yearOfMonth(calendar.running) === year
  const steps = [
    ...(runsInYear ? cashNow(inputs) : cashCarriedIn(inputs)),
    revenueStillToCome(inputs),
    costsStillToPay(inputs),
    purchasesStillToPay(inputs),
    taxStillToPay(inputs, runsInYear),
  ]
  return summed(`Cash at the end of ${year}, as forecast`, steps, 'ledger')
}

/** The bank balance on the newest booking, named with its day. */
export function cashOnNewestBooking(transactions: readonly Transaction[]): TracedFigure {
  const { cashOnHand } = latestBalances(transactions)
  return withDrill({ ...tracedFigure('Cash on', cashOnHand.amount, 'ledger', []), on: newestBookingOf(transactions) }, cashOnHand.drill)
}

function cashNow({ known, vatPosition }: CashInputs): TracedFigure[] {
  const receivables = receivablesOf(known.transactions, known.categories, known.invoices, known.clients)
  return [
    cashOnNewestBooking(known.transactions),
    tracedFigure('Invoices still open, paid by the year end', sumMoney(receivables.clients.map((client) => client.outstanding)), 'invoices', []),
    { ...vatPosition, label: 'VAT the state owes the company now, settled by the year end' },
  ]
}

function cashCarriedIn({ year, carried }: CashInputs): TracedFigure[] {
  const before = carried()
  if (before === null) {
    return [tracedFigure(`Nothing before ${year}`, ZERO, 'ledger', [])]
  }
  return [before.cashAtYearEnd, { ...before.decemberReceivable, label: `${before.decemberReceivable.label}, received in January` }, deducted(before.decemberArrears)]
}

function revenueStillToCome({ year, revenue }: CashInputs): TracedFigure {
  const december = monthKey(year, 12)
  const months = revenue.months.filter((entry) => isForecast(entry) && entry.month < december)
  return summed(
    'Revenue of the forecast months, paid the month after',
    months.map((entry) => entry.figure),
    'ledger',
  )
}

function costsStillToPay({ year, calendar, categories }: CashInputs): TracedFigure {
  const december = monthKey(year, 12)
  const perCategory = categories.flatMap(({ category, forecast }) => {
    const arrears = category.roles.includes(PACK_ROLES.arrears)
    const steps = forecast.months
      .filter((entry) => isForecast(entry) && (arrears ? addMonths(entry.month, 1) : entry.month) <= december)
      .map((entry) => {
        const stillToPay = !arrears && entry.month === calendar.running ? afterPaidSoFar(entry) : entry.figure.amount
        return tracedFigure(`${monthLabel(entry.month)}${arrears ? ', paid the month after' : ''}`, stillToPay, entry.figure.basis, [], [entry.figure])
      })
      .filter((step) => step.amount !== 0)
    return steps.length === 0 ? [] : [summed(category.label ?? category.slug, steps, 'ledger')]
  })
  return summed('Costs and other income of the forecast months, as they are paid', perCategory, 'ledger')
}

function purchasesStillToPay({ plannedPurchases }: CashInputs): TracedFigure {
  return deducted(summed('Small purchases planned', plannedPurchases.months.filter(isForecast).map((entry) => entry.figure), 'plan'))
}

function taxStillToPay({ year, citObligations }: CashInputs, runsInYear: boolean): TracedFigure {
  const yearEnd = civilDate(year, 12, 31)
  const owing = citObligations.filter(
    (entry) => entry.outstanding > 0 && entry.obligation.dueOn <= yearEnd && (runsInYear || entry.obligation.dueOn > civilDate(year - 1, 12, 31)),
  )
  return deducted(
    summed(
      'Corporate tax still to pay by the year end',
      owing.map(outstandingFigure),
      'ledger',
    ),
  )
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
