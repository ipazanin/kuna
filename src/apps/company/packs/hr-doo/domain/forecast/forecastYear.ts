import { expectedInvoices } from '../../../../billingPlan/domain/expectedInvoices'
import type { ExpectedInvoice } from '../../../../billingPlan/domain/expectedInvoices'
import { drillToTransactions } from '../../../../filters/domain/drillTarget'
import { BUCKET_COLOUR } from '../../../../workbook/domain/categoryColour'
import { displayName } from '../../../../workbook/domain/displayName'
import type { Asset } from '../assets/assets'
import { PLAN_KEYWORDS } from './plan'
import type { PlanLine } from './plan'
import { ledgerWindowOf } from '../../../../workbook/domain/workbook'
import type { Category, Invoice } from '../../../../workbook/domain/workbook'
import type { HrDooWorkbook } from '../hrDooPart'
import { yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { addMonths, firstDayOf, monthKey, monthNumber, monthOf, monthsFrom, yearOfMonth } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import { ZERO, divideMoney, negateMoney, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { withDrill } from '../accrual/accrualAdjustment'
import { vatPosition } from '../accrual/accrualBalanceSheet'
import { accrualBookings, bookingFigure, countsInProfit, isCounted } from '../accrual/accrualBookings'
import type { CountedBooking } from '../accrual/accrualBookings'
import { arrearsCutOff, bookingsAfterCutOff } from '../accrual/closedYear'
import { COST_LINES, COST_LINE_LABELS, costLineOf } from '../accrual/costLines'
import type { CostLine } from '../accrual/costLines'
import { revenueByDelivery } from '../accrual/revenueByDelivery'
import type { DeliveredRevenue, UninvoicedMonth } from '../accrual/revenueByDelivery'
import { assetBooks, depreciationAboveAllowed } from '../assets/assetBooks'
import type { AssetBooks } from '../assets/assetBooks'
import { citLiability, taxPeriodOf } from '../cit/citLiability'
import type { CitLiability, TaxPeriod } from '../cit/citLiability'
import { citSchedule, firstAdvanceAtNewAmount } from '../cit/citSchedule'
import type { CitObligation, CitSchedule } from '../cit/citSchedule'
import { matchCitPayments, outstandingFigure } from '../cit/matchCitPayments'
import type { MatchedCitObligation } from '../cit/matchCitPayments'
import { closedYearReturn } from '../cit/priorReturn'
import type { PriorReturn } from '../cit/priorReturn'
import { lossesCarriedInto, taxBase } from '../cit/taxBase'
import type { TaxBase, TaxBaseInput } from '../cit/taxBase'
import { owedByOwnerOn } from '../dividend/owedByOwner'
import { relatedPartyInterest } from '../ownerLoanInterest'
import { PACK_ROLES, categoriesWithRole, isOwnerPayCost } from '../packRoles'
import type { PackRole } from '../packRoles'
import { atRate, deducted, percentText, rulesOf, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { salaryDropped } from '../scenarios/scenarioOutcome'
import type { ScenarioWarning } from '../scenarios/scenarioOutcome'
import type { Employee } from '../employees/employees'
import { payrollDirector } from '../employees/employees'
import { scenarioPay } from '../scenarios/scenarioPay'
import type { ScenarioPay } from '../scenarios/scenarioPay'
import { cashProjection, paymentLagOf } from './forecastCash'
import type { CashMonth, CashProjection, DividendCash, PaymentLag } from './forecastCash'
import { ARREARS_AVERAGED_MONTHS, AVERAGED_MONTHS, addedUpLine, forecastLine, monthOfLine, scheduledLine } from './forecastLines'
import type { CategoryForecast, ForecastCalendar, ForecastLine, ForecastPlLine, LinePart } from './forecastLines'
import { ownerPayPlan, planGuards } from './planGuards'
import type { PlanGuard, PlannedOwnerPay } from './planGuards'

/** The corporate tax of the forecast year: what its schedule expects, what the bank rows paid, and what it leaves to the next year. */
export interface CitForecast {
  /** The year's own schedule: the balance due of the year before and the year's advances, matched to the bank rows. */
  readonly obligations: readonly MatchedCitObligation[]
  /** Every obligation from the first tax period to the year's own schedule, matched to the bank rows, by due date. */
  readonly history: readonly MatchedCitObligation[]
  readonly advancesPaid: TracedFigure
  readonly advancesToCome: TracedFigure
  /** The year after's schedule, on the year's return from the year-end tab when it holds one, else on the forecast liability. */
  readonly nextYear: CitSchedule
  /** The balance the year's return leaves to pay, on its filing deadline. Null when nothing is left. */
  readonly balanceDue: CitObligation | null
  /** The first advance at the year's own monthly amount. Null when the liability sets none. */
  readonly newAdvance: CitObligation | null
  /** Payments on corporate tax categories no obligation took, and refunds, which read negative. */
  readonly unmatched: readonly TracedFigure[]
}

/** A plan row the forecast does not count, with why. */
export interface UnmodelledPlanLine {
  readonly line: PlanLine
  readonly reason: string
}

/** The owner pay a plan's scenarios set for the months the ledger has not settled, in place of the owner pay categories. */
export interface OwnerPayForecast {
  readonly plan: PlannedOwnerPay
  readonly pay: ScenarioPay
  /** The salary with its health contribution and the tax-free items, then the rent when the scenarios pay any. */
  readonly lines: readonly CategoryForecast[]
  /** The owner pay categories' last month the ledger settles. Later months follow the scenarios. */
  readonly lastActual: MonthKey | null
  /** Each grant whose employment condition the planned pay breaks, with the first day without a salary. */
  readonly salaryDropped: readonly SalaryDropped[]
}

export type SalaryDropped = Extract<ScenarioWarning, { readonly kind: 'salary-dropped' }>

/** The plan's dividend of the year, in a month the ledger has not reached. */
export interface PlannedDividend {
  readonly line: PlanLine
  readonly month: MonthKey
  readonly gross: TracedFigure
  readonly tax: TracedFigure
  /** What of the net settles what the owner owes the company on the day of the forecast. */
  readonly setOff: TracedFigure
  readonly cashOut: TracedFigure
}

/** How long cash at the year end lasts at the costs of the year's last three months, as Overview counts runway. */
export interface ForecastRunway {
  /** Null when those months cost nothing. */
  readonly months: number | null
  readonly cash: TracedFigure
  readonly monthlyCost: TracedFigure
}

export interface YearForecast {
  readonly year: number
  /** Ledger rows, owner advances and invoices after this day are left out. */
  readonly asOf: CivilDate
  readonly period: TaxPeriod
  readonly calendar: ForecastCalendar
  /**
   * Client revenue by delivery period. A later month, or a complete one no invoice delivers in yet,
   * takes the billing plan's expected invoices dated in it, else the average.
   */
  readonly revenue: ForecastLine
  /** Every other category the accrual view counts in profit, in the order of the categories tab, then the owner pay lines of the plan's scenarios. */
  readonly categories: readonly CategoryForecast[]
  readonly ownerPay: OwnerPayForecast | null
  readonly depreciation: ForecastLine
  /** Assets at or below the threshold, written off when put in use, planned purchases among them. */
  readonly smallInventory: ForecastLine
  /** Book value written off when an asset is disposed of. */
  readonly disposals: ForecastLine
  /** Purchases on the plan tab the ledger has not reached, kept as assets so the asset engine depreciates them or writes them off. */
  readonly plannedAssets: readonly Asset[]
  readonly plannedDividend: PlannedDividend | null
  readonly grantRelease: ForecastLine
  /** Sales, other operating income and the cost lines, by the year-end tab's line ids. */
  readonly lines: readonly ForecastPlLine[]
  readonly profitBeforeTax: ForecastLine
  /** What the PD build-up starts from, so a pay scenario can run it again with other owner pay. */
  readonly taxBaseInput: TaxBaseInput
  readonly taxBase: TaxBase
  /** PD lines 43 to 59, with line 56 the advances paid and still to come. */
  readonly liability: CitLiability
  readonly profitAfterTax: TracedFigure
  readonly cit: CitForecast
  /** Revenue of the year the clients pay after it ends. */
  readonly receivableAtYearEnd: TracedFigure
  /** December's costs on arrears categories, paid in January. Read positive. */
  readonly decemberArrears: TracedFigure
  /** On the day of the forecast. Positive means the state owes the company. */
  readonly vatPosition: TracedFigure
  readonly paymentLag: PaymentLag
  readonly cash: CashProjection
  readonly cashByMonth: readonly CashMonth[]
  readonly cashAtYearEnd: TracedFigure
  readonly runway: ForecastRunway
  readonly uninvoicedMonths: readonly UninvoicedMonth[]
  readonly notModelled: readonly UnmodelledPlanLine[]
}

/**
 * The year as it is likely to end, seen on `asOf`. Complete months come from the ledger and the
 * owner's advances as the accrual view counts them, the running month is shown and never counted,
 * and each later month takes the plan tab's row for the line, or for revenue the billing plan's
 * expected invoices, else the average of the line's last twelve actual months, or its last month
 * for a cost paid in arrears. The plan's owner pay scenarios set the owner pay, its purchases join
 * the asset books and its dividend leaves the cash. Depreciation and the grant release come from
 * their engines for the whole year. The PD build-up follows, with the advances paid and those
 * still to come on line 56, and the balance and new advance the year leaves to the next. A year
 * before the forecast year's schedule needs its return from the year-end tab, or else from its own
 * forecast.
 */
export function forecastYear(workbook: HrDooWorkbook, year: number, asOf: CivilDate, rules: RuleSource = ruleValue): YearForecast {
  const registered = workbook.companyFacts.companyRegistered
  if (registered === null) {
    throw new RangeError('The forecast needs hr_company_registered, the day the first tax period starts.')
  }
  const known = knownOn(workbook, asOf)
  const forecasts = new Map<number, YearForecast>()
  const forecastOf = (target: number): YearForecast => {
    const made = forecasts.get(target) ?? forecastOne({ known, year: target, asOf, registered, rules, forecastOf })
    forecasts.set(target, made)
    return made
  }
  return forecastOf(year)
}

/** The plan editor's starting figure for a category: what a month with no plan row takes. */
export interface PlanDefault {
  readonly category: Category
  /** Signed as booked, so a cost is negative. */
  readonly average: TracedFigure
  /** True for a cost paid in arrears, which carries its last month forward. */
  readonly lastMonth: boolean
}

/**
 * What each category the forecast counts would take in a month of `year` with no plan row, seen on
 * `asOf`: the average of its last twelve actual months, or its last actual month for a cost paid
 * in arrears. It is the same line the forecast builds, so it needs no tax facts. A category whose
 * average runs against its bucket, such as refunds on a taxes category, is left out, since a plan
 * row reads income and costs both positive and would turn it around.
 */
export function planDefaults(workbook: HrDooWorkbook, year: number, asOf: CivilDate, rules: RuleSource = ruleValue): PlanDefault[] {
  const known = knownOn(workbook, asOf)
  return categoryForecasts(known, year, calendarOf(known, year), [], null, categoryShares(known, year, rules)).flatMap(({ category, forecast }) => {
    const { average } = forecast
    const against = average !== null && (category.bucket === 'income' ? average.amount < 0 : average.amount > 0)
    return average === null || against ? [] : [{ category, average, lastMonth: category.roles.includes(PACK_ROLES.arrears) }]
  })
}

function knownOn(workbook: HrDooWorkbook, asOf: CivilDate): HrDooWorkbook {
  return {
    ...workbook,
    transactions: workbook.transactions.filter((row) => row.date <= asOf),
    ownerAdvances: workbook.ownerAdvances.filter((advance) => advance.date <= asOf),
    invoices: workbook.invoices.filter((invoice) => invoice.issued <= asOf),
  }
}

function calendarOf(known: HrDooWorkbook, year: number): ForecastCalendar {
  const window = ledgerWindowOf(known.transactions)
  return {
    months: monthsFrom(monthKey(year, 1), monthKey(year, 12)),
    firstComplete: window?.firstCompleteMonth ?? null,
    lastComplete: window?.lastCompleteMonth ?? null,
    running: window?.partMonth ?? null,
  }
}

interface ForecastContext {
  readonly known: HrDooWorkbook
  readonly year: number
  readonly asOf: CivilDate
  readonly registered: CivilDate
  readonly rules: RuleSource
  /** The forecast of another year on the same day, which a later year's schedule and cash read. */
  readonly forecastOf: (year: number) => YearForecast
}

/** The owner pay categories' months the scenarios take over, from the month after this one. */
interface OwnerPayHandover {
  readonly lastActual: MonthKey | null
}

function forecastOne(context: ForecastContext): YearForecast {
  const { known, year, asOf, registered, rules } = context
  const period = taxPeriodOf(year, registered)
  const calendar = calendarOf(known, year)
  const plan = known.planLines.filter((line) => line.year === year)
  const guards = planGuards(plan, known.payScenarios, rules)
  const guarded = (line: PlanLine) => guards.find((guard) => guard.ids.includes(line.id)) ?? null
  const usable = plan.filter((line) => guarded(line) === null || line.kind === 'owner-pay-scenario')

  const ownerPayChoice = ownerPayPlan(plan, known.payScenarios, rules)
  const director = payrollDirector(known)
  const shares = categoryShares(known, year, rules)
  const handover: OwnerPayHandover | null = ownerPayChoice.kind === 'planned' && director !== null ? { lastActual: ownerPayLastActual(known, calendar, shares) } : null
  const ownerPay = handover === null || director === null || ownerPayChoice.kind !== 'planned' ? null : ownerPayForecast(ownerPayChoice.pay, director, known, calendar, handover, rules)
  const categories = [...categoryForecasts(known, year, calendar, usable, handover, shares), ...(ownerPay?.lines ?? [])]

  const delivered = new Map<number, DeliveredRevenue>()
  const deliveredIn = (target: number): DeliveredRevenue => {
    const made = delivered.get(target) ?? revenueByDelivery(known.invoices, target, rules)
    delivered.set(target, made)
    return made
  }
  const lastInvoiced = known.invoices.map(deliveredBy).sort()
  const lastInvoicedMonth = lastInvoiced[lastInvoiced.length - 1] ?? null
  const lastActualRevenue = calendar.lastComplete === null || lastInvoicedMonth === null ? null : minMonth(calendar.lastComplete, lastInvoicedMonth)
  // An invoice delivering after the last actual month is not counted yet, so it bills no plan row
  // here either. A month invoiced early then still reads its rows in full.
  const counted = known.invoices.filter((invoice) => lastActualRevenue !== null && deliveredBy(invoice) <= lastActualRevenue)
  const expected = expectedInvoices(known.billingPlan, counted)
  const clientName = (slug: string) => known.clients.find((client) => client.slug === slug)?.name || slug
  const revenue = forecastLine(calendar, {
    label: 'Revenue by delivery period',
    basis: 'invoices',
    lastActual: lastActualRevenue,
    actual: (month) => deliveredIn(yearOfMonth(month)).months.find((entry) => entry.month === month)?.revenue ?? tracedFigure(`Revenue delivered in ${monthLabel(month)}`, ZERO, 'invoices', []),
    planned: (month) => expectedRevenue(expected.filter((entry) => entry.month === month), month, clientName),
    paidAhead: () => null,
    comparison: (month) => billedPlan(known, month, clientName),
  })

  const plannedAssets = plannedAssetsOf(known.planLines.filter((line) => line.year <= year && guarded(line) === null), calendar)
  const books = assetBooks([...known.assets, ...plannedAssets], known.grants, known.companyFacts, rules)
  const scheduled = scheduledLines(calendar, books, year)

  const partsOn = (line: ForecastPlLine['line']): LinePart[] =>
    categories.filter((entry) => entry.line === line).map((entry) => ({ line: entry.forecast, sign: line === 'other-operating-income' ? 1 : -1 }))
  const otherIncomeParts: LinePart[] = [{ line: scheduled.grantRelease, sign: 1 }, ...partsOn('other-operating-income')]
  const otherIncome = addedUpLine(calendar, 'Other operating income: the grant released and other income', otherIncomeParts)
  const fromEngines: Partial<Record<CostLine, readonly ForecastLine[]>> = {
    depreciation: [scheduled.depreciation],
    'material-costs': [scheduled.smallInventory],
    'impairment-provisions-other': [scheduled.disposals],
  }
  const costLines = COST_LINES.map((line): ForecastPlLine => {
    const parts = [...partsOn(line), ...(fromEngines[line] ?? []).map((part): LinePart => ({ line: part, sign: 1 }))]
    return { line, forecast: addedUpLine(calendar, COST_LINE_LABELS[line], parts), parts }
  })
  const lines: ForecastPlLine[] = [
    { line: 'sales', forecast: revenue, parts: [{ line: revenue, sign: 1 }] },
    { line: 'other-operating-income', forecast: otherIncome, parts: otherIncomeParts },
    ...costLines,
  ]
  const profitBeforeTaxLine = addedUpLine(calendar, 'Profit before tax', [
    { line: revenue, sign: 1 },
    { line: otherIncome, sign: 1 },
    ...costLines.map((entry): LinePart => ({ line: entry.forecast, sign: -1 })),
  ])

  const revenueTotal = summed('Revenue', [revenue.total, otherIncome.total], 'ledger')
  const expenses = summed('Expenses', costLines.map((entry) => entry.forecast.total), 'ledger')
  const costOfRole = (role: PackRole, label: string): TracedFigure => {
    const slugs = categoriesWithRole(known.categories, role)
    const figures = categories.filter((entry) => slugs.includes(entry.category.slug)).map((entry) => entry.forecast.total)
    return tracedFigure(label, negateMoney(sumMoney(figures.map((figure) => figure.amount))), 'ledger', rulesOf(figures), figures)
  }
  const lossesBroughtForward = lossesCarriedInto(year, known.yearEndLines, rules)
  const taxBaseInput: TaxBaseInput = {
    year,
    revenue: tracedFigure('PD line 1, revenue', revenueTotal.amount, 'ledger', revenueTotal.rules, [revenueTotal]),
    expenses: tracedFigure('PD line 2, expenses', expenses.amount, 'ledger', expenses.rules, [expenses]),
    representation: costOfRole(PACK_ROLES.representation, 'Representation, with its VAT'),
    personalTransport: costOfRole(PACK_ROLES.personalTransport, 'Personal transport'),
    nonDeductible: costOfRole(PACK_ROLES.nonDeductible, 'Costs the tax never allows'),
    depreciationAboveAllowed: depreciationAboveAllowed(books.schedules, year),
    relatedPartyInterestShortfall: relatedPartyInterest(known, year, subtractMoney(revenueTotal.amount, expenses.amount), lossesBroughtForward, rules),
    lossesBroughtForward,
  }
  const base = taxBase(taxBaseInput, rules)

  const cit = citOf(context, period, base)
  const profitAfterTax = tracedFigure('Profit after tax', subtractMoney(base.profitBeforeTax.amount, cit.liability.liability.amount), 'ledger', rulesOf([base.profitBeforeTax, cit.liability.liability]), [
    base.profitBeforeTax,
    deducted(cit.liability.liability),
  ])

  const byPolicy = accrualBookings(known, rules)
  const settlementSlugs = categoriesWithRole(known.categories, PACK_ROLES.vatSettlement)
  const settled = withDrill(
    tracedFigure('VAT refunded less VAT paid to date', sumMoney(known.transactions.filter((row) => settlementSlugs.includes(row.category)).map((row) => row.amount)), 'ledger', []),
    drillToTransactions({ period: { preset: 'all' }, categories: settlementSlugs }),
  )
  const vat = vatPosition(bookingsAfterCutOff(byPolicy, arrearsCutOff(byPolicy, year, known.yearEndLines, known.categories)), monthOf(asOf), settled)

  const december = monthKey(year, 12)
  const decemberArrears = summed(
    'December costs paid in arrears in January',
    categories.filter((entry) => entry.category.roles.includes(PACK_ROLES.arrears)).map((entry) => deducted(monthOfLine(entry.forecast, december).figure)),
    'ledger',
  )
  const plannedDividend = plannedDividendOf(usable, calendar, known, asOf, rules)
  const paymentLag = paymentLagOf(known)
  const cash = cashProjection({
    year,
    calendar,
    known,
    asOf,
    revenue,
    categories,
    plannedAssets: plannedAssets.filter((asset) => yearOf(asset.bought) === year),
    dividend: plannedDividend === null ? null : ({ month: plannedDividend.month, cashOut: plannedDividend.cashOut } satisfies DividendCash),
    citObligations: cit.forecast.history,
    vatPosition: vat,
    paymentLag,
    carried: () => (year - 1 < yearOf(registered) ? null : context.forecastOf(year - 1).cash),
  })

  return {
    year,
    asOf,
    period,
    calendar,
    revenue,
    categories,
    ownerPay,
    depreciation: scheduled.depreciation,
    smallInventory: scheduled.smallInventory,
    disposals: scheduled.disposals,
    plannedAssets: plannedAssets.filter((asset) => yearOf(asset.bought) === year),
    plannedDividend,
    grantRelease: scheduled.grantRelease,
    lines,
    profitBeforeTax: profitBeforeTaxLine,
    taxBaseInput,
    taxBase: base,
    liability: cit.liability,
    profitAfterTax,
    cit: cit.forecast,
    receivableAtYearEnd: cash.receivableAtYearEnd,
    decemberArrears,
    vatPosition: vat,
    paymentLag,
    cash,
    cashByMonth: cash.months,
    cashAtYearEnd: cash.atYearEnd,
    runway: runwayOf(cash.atYearEnd, costLines, [scheduled.depreciation, scheduled.disposals], cit.forecast.history, year),
    uninvoicedMonths: deliveredIn(year).uninvoicedMonths,
    notModelled: unmodelled(plan, guards, ownerPayChoice, ownerPay, known, calendar),
  }
}

/**
 * Every category the accrual view counts in profit that the year or its averaging window touches,
 * or the plan names. With a handover, the owner pay categories stop at its last actual month and
 * the scenarios' lines take the later months.
 */
function categoryForecasts(
  known: HrDooWorkbook,
  year: number,
  calendar: ForecastCalendar,
  plan: readonly PlanLine[],
  handover: OwnerPayHandover | null,
  shares: ReadonlyMap<string, MonthShares>,
): CategoryForecast[] {
  const plannedFigure = (item: string, month: MonthKey, label: string, sign: 1 | -1): TracedFigure | null => {
    const row = planRow(plan, item, month)
    if (row === null) {
      return null
    }
    return tracedFigure(`${label}, ${monthLabel(month)}: planned${row.note === '' ? '' : `, ${row.note}`}`, sign === 1 ? row.amount : negateMoney(row.amount), 'plan', [])
  }
  const earliestRelevant = calendar.lastComplete === null ? monthKey(year, 1) : minMonth(monthKey(year, 1), addMonths(calendar.lastComplete, -AVERAGED_MONTHS))
  const relevantMonths = monthsFrom(earliestRelevant, monthKey(year, 12))
  const relevant = (category: Category) =>
    countsInProfit(category) &&
    (relevantMonths.some((month) => shares.has(shareKey(category.slug, month))) || (!isPlanKeyword(category.slug) && plan.some((line) => line.kind === 'amount' && line.item === category.slug)))
  return known.categories.filter(relevant).map((category): CategoryForecast => {
    const label = displayName(category.slug, category.label)
    const actual = (month: MonthKey) => monthFigure(`${label}, ${monthLabel(month)}`, shares.get(shareKey(category.slug, month)) ?? [])
    const arrears = category.roles.includes(PACK_ROLES.arrears)
    const handedOver = handover !== null && isOwnerPayCost(category)
    const fromPlan = (month: MonthKey) => (isPlanKeyword(category.slug) ? null : plannedFigure(category.slug, month, label, category.bucket === 'income' ? 1 : -1))
    const lastActual = handedOver ? handover.lastActual : categoryLastActual(category, calendar, shares)
    const forecast = forecastLine(calendar, {
      label,
      basis: 'ledger',
      lastActual,
      actual,
      planned: (month) => (handedOver && (lastActual === null || month > lastActual) ? tracedFigure(`${label}, ${monthLabel(month)}: set by the owner pay scenario`, ZERO, 'plan', []) : fromPlan(month)),
      paidAhead: (month) => (category.roles.includes(PACK_ROLES.prepaidAnnual) && shares.has(shareKey(category.slug, month)) ? actual(month) : null),
      comparison: fromPlan,
      averagedMonths: arrears ? ARREARS_AVERAGED_MONTHS : AVERAGED_MONTHS,
    })
    return { category, line: category.bucket === 'income' ? 'other-operating-income' : costLineOf(category, year, known.yearEndLines), forecast }
  })
}

type MonthShares = readonly { readonly entry: CountedBooking; readonly amount: Money }[]

function categoryShares(known: HrDooWorkbook, year: number, rules: RuleSource): ReadonlyMap<string, MonthShares> {
  const byPolicy = accrualBookings(known, rules)
  const bookings = bookingsAfterCutOff(byPolicy, arrearsCutOff(byPolicy, year, known.yearEndLines, known.categories))
  return sharesByCategoryMonth(bookings.filter(isCounted))
}

/** A category's last month the ledger settles: the last complete month, or the one before for a cost paid in arrears whose payment is not in yet. */
function categoryLastActual(category: Category, calendar: ForecastCalendar, shares: ReadonlyMap<string, MonthShares>): MonthKey | null {
  if (calendar.lastComplete === null) {
    return null
  }
  const arrearsNotYetPaid = category.roles.includes(PACK_ROLES.arrears) && !shares.has(shareKey(category.slug, calendar.lastComplete))
  return arrearsNotYetPaid ? addMonths(calendar.lastComplete, -1) : calendar.lastComplete
}

/** The earliest last actual month of the owner pay categories, so no month counts both the ledger's pay and a scenario's. */
function ownerPayLastActual(known: HrDooWorkbook, calendar: ForecastCalendar, shares: ReadonlyMap<string, MonthShares>): MonthKey | null {
  const months = known.categories
    .filter((category) => isOwnerPayCost(category) && countsInProfit(category))
    .map((category) => categoryLastActual(category, calendar, shares))
    .filter((month): month is MonthKey => month !== null)
    .sort()
  return months[0] ?? calendar.lastComplete
}

/**
 * The company's side of the planned owner pay, month by month after the owner pay categories'
 * last actual month: the salary with health on top and the tax-free items within their caps, and
 * the rent. Paid in arrears when the owner pay categories are.
 */
function ownerPayForecast(plan: PlannedOwnerPay, director: Employee, known: HrDooWorkbook, calendar: ForecastCalendar, handover: OwnerPayHandover, rules: RuleSource): OwnerPayForecast {
  const pay = scenarioPay(plan.scenario, director, rules)
  const arrears = known.categories.some((category) => isOwnerPayCost(category) && category.roles.includes(PACK_ROLES.arrears))
  const scenarioName = plan.scenario.label || plan.scenario.slug
  const lineOf = (slug: string, label: string, line: CategoryForecast['line'], monthly: (month: MonthKey) => TracedFigure): CategoryForecast => ({
    category: { slug, label, family: 'owner-pay', bucket: 'owner-pay', colour: BUCKET_COLOUR, roles: arrears ? [PACK_ROLES.arrears] : [], vat: 'none', ownerShare: null },
    line,
    forecast: forecastLine(calendar, {
      label,
      basis: 'plan',
      lastActual: handover.lastActual,
      actual: (month) => tracedFigure(`${label}, ${monthLabel(month)}: on the owner pay categories`, ZERO, 'plan', []),
      planned: (month) => deducted(monthly(month)),
      paidAhead: () => null,
    }),
  })
  const salary = lineOf('owner-pay-scenario-salary', `Salary from ${scenarioName}`, 'personnel-costs', (month) => {
    const paid = pay.payroll.find((entry) => entry.workedMonth === month)
    return paid === undefined
      ? tracedFigure(`Salary from ${scenarioName}, ${monthLabel(month)}: none`, ZERO, 'plan', [])
      : summed(`Salary from ${scenarioName}, ${monthLabel(month)}`, [paid.employerCost, paid.nontaxablePayments], 'plan')
  })
  const rent = lineOf('owner-pay-scenario-rent', `Rent from ${scenarioName}`, 'material-costs', (month) =>
    summed(`Rent from ${scenarioName}, ${monthLabel(month)}`, pay.rent.filter((part) => part.month === month).map((part) => part.rent), 'plan'),
  )
  return { plan, pay, lines: pay.rent.length === 0 ? [salary] : [salary, rent], lastActual: handover.lastActual, salaryDropped: salaryDropped(pay.schedule, known.grants) }
}

/** Purchases on the plan tab in months the ledger has not reached, as asset rows bought and put in use on their day. */
function plannedAssetsOf(lines: readonly PlanLine[], calendar: ForecastCalendar): Asset[] {
  return lines.flatMap((line): Asset[] =>
    line.kind !== 'purchase' || (calendar.lastComplete !== null && monthOf(line.date) <= calendar.lastComplete)
      ? []
      : [
          {
            name: `${line.note === '' ? 'Purchase' : line.note}, planned`,
            bought: line.date,
            inUse: line.date,
            costNet: line.amount,
            group: line.group,
            doubledRate: false,
            disposed: null,
            fundedBy: '',
            ledgerReference: '',
            note: line.note,
            id: line.id,
          },
        ],
  )
}

/**
 * The plan's dividend in a month the ledger has not settled: the tax withheld at payout, and the
 * net set off against what the owner owes on the day of the forecast before any of it is paid out.
 * In the running month it is only what the plan has beyond the profit the ledger has paid out so far.
 */
function plannedDividendOf(plan: readonly PlanLine[], calendar: ForecastCalendar, known: HrDooWorkbook, asOf: CivilDate, rules: RuleSource): PlannedDividend | null {
  const line = plan.find((candidate) => candidate.kind === 'amount' && candidate.item === 'dividend' && candidate.month !== null)
  if (line === undefined || line.kind !== 'amount' || line.month === null) {
    return null
  }
  const month = monthKey(line.year, line.month)
  if (calendar.lastComplete !== null && month <= calendar.lastComplete) {
    return null
  }
  const planned = tracedFigure(`Dividend planned for ${monthLabel(month)}${line.note === '' ? '' : `, ${line.note}`}`, line.amount, 'plan', [])
  const slugs = categoriesWithRole(known.categories, PACK_ROLES.profitDistribution)
  const paidSoFar = negateMoney(sumMoney(known.transactions.filter((row) => slugs.includes(row.category) && monthOf(row.date) === month).map((row) => row.amount)))
  const gross =
    paidSoFar === 0
      ? planned
      : summed(`Dividend still to pay in ${monthLabel(month)}`, [planned, deducted(tracedFigure(`Profit paid out in ${monthLabel(month)} so far, with its tax`, paidSoFar, 'ledger', []))], 'plan')
  if (gross.amount <= 0) {
    return null
  }
  const taxRule = rules('hr.pit.dividend', firstDayOf(month))
  const tax = tracedFigure(`Dividend tax at ${percentText(taxRule.value.rate.basisPoints)}, withheld at payout`, atRate(gross.amount, taxRule.value.rate.basisPoints), 'plan', [taxRule.citation], [gross])
  const net = summed('Dividend after its tax', [gross, deducted(tax)], 'plan')
  const owed = owedByOwnerOn(known, asOf)
  const setOff = tracedFigure('Set off against what the owner owes', net.amount < owed.amount ? net.amount : owed.amount, 'plan', [], [net, owed])
  return { line, month, gross, tax, setOff, cashOut: summed('Dividend paid out in cash, its tax included', [tax, net, deducted(setOff)], 'plan') }
}

/**
 * Cash at the year end over the average monthly cost of October to December, as Overview counts
 * runway over its last three months: the costs with owner pay, less depreciation and disposals,
 * which pay nothing, and the corporate tax that falls due in those months.
 */
function runwayOf(cash: TracedFigure, costLines: readonly ForecastPlLine[], nonCash: readonly ForecastLine[], citObligations: readonly MatchedCitObligation[], year: number): ForecastRunway {
  const lastThree = monthsFrom(monthKey(year, 10), monthKey(year, 12))
  const inMonths = (line: ForecastLine) => lastThree.map((month) => monthOfLine(line, month).figure)
  const costs = summed(
    `Costs of ${monthLabel(monthKey(year, 10))} to ${monthLabel(monthKey(year, 12))}`,
    [
      ...costLines.flatMap((entry) => inMonths(entry.forecast)),
      ...nonCash.flatMap((line) => inMonths(line).map(deducted)),
      ...citObligations.filter((entry) => lastThree.includes(monthOf(entry.obligation.dueOn))).map((entry) => entry.obligation.expected),
    ],
    'ledger',
  )
  const monthlyCost = tracedFigure('Average monthly cost', divideMoney(costs.amount, lastThree.length), 'ledger', costs.rules, [costs])
  return { months: costs.amount > 0 ? (cash.amount * lastThree.length) / costs.amount : null, cash, monthlyCost }
}

/** The schedules of every year from the first tax period, matched to the bank rows, and the year's liability on them. */
function citOf(
  context: ForecastContext,
  period: TaxPeriod,
  base: TaxBase,
): { readonly liability: CitLiability; readonly forecast: CitForecast } {
  const { known, year, asOf, registered, rules } = context
  const facts = known.companyFacts
  const firstYear = yearOf(registered)
  const returnOf = (taxYear: number): PriorReturn => closedYearReturn(known.yearEndLines, taxYear, registered, rules) ?? context.forecastOf(taxYear).liability
  const returnsBefore = (taxYear: number) => [taxYear - 1, taxYear - 2].filter((prior) => prior >= firstYear).map(returnOf)
  const schedules = Array.from({ length: year - firstYear + 1 }, (_, offset) => firstYear + offset).map((taxYear) =>
    citSchedule(taxYear, returnsBefore(taxYear), facts, rules),
  )
  const own = schedules[schedules.length - 1] as CitSchedule
  const matching = matchCitPayments(schedules, known.transactions, known.categories, asOf)
  const obligations = matching.obligations.filter((entry) => own.obligations.includes(entry.obligation))
  const advancesPaid = matching.advancesPaid.find((entry) => entry.year === year)?.paid ?? summed(`PD line 56, advances paid for ${year}`, [], 'ledger')
  const advancesToCome = summed(
    `Advances still to come for ${year}`,
    obligations
      .filter((entry) => entry.obligation.kind === 'advance' && entry.outstanding > 0)
      .map(outstandingFigure),
    'ledger',
  )
  const liability = citLiability(base, period, summed(`PD line 56, advances paid and still to come for ${year}`, [advancesPaid, advancesToCome], 'ledger'), rules)
  const thisReturn = closedYearReturn(known.yearEndLines, year, registered, rules) ?? liability
  const nextYear = citSchedule(year + 1, [thisReturn, ...(year - 1 >= firstYear ? [returnOf(year - 1)] : [])], facts, rules)
  const newAdvanceMonth = firstAdvanceAtNewAmount(year + 1, rules)
  return {
    liability,
    forecast: {
      obligations,
      history: matching.obligations,
      advancesPaid,
      advancesToCome,
      nextYear,
      balanceDue: nextYear.obligations.find((entry) => entry.kind === 'balance-due' && entry.taxYear === year) ?? null,
      newAdvance: nextYear.obligations.find((entry) => entry.kind === 'advance' && entry.month === newAdvanceMonth) ?? null,
      unmatched: matching.unmatched,
    },
  }
}


function shareKey(slug: string, month: MonthKey): string {
  return `${slug} ${month}`
}

/** Counted bookings by category and the month they count in, keyed by `shareKey`. */
function sharesByCategoryMonth(counted: readonly CountedBooking[]): ReadonlyMap<string, MonthShares> {
  const byKey = new Map<string, { readonly entry: CountedBooking; readonly amount: Money }[]>()
  for (const entry of counted) {
    for (const share of entry.shares) {
      const key = shareKey(entry.category.slug, share.month)
      byKey.set(key, [...(byKey.get(key) ?? []), { entry, amount: share.amount }])
    }
  }
  return byKey
}

function monthFigure(label: string, shares: MonthShares): TracedFigure {
  const steps = shares.map(({ entry, amount }) => bookingFigure(entry, amount))
  return tracedFigure(label, sumMoney(steps.map((step) => step.amount)), 'ledger', rulesOf(shares.map(({ entry }) => entry.vat.cost)), steps)
}

interface ScheduledLines {
  readonly depreciation: ForecastLine
  readonly smallInventory: ForecastLine
  readonly disposals: ForecastLine
  readonly grantRelease: ForecastLine
}

/** Depreciation, write-offs and the grant release of every month of the year, from the asset and grant engines. */
function scheduledLines(calendar: ForecastCalendar, books: AssetBooks, year: number): ScheduledLines {
  const writtenOff = (treatment: 'small-inventory' | 'depreciated', label: string) =>
    scheduledLine(calendar, label, (month) =>
      summed(
        `${label}, ${monthLabel(month)}`,
        books.schedules.flatMap((schedule) =>
          schedule.treatment === treatment && schedule.writeOff !== null && monthOf(schedule.writeOff.on) === month
            ? [{ ...schedule.writeOff.figure, label: `${schedule.asset.name}, ${schedule.writeOff.figure.label.toLowerCase()}` }]
            : [],
        ),
        'assets',
      ),
    )
  return {
    depreciation: scheduledLine(calendar, 'Depreciation', (month) =>
      summed(
        `Depreciation, ${monthLabel(month)}`,
        books.schedules.flatMap((schedule) =>
          schedule.months
            .filter((entry) => entry.month === month)
            .map((entry) => tracedFigure(schedule.asset.name, entry.charge, 'assets', schedule.years.find((charge) => charge.year === year)?.charge.rules ?? [])),
        ),
        'assets',
      ),
    ),
    smallInventory: writtenOff('small-inventory', 'Small inventory written off when put in use'),
    disposals: writtenOff('depreciated', 'Book value of disposed assets written off'),
    grantRelease: scheduledLine(calendar, 'Grant released', (month) =>
      summed(
        `Grant released, ${monthLabel(month)}`,
        books.grants.flatMap((schedule) =>
          schedule.months
            .filter((entry) => entry.month === month && entry.released !== 0)
            .map((entry) => tracedFigure(schedule.grant.slug, entry.released, 'assets', schedule.years.find((released) => released.year === year)?.released.rules ?? [])),
        ),
        'assets',
      ),
    ),
  }
}

/** The month an invoice delivers in last, or its issue month when it names no delivery period. */
function deliveredBy(invoice: Invoice): MonthKey {
  return monthOf(invoice.deliveryPeriod?.to ?? invoice.issued)
}

/** The billing plan rows still to invoice in one month, each on the day it becomes billable. Null when there are none. */
function expectedRevenue(due: readonly ExpectedInvoice[], month: MonthKey, clientName: (slug: string) => string): TracedFigure | null {
  if (due.length === 0) {
    return null
  }
  const rows = due.flatMap((invoice) =>
    invoice.items.map((openRow): TracedFigure => ({ ...tracedFigure(`${openRow.row.item} for ${clientName(invoice.client)}, billable`, openRow.open, 'plan', []), on: openRow.row.date })),
  )
  return summed(`Revenue, ${monthLabel(month)}: planned from the billing plan`, rows, 'plan')
}

type AmountPlanLine = Extract<PlanLine, { readonly kind: 'amount' }>

/** The plan row for an item in a month: the month's own row, else the row for every month of the year. */
function planRow(plan: readonly PlanLine[], item: string, month: MonthKey): AmountPlanLine | null {
  const rows = plan.filter((line): line is AmountPlanLine => line.kind === 'amount' && line.item === item)
  return rows.find((line) => line.month === monthNumber(month)) ?? rows.find((line) => line.month === null) ?? null
}

/** The billing plan's rows dated in a month, all of them, as the plan a month the ledger settles is compared with. Null when it has none. */
function billedPlan(known: HrDooWorkbook, month: MonthKey, clientName: (slug: string) => string): TracedFigure | null {
  const rows = known.billingPlan.filter((row) => monthOf(row.date) === month)
  if (rows.length === 0) {
    return null
  }
  return summed(
    `Revenue, ${monthLabel(month)}: the billing plan`,
    rows.map((row) => ({ ...tracedFigure(`${row.item} for ${clientName(row.client)}`, row.amount, 'plan', []), on: row.date })),
    'plan',
  )
}

function unmodelled(
  plan: readonly PlanLine[],
  guards: readonly PlanGuard[],
  ownerPayChoice: ReturnType<typeof ownerPayPlan>,
  ownerPay: OwnerPayForecast | null,
  known: HrDooWorkbook,
  calendar: ForecastCalendar,
): UnmodelledPlanLine[] {
  const settled = (month: MonthKey) => calendar.lastComplete !== null && month <= calendar.lastComplete
  return plan.flatMap((line): UnmodelledPlanLine[] => {
    if (line.kind === 'owner-pay-scenario') {
      if (ownerPayChoice.kind === 'refused') {
        return [{ line, reason: ownerPayChoice.guards.map((guard) => guard.reason).join(' ') }]
      }
      return ownerPay === null ? [{ line, reason: "The payroll needs the director's row on the employees tab, with the city that sets its income tax rates, so the owner pay categories follow their own plan rows or averages." }] : []
    }
    const guard = guards.find((candidate) => candidate.ids.includes(line.id))
    if (guard !== undefined) {
      return [{ line, reason: guard.reason }]
    }
    if (line.kind === 'purchase') {
      if (settled(monthOf(line.date))) {
        return [{ line, reason: 'Its month is complete in the ledger, which counts what was bought.' }]
      }
      return []
    }
    if (line.item === 'dividend') {
      return line.month !== null && settled(monthKey(line.year, line.month)) ? [{ line, reason: 'Its month is complete in the ledger, which counts what was paid out.' }] : []
    }
    const category = known.categories.find((candidate) => candidate.slug === line.item)
    if (!isPlanKeyword(line.item) && category !== undefined) {
      if (category.roles.includes(PACK_ROLES.revenue)) {
        return [{ line, reason: 'Revenue is planned on the outgoing-plan tab, so the forecast reads it from there.' }]
      }
      if (!countsInProfit(category)) {
        return [{ line, reason: `${displayName(category.slug, category.label)} is taken out of profit and loss, so the forecast does not count it.` }]
      }
      if (ownerPay !== null && isOwnerPayCost(category)) {
        return [{ line, reason: 'The owner pay scenario sets the owner pay of the year, so this row is not counted.' }]
      }
    }
    return []
  })
}

function isPlanKeyword(item: string): boolean {
  return (PLAN_KEYWORDS as readonly string[]).includes(item)
}

function minMonth(first: MonthKey, second: MonthKey): MonthKey {
  return first < second ? first : second
}
