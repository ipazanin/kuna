import { expectedInvoices } from '../../../../features/billingPlan/domain/expectedInvoices'
import type { ExpectedInvoice } from '../../../../features/billingPlan/domain/expectedInvoices'
import { drillToTransactions } from '../../../../features/filters/domain/drillTarget'
import { PLAN_KEYWORDS } from '../../../../features/workbook/domain/plan'
import type { PlanLine } from '../../../../features/workbook/domain/plan'
import { ledgerWindowOf } from '../../../../features/workbook/domain/workbook'
import type { Category, Invoice, Workbook } from '../../../../features/workbook/domain/workbook'
import { civilDate, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMonths, monthKey, monthNumber, monthOf, monthsFrom, yearOfMonth } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { ZERO, negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { withDrill } from '../accrual/accrualAdjustment'
import { vatPosition } from '../accrual/accrualBalanceSheet'
import { accrualBookings, bookingFigure, countsInProfit, isCounted } from '../accrual/accrualBookings'
import type { CountedBooking } from '../accrual/accrualBookings'
import { relatedPartyInterest } from '../accrual/accrualYear'
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
import { PACK_ROLES, categoriesWithRole } from '../packRoles'
import type { PackRole } from '../packRoles'
import { deducted, rulesOf, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { cashAtYearEnd } from './forecastCash'
import { AVERAGED_MONTHS, addedUpLine, forecastLine, monthOfLine, scheduledLine } from './forecastLines'
import type { CategoryForecast, ForecastCalendar, ForecastLine, ForecastMonth, ForecastPlLine, LinePart } from './forecastLines'

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
  /** Every other category the accrual view counts in profit, in the order of the categories tab. */
  readonly categories: readonly CategoryForecast[]
  readonly depreciation: ForecastLine
  /** Assets at or below the threshold, written off when put in use. */
  readonly smallInventory: ForecastLine
  /** Book value written off when an asset is disposed of. */
  readonly disposals: ForecastLine
  /** Purchases on the plan tab at or below the asset threshold, written off in their month. */
  readonly plannedPurchases: ForecastLine
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
  /** December's revenue, which the client pays after the year end. */
  readonly decemberReceivable: TracedFigure
  /** December's costs on arrears categories, paid in January. Read positive. */
  readonly decemberArrears: TracedFigure
  /** On the day of the forecast. Positive means the state owes the company. */
  readonly vatPosition: TracedFigure
  readonly cashAtYearEnd: TracedFigure
  readonly uninvoicedMonths: readonly UninvoicedMonth[]
  readonly notModelled: readonly UnmodelledPlanLine[]
}

type AmountPlanLine = Extract<PlanLine, { readonly kind: 'amount' }>

/**
 * The year as it is likely to end, seen on `asOf`. Complete months come from the ledger and the
 * owner's advances as the accrual view counts them, the running month is shown and never counted,
 * and each later month takes the plan tab's row for the line, or for revenue the billing plan's
 * expected invoices, else the average of the line's last twelve actual months. Depreciation and
 * the grant release come from their engines for the whole year. The PD build-up follows, with the
 * advances paid and those still to come on line 56, and the balance and new advance the year
 * leaves to the next. A year before the forecast year's schedule needs its return from the
 * year-end tab, or else from its own forecast.
 */
export function forecastYear(workbook: Workbook, year: number, asOf: CivilDate, rules: RuleSource = ruleValue): YearForecast {
  const registered = workbook.settings.companyFacts.companyRegistered
  if (registered === null) {
    throw new RangeError('The forecast needs hr_company_registered, the day the first tax period starts.')
  }
  const known: Workbook = {
    ...workbook,
    transactions: workbook.transactions.filter((row) => row.date <= asOf),
    ownerAdvances: workbook.ownerAdvances.filter((advance) => advance.date <= asOf),
    invoices: workbook.invoices.filter((invoice) => invoice.issued <= asOf),
  }
  const forecasts = new Map<number, YearForecast>()
  const forecastOf = (target: number): YearForecast => {
    const made = forecasts.get(target) ?? forecastOne({ known, year: target, asOf, registered, rules, forecastOf })
    forecasts.set(target, made)
    return made
  }
  return forecastOf(year)
}

interface ForecastContext {
  readonly known: Workbook
  readonly year: number
  readonly asOf: CivilDate
  readonly registered: CivilDate
  readonly rules: RuleSource
  /** The forecast of another year on the same day, which a later year's schedule and cash read. */
  readonly forecastOf: (year: number) => YearForecast
}

function forecastOne(context: ForecastContext): YearForecast {
  const { known, year, asOf, registered, rules } = context
  const period = taxPeriodOf(year, registered)
  const firstDay = civilDate(year, 1, 1)
  const window = ledgerWindowOf(known.transactions)
  const calendar: ForecastCalendar = {
    months: monthsFrom(monthKey(year, 1), monthKey(year, 12)),
    firstComplete: window?.firstCompleteMonth ?? null,
    lastComplete: window?.lastCompleteMonth ?? null,
    running: window?.partMonth ?? null,
  }
  const plan = known.planLines.filter((line) => line.year === year)
  const plannedFigure = (item: string, month: MonthKey, label: string, sign: 1 | -1): TracedFigure | null => {
    const row = planRow(plan, item, month)
    if (row === null) {
      return null
    }
    return tracedFigure(`${label}, ${monthLabel(month)}: planned${row.note === '' ? '' : `, ${row.note}`}`, sign === 1 ? row.amount : negateMoney(row.amount), 'plan', [])
  }

  const byPolicy = accrualBookings(known, rules)
  const bookings = bookingsAfterCutOff(byPolicy, arrearsCutOff(byPolicy, year, known.yearEndLines, known.categories))
  const shares = sharesByCategoryMonth(bookings.filter(isCounted))

  const earliestRelevant = calendar.lastComplete === null ? monthKey(year, 1) : minMonth(monthKey(year, 1), addMonths(calendar.lastComplete, -AVERAGED_MONTHS))
  const relevantMonths = monthsFrom(earliestRelevant, monthKey(year, 12))
  const relevant = (category: Category) =>
    countsInProfit(category) &&
    (relevantMonths.some((month) => shares.has(shareKey(category.slug, month))) || (!isPlanKeyword(category.slug) && plan.some((line) => line.kind === 'amount' && line.item === category.slug)))
  const categories = known.categories.filter(relevant).map((category): CategoryForecast => {
    const label = category.label ?? category.slug
    const actual = (month: MonthKey) => monthFigure(`${label}, ${monthLabel(month)}`, shares.get(shareKey(category.slug, month)) ?? [])
    const arrearsNotYetPaid =
      calendar.lastComplete !== null && category.roles.includes(PACK_ROLES.arrears) && !shares.has(shareKey(category.slug, calendar.lastComplete))
    const forecast = forecastLine(calendar, {
      label,
      basis: 'ledger',
      lastActual: calendar.lastComplete === null ? null : arrearsNotYetPaid ? addMonths(calendar.lastComplete, -1) : calendar.lastComplete,
      actual,
      planned: (month) => (isPlanKeyword(category.slug) ? null : plannedFigure(category.slug, month, label, category.bucket === 'income' ? 1 : -1)),
      paidAhead: (month) => (category.roles.includes(PACK_ROLES.prepaidAnnual) && shares.has(shareKey(category.slug, month)) ? actual(month) : null),
    })
    return { category, line: category.bucket === 'income' ? 'other-operating-income' : costLineOf(category, year, known.yearEndLines), forecast }
  })

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
  })

  const books = assetBooks(known.assets, known.grants, known.settings.companyFacts, rules)
  const scheduled = scheduledLines(calendar, books, year)
  const threshold = rules('hr.cit.asset-threshold', firstDay)
  const plannedPurchases = plannedPurchaseLine(calendar, plan, threshold.value.unitCostAbove.cents, [threshold.citation])

  const partsOn = (line: ForecastPlLine['line']): LinePart[] =>
    categories.filter((entry) => entry.line === line).map((entry) => ({ line: entry.forecast, sign: line === 'other-operating-income' ? 1 : -1 }))
  const otherIncomeParts: LinePart[] = [{ line: scheduled.grantRelease, sign: 1 }, ...partsOn('other-operating-income')]
  const otherIncome = addedUpLine(calendar, 'Other operating income: the grant released and other income', otherIncomeParts)
  const fromEngines: Partial<Record<CostLine, readonly ForecastLine[]>> = {
    depreciation: [scheduled.depreciation],
    'material-costs': [scheduled.smallInventory, plannedPurchases],
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

  const settlementSlugs = categoriesWithRole(known.categories, PACK_ROLES.vatSettlement)
  const settled = withDrill(
    tracedFigure('VAT refunded less VAT paid to date', sumMoney(known.transactions.filter((row) => settlementSlugs.includes(row.category)).map((row) => row.amount)), 'ledger', []),
    drillToTransactions({ period: { preset: 'all' }, categories: settlementSlugs }),
  )
  const vat = vatPosition(bookings, monthOf(asOf), settled)

  const december = monthKey(year, 12)
  const decemberRevenue = monthOfLine(revenue, december).figure
  const decemberReceivable = tracedFigure('Revenue of December, paid after the year end', decemberRevenue.amount, decemberRevenue.basis, decemberRevenue.rules, [decemberRevenue])
  const decemberArrears = summed(
    'December costs paid in arrears in January',
    categories.filter((entry) => entry.category.roles.includes(PACK_ROLES.arrears)).map((entry) => deducted(monthOfLine(entry.forecast, december).figure)),
    'ledger',
  )
  const cash = cashAtYearEnd({
    year,
    calendar,
    known,
    revenue,
    categories,
    plannedPurchases,
    citObligations: cit.forecast.history,
    vatPosition: vat,
    carried: () => (year - 1 < yearOf(registered) ? null : context.forecastOf(year - 1)),
  })

  return {
    year,
    asOf,
    period,
    calendar,
    revenue,
    categories,
    depreciation: scheduled.depreciation,
    smallInventory: scheduled.smallInventory,
    disposals: scheduled.disposals,
    plannedPurchases,
    grantRelease: scheduled.grantRelease,
    lines,
    profitBeforeTax: profitBeforeTaxLine,
    taxBaseInput,
    taxBase: base,
    liability: cit.liability,
    profitAfterTax,
    cit: cit.forecast,
    decemberReceivable,
    decemberArrears,
    vatPosition: vat,
    cashAtYearEnd: cash,
    uninvoicedMonths: deliveredIn(year).uninvoicedMonths,
    notModelled: unmodelled(plan, known.categories, threshold.value.unitCostAbove.cents),
  }
}

/** The schedules of every year from the first tax period, matched to the bank rows, and the year's liability on them. */
function citOf(
  context: ForecastContext,
  period: TaxPeriod,
  base: TaxBase,
): { readonly liability: CitLiability; readonly forecast: CitForecast } {
  const { known, year, asOf, registered, rules } = context
  const facts = known.settings.companyFacts
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

type MonthShares = readonly { readonly entry: CountedBooking; readonly amount: Money }[]

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

/**
 * Purchases the plan tab lists for months the ledger has not reached, at or below the asset
 * threshold, as costs of their month. One above it needs an asset row and is not counted here. A
 * month with nothing planned has no basis.
 */
function plannedPurchaseLine(calendar: ForecastCalendar, plan: readonly PlanLine[], threshold: Money, citations: TracedFigure['rules']): ForecastLine {
  const label = 'Small purchases planned'
  const months = calendar.months.map((month): ForecastMonth => {
    const row = calendar.lastComplete !== null && month <= calendar.lastComplete ? null : planRow(plan, 'purchase', month)
    return row !== null && row.amount <= threshold
      ? { month, bases: ['planned'], figure: tracedFigure(`${label}, ${monthLabel(month)}${row.note === '' ? '' : `, ${row.note}`}`, row.amount, 'plan', citations), soFar: null }
      : { month, bases: [], figure: tracedFigure(`${label}, ${monthLabel(month)}: none`, ZERO, 'plan', []), soFar: null }
  })
  return { label, months, total: summed(label, months.map((entry) => entry.figure), 'plan'), averagedOver: null }
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

/** The plan row for an item in a month: the month's own row, else the row for every month of the year. */
function planRow(plan: readonly PlanLine[], item: string, month: MonthKey): AmountPlanLine | null {
  const rows = plan.filter((line): line is AmountPlanLine => line.kind === 'amount' && line.item === item)
  return rows.find((line) => line.month === monthNumber(month)) ?? rows.find((line) => line.month === null) ?? null
}

function unmodelled(plan: readonly PlanLine[], categories: readonly Category[], threshold: Money): UnmodelledPlanLine[] {
  return plan.flatMap((line): UnmodelledPlanLine[] => {
    if (line.kind === 'owner-pay-scenario') {
      return [{ line, reason: 'Payroll from an owner pay scenario is not worked out yet, so the payroll categories follow their own plan rows or averages.' }]
    }
    if (line.item === 'dividend') {
      return [{ line, reason: 'A payout is not a cost. Dividend capacity sets out the payout options.' }]
    }
    if (line.item === 'purchase' && line.amount > threshold) {
      return [{ line, reason: 'It is above the asset threshold, so it needs an asset row with its group and the day it is put in use before it depreciates.' }]
    }
    const category = categories.find((candidate) => candidate.slug === line.item)
    if (!isPlanKeyword(line.item) && category !== undefined) {
      if (category.roles.includes(PACK_ROLES.revenue)) {
        return [{ line, reason: 'Revenue is planned on the outgoing-plan tab, so the forecast reads it from there.' }]
      }
      if (!countsInProfit(category)) {
        return [{ line, reason: `${category.label ?? category.slug} is taken out of profit and loss, so the forecast does not count it.` }]
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
