import { latestBalances } from '../../../../features/cash/domain/balances'
import { drillToTransactions } from '../../../../features/filters/domain/drillTarget'
import { RECEIVABLE_ROLES } from '../../../../features/receivables/domain/invoiceMatching'
import type { DefinedBucket } from '../../../../features/workbook/domain/bucket'
import type { YearEndLine } from '../yearEnd/yearEnd'
import type { Transaction } from '../../../../features/workbook/domain/workbook'
import type { HrDooWorkbook } from '../hrDooPart'
import { civilDate, yearOf } from '../../../../shared/calendar/civilDate'
import { monthKey, monthOf, yearOfMonth } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney, negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import type { AssetBooks } from '../assets/assetBooks'
import { bookValueOn } from '../assets/depreciationSchedule'
import type { CitLiability } from '../cit/citLiability'
import { deferredOn } from '../grants/grantRelease'
import type { GrantYearCheck } from '../grants/grantRelease'
import { netOwed, ownerAdvances } from '../ownerAdvances'
import { ownerLoans } from '../ownerLoans'
import { PACK_ROLES } from '../packRoles'
import { deducted, rulesOf, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import type { AccrualAdjustment, AdjustmentId } from './accrualAdjustment'
import { withDrill } from './accrualAdjustment'
import { bookingFigure, hasVat, isCounted } from './accrualBookings'
import type { AccrualBooking, CapitalisedBooking, CountedBooking } from './accrualBookings'
import { moneyLine } from './accrualLines'
import type { MoneyLine } from './accrualLines'
import { placementJudgement } from './closedYear'
import { revenueByDelivery } from './revenueByDelivery'

export interface BalanceSheetContext {
  readonly workbook: HrDooWorkbook
  readonly year: number
  /** With any cut-off already applied. */
  readonly bookings: readonly AccrualBooking[]
  readonly books: AssetBooks
  readonly grantChecks: readonly GrantYearCheck[]
  readonly liability: CitLiability
  readonly profitAfterTax: TracedFigure
  /** The judgements the profit after tax rests on. */
  readonly profitJudgements: readonly AdjustmentId[]
  readonly cutOffCategories: ReadonlySet<string>
  readonly firstPeriod: boolean
  readonly rules: RuleSource
}

export interface BalanceSheet {
  readonly lines: readonly MoneyLine[]
  readonly placements: readonly AccrualAdjustment[]
  /** Before any placement moves part of another liability onto its line. */
  readonly grantDeferred: MoneyLine
}

const LIABILITY_LINES = ['payables-suppliers', 'payables-employees', 'payables-taxes', 'payables-loans', 'accruals-deferred-income'] as const
const RECEIVABLE_LINES = ['receivables-trade', 'receivables-members-employees', 'receivables-state', 'receivables-other', 'prepaid-accrued-income'] as const

/**
 * The balance sheet at 31 December. Share capital is what the balance sheet leaves once the other
 * lines are in, so it equals the capital paid in only while every other line is right.
 */
export function balanceSheetLines(context: BalanceSheetContext): BalanceSheet {
  const { workbook, year, bookings, books, rules } = context
  const yearEnd = civilDate(year, 12, 31)
  const rows = workbook.transactions.filter((row) => row.date <= yearEnd)
  const roleRows = (...roles: string[]) => {
    const slugs = workbook.categories.filter((category) => roles.some((role) => category.roles.includes(role))).map((category) => category.slug)
    return rows.filter((row) => slugs.includes(row.category))
  }
  const toYearEnd = { from: rows.reduce((earliest, row) => (row.date < earliest ? row.date : earliest), yearEnd), to: yearEnd }
  const rowsFigure = (label: string, chosen: readonly Transaction[]) =>
    withDrill(
      tracedFigure(label, sumMoney(chosen.map((row) => row.amount)), 'ledger', []),
      drillToTransactions({ period: { preset: 'custom', range: toYearEnd }, categories: [...new Set(chosen.map((row) => row.category))] }),
    )
  const cutOffBuckets = new Set(workbook.categories.filter((category) => context.cutOffCategories.has(category.slug)).map((category) => category.bucket))
  const cutOffOn = (bucket: DefinedBucket): AdjustmentId[] => (cutOffBuckets.has(bucket) ? ['arrears-cut-off'] : [])

  const tangible = summed(
    'Book value of the assets',
    books.schedules.map((schedule) => ({ ...bookValueOn(schedule, yearEnd), label: `${schedule.asset.name}, book value`, on: null })).filter((figure) => figure.amount !== 0),
    'assets',
  )

  const invoiceYears = workbook.invoices.map((invoice) => yearOf(invoice.deliveryPeriod?.from ?? invoice.issued))
  const firstInvoiceYear = Math.min(year, ...invoiceYears)
  const deliveredYears = Array.from({ length: year - firstInvoiceYear + 1 }, (_, offset) => revenueByDelivery(workbook.invoices, firstInvoiceYear + offset, rules))
  const delivered = summed('Revenue delivered to the year end', deliveredYears.map((entry) => entry.total), 'invoices')
  const accruedIncome = summed(
    'Delivered by the year end on invoices issued after it',
    deliveredYears.flatMap((entry) => entry.invoices.filter((invoice) => invoice.invoice.issued > yearEnd).map((invoice) => invoice.revenue)),
    'invoices',
  )
  const received = rowsFigure('Client payments to the year end', roleRows(PACK_ROLES.revenue, RECEIVABLE_ROLES.clientRefund))
  const tradeSteps = [delivered, deducted(received), deducted(accruedIncome)]
  const receivablesTrade = tracedFigure('Invoiced and not yet paid', sumMoney(tradeSteps.map((step) => step.amount)), 'invoices', rulesOf(tradeSteps), tradeSteps)

  const advances = workbook.ownerAdvances.filter((advance) => advance.date <= yearEnd)
  const owed = netOwed(ownerLoans(rows, workbook.categories), ownerAdvances(advances, rows, workbook.categories), workbook.categories)
  const owedFigure = withDrill(tracedFigure('Owed by the owner on loans and advances, net', owed.amount, 'ledger', []), owed.drill)

  const vat = vatPosition(bookings, monthKey(year, 12), rowsFigure('VAT refunded less VAT paid to the year end', roleRows(PACK_ROLES.vatSettlement)))

  const citOwed = citOwedAt(context, rows, roleRows(PACK_ROLES.corporateIncomeTax))

  const counted = bookings.filter(isCounted)
  const accrued = counted.filter((entry) => entry.timing === 'arrears' && entry.booking.date > yearEnd && entry.shares.some((share) => yearOfMonth(share.month) <= year))
  const accruedIn = (bucket: DefinedBucket) =>
    accrued
      .filter((entry) => entry.booking.bucket === bucket)
      .map((entry) => bookingFigure(entry, negateMoney(entry.booking.amount)))
  const prepaid = counted
    .filter((entry) => entry.timing === 'prepaid' && entry.booking.date <= yearEnd)
    .map((entry) =>
      bookingFigure(entry, negateMoney(sumMoney(entry.shares.filter((share) => yearOfMonth(share.month) > year).map((share) => share.amount)))),
    )
    .filter((figure) => figure.amount !== 0)

  const policyDeferred = summed('Grant deferred by our policy', books.grants.map((schedule) => deferredOn(schedule, yearEnd)), 'assets')
  const judgedReleases = context.grantChecks.flatMap((check) =>
    check.year <= year && check.released !== null && check.released.residual.amount !== 0
      ? [deducted({ ...check.released.residual, label: `Released in ${check.year} as the accountant released it` })]
      : [],
  )
  const deferred = summed('Grant deferred', [policyDeferred, ...judgedReleases], 'assets')
  const deferredJudgements: AdjustmentId[] = judgedReleases.length > 0 ? ['grant-schedule'] : []

  const positive = (figure: TracedFigure) => (figure.amount > 0 ? [figure] : [])
  const negativeAsOwed = (figure: TracedFigure, label: string) => (figure.amount < 0 ? [tracedFigure(label, negateMoney(figure.amount), figure.basis, figure.rules, [figure])] : [])

  const ours = new Map<string, { figure: TracedFigure; judgements: AdjustmentId[] }>()
  const put = (line: string, figure: TracedFigure, judgements: readonly AdjustmentId[] = []) => ours.set(line, { figure, judgements: [...judgements] })
  const nothing = (label: string) => tracedFigure(label, ZERO, 'ledger', [])

  put('intangible-assets', nothing('No intangible asset group on the assets tab'))
  put('tangible-assets', tangible)
  put('financial-assets', nothing('No category role records financial assets'))
  put('inventories', nothing('No category role records inventories'))
  put('receivables-trade', receivablesTrade)
  put('receivables-members-employees', summed('Receivable from the owner', positive(owedFigure), 'ledger'))
  put(
    'receivables-state',
    summed('Receivable from the state', [...positive(vat), ...negativeAsOwed(citOwed, 'Corporate tax overpaid')], 'ledger'),
    citOwed.amount < 0 ? context.profitJudgements : [],
  )
  put('receivables-other', nothing('No category role records other receivables'))
  const cash = latestBalances(rows).cashOnHand
  put('cash', withDrill(tracedFigure('Cash at the year end', cash.amount, 'ledger', []), cash.drill))
  put('prepaid-accrued-income', summed('Paid ahead and earned but not yet invoiced', [...prepaid, ...positive(accruedIncome)], 'ledger'))

  put('provisions', nothing('No category role records provisions'))
  put('long-term-liabilities', nothing('No category role records long-term liabilities'))
  put('payables-suppliers', summed('Owed to suppliers for the year, paid after it', accruedIn('operating'), 'ledger'), cutOffOn('operating'))
  put('payables-employees', summed('Owed to the owner and employees', [...accruedIn('owner-pay'), ...negativeAsOwed(owedFigure, 'Owed to the owner, net')], 'ledger'), cutOffOn('owner-pay'))
  put('payables-taxes', summed('Taxes and contributions owed', [...accruedIn('taxes'), ...positive(citOwed), ...negativeAsOwed(vat, 'VAT owed')], 'ledger'), [
    ...cutOffOn('taxes'),
    ...(citOwed.amount > 0 ? context.profitJudgements : []),
  ])
  put('payables-loans', nothing('No category role records loans to the company'))
  put('accruals-deferred-income', deferred, deferredJudgements)

  const beforePlacement = new Map([...ours].map(([line, entry]) => [line, entry.judgements] as const))
  const placements = [
    placementJudgement('receivable-placement', 'Receivables split over the lines as the accountant splits them', 'balance', amountsOf(ours, RECEIVABLE_LINES), year, workbook.yearEndLines),
    placementJudgement('liability-placement', 'Liabilities split over the lines as the accountant splits them', 'balance', amountsOf(ours, LIABILITY_LINES), year, workbook.yearEndLines),
  ].flatMap((placement) => (placement === null ? [] : [placement]))
  for (const placement of placements) {
    for (const [line, move] of placement.moves) {
      const entry = ours.get(line)
      if (entry !== undefined) {
        const placed = summed(entry.figure.label, [entry.figure, tracedFigure('As the accountant places it', move, 'accountant', [])], entry.figure.basis)
        put(line, placed, [...entry.judgements, placement.adjustment.id])
      }
    }
  }

  const assetLines = ['intangible-assets', 'tangible-assets', 'financial-assets', 'inventories', ...RECEIVABLE_LINES, 'cash']
  const liabilityLines = ['provisions', 'long-term-liabilities', ...LIABILITY_LINES]
  const totalOf = (label: string, lines: readonly string[]) => summed(label, lines.flatMap((line) => ours.get(line)?.figure ?? []), 'ledger')
  const judgementsOf = (lines: readonly string[]) => lines.flatMap((line) => beforePlacement.get(line) ?? [])
  const totalAssets = totalOf('Total assets', assetLines)
  put('total-assets', totalAssets, judgementsOf(assetLines))
  put('profit-of-year', context.profitAfterTax, context.profitJudgements)

  const equity = broughtForward(context)
  if (equity !== null) {
    put('reserves', equity.reserves)
    put('retained-earnings', equity.retained)
    const liabilities = totalOf('Liabilities, provisions and deferred income', liabilityLines)
    const steps = [totalAssets, deducted(liabilities), deducted(context.profitAfterTax), deducted(equity.retained), deducted(equity.reserves)]
    const shareCapital = tracedFigure('Share capital: what the balance sheet leaves for it', sumMoney(steps.map((step) => step.amount)), 'ledger', rulesOf(steps), steps)
    put('share-capital', shareCapital, [...judgementsOf([...assetLines, ...liabilityLines]), ...context.profitJudgements])
  }

  return {
    lines: [...ours].map(([line, entry]) => moneyLine('balance', line, entry.figure, entry.judgements)),
    placements: placements.map((placement) => placement.adjustment),
    grantDeferred: moneyLine('grant', 'deferred-at-year-end', deferred, deferredJudgements),
  }
}

/**
 * Input VAT on the bookings whose VAT return month is `through` or earlier, less what `settled`
 * refunded or paid. Positive means the state owes the company.
 */
export function vatPosition(bookings: readonly AccrualBooking[], through: MonthKey, settled: TracedFigure): TracedFigure {
  const entries = bookings.filter(hasVat).filter((entry) => entry.vat.inputVat.amount !== 0 && vatMonthOf(entry) <= through)
  const inputVat = tracedFigure(
    `Input VAT to the end of ${monthLabel(through)}`,
    negateMoney(sumMoney(entries.map((entry) => entry.vat.inputVat.amount))),
    'ledger',
    rulesOf(entries.map((entry) => entry.vat.inputVat)),
  )
  return tracedFigure('VAT the state owes the company', subtractMoney(inputVat.amount, settled.amount), 'ledger', inputVat.rules, [inputVat, deducted(settled)])
}

/** The month whose VAT return holds a booking's input VAT: the month worked for a cost paid in arrears, else the month paid. */
function vatMonthOf(entry: CountedBooking | CapitalisedBooking): MonthKey {
  return entry.treatment === 'counted' && entry.timing === 'arrears' ? (entry.shares[0]?.month ?? monthOf(entry.booking.date)) : monthOf(entry.booking.date)
}

/** Corporate tax of every year to this one, less what was paid on it by the year end. */
function citOwedAt(context: BalanceSheetContext, rows: readonly Transaction[], paidRows: readonly Transaction[]): TracedFigure {
  const { workbook, year, liability } = context
  const registered = workbook.companyFacts.companyRegistered
  const firstYear = registered !== null ? yearOf(registered) : Math.min(year, ...rows.map((row) => yearOf(row.date)))
  const earlier = Array.from({ length: year - firstYear }, (_, offset) => firstYear + offset).map((taxYear) => {
    const line = workbook.yearEndLines.find((candidate) => candidate.year === taxYear && candidate.statement === 'tax' && candidate.line === 'liability')
    return line?.figure.kind === 'money'
      ? tracedFigure(`Corporate tax for ${taxYear}, as the accountant filed it`, line.figure.amount, 'accountant', [])
      : tracedFigure(`Corporate tax for ${taxYear}: no year-end liability line, so nothing`, ZERO, 'accountant', [])
  })
  const paid = tracedFigure('Corporate tax paid to the year end', negateMoney(sumMoney(paidRows.map((row) => row.amount))), 'ledger', [])
  const steps = [...earlier, liability.liability, deducted(paid)]
  return tracedFigure('Corporate tax owed', sumMoney(steps.map((step) => step.amount)), 'ledger', rulesOf(steps), steps)
}

/**
 * Reserves and retained earnings at the year end: nothing in a first period, else the prior year's
 * from its year-end lines, with its profit added, what its decision put to reserves moved, and the
 * profit paid out this year taken off. Null when the prior year has no such lines.
 */
function broughtForward(context: BalanceSheetContext): { readonly reserves: TracedFigure; readonly retained: TracedFigure } | null {
  if (context.firstPeriod) {
    return { reserves: tracedFigure('No reserves in a first period', ZERO, 'ledger', []), retained: tracedFigure('Nothing retained in a first period', ZERO, 'ledger', []) }
  }
  const opening = equityBroughtForward(context.workbook.yearEndLines, context.year)
  if (opening === null) {
    return null
  }
  const paidOut = context.bookings.filter((entry) => entry.treatment === 'profit-distribution' && yearOf(entry.booking.date) === context.year)
  const paid = tracedFigure('Profit paid out in the year, with its tax', negateMoney(sumMoney(paidOut.map((entry) => entry.booking.amount))), 'ledger', [])
  const steps = [opening.retained, deducted(paid)]
  return {
    reserves: opening.reserves,
    retained: tracedFigure('Retained earnings', sumMoney(steps.map((step) => step.amount)), 'ledger', [], steps),
  }
}

/**
 * Reserves and retained earnings at the start of a year, before anything is paid out in it: the
 * year before's retained earnings and profit from its year-end lines, less what its decision put
 * to reserves. Null when the year before has no such lines.
 */
export function equityBroughtForward(yearEndLines: readonly YearEndLine[], year: number): { readonly reserves: TracedFigure; readonly retained: TracedFigure } | null {
  const prior = year - 1
  const priorMoney = (statement: string, line: string): Money | null => {
    const found = yearEndLines.find((candidate) => candidate.year === prior && candidate.statement === statement && candidate.line === line)
    return found?.figure.kind === 'money' ? found.figure.amount : null
  }
  const retained = priorMoney('balance', 'retained-earnings')
  const profit = priorMoney('balance', 'profit-of-year')
  if (retained === null || profit === null) {
    return null
  }
  const toReserves = priorMoney('distribution', 'reserves') ?? ZERO
  const steps = [
    tracedFigure(`Retained at the end of ${prior}`, retained, 'accountant', []),
    tracedFigure(`Profit of ${prior}`, profit, 'accountant', []),
    deducted(tracedFigure(`Put to reserves from the profit of ${prior}`, toReserves, 'accountant', [])),
  ]
  return {
    reserves: tracedFigure('Reserves', addMoney(priorMoney('balance', 'reserves') ?? ZERO, toReserves), 'accountant', []),
    retained: tracedFigure(`Retained at the start of ${year}`, sumMoney(steps.map((step) => step.amount)), 'accountant', [], steps),
  }
}

function amountsOf(ours: ReadonlyMap<string, { readonly figure: TracedFigure }>, lines: readonly string[]): ReadonlyMap<string, Money> {
  return new Map(lines.flatMap((line) => (ours.has(line) ? [[line, ours.get(line)!.figure.amount] as const] : [])))
}
