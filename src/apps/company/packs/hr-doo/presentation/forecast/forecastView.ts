import type { RouteLocationRaw } from 'vue-router'

import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import { expectedInvoices } from '../../../../billingPlan/domain/expectedInvoices'
import type { DrillTarget } from '../../../../filters/domain/drillTarget'
import { runwayInWords } from '../../../../overview/domain/headline'
import type { HrDooWorkbook } from '../../domain/hrDooPart'
import { civilDate, yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { monthKey, yearOfMonth } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import { negateMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import { ruleLink } from '../../ruleset/presentation/ruleWording'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { dividendCapacity } from '../../domain/dividend/dividendCapacity'
import type { InterimCash, PayoutOption, PayoutOptionId } from '../../domain/dividend/dividendCapacity'
import type { ForecastLine, ForecastMonth, LinePart, MonthBasis } from '../../domain/forecast/forecastLines'
import { forecastYear } from '../../domain/forecast/forecastYear'
import { planAgainstActual } from '../../domain/forecast/planAgainstActual'
import { percentText } from '../../domain/payroll/payrollArithmetic'
import { figureLabel, ruleChips, stepsOf, watchedCitations } from '../tracedFigureView'
import type { BuildUpStep, RuleChip } from '../yearEnd/LineBuildUp.vue'
import { lineLabel } from '../yearEnd/yearEndWording'
import type { BuildUpLine } from './BuildUpList.vue'
import type { ForecastChartMonth } from './forecastChart'
import { rowsBehind } from './rowsBehind'
import { withFullStop } from '../../../../../../shared/text/withFullStop'
import { plural } from '../../../../../../shared/text/translation'
import { words } from './words'

/** How the screen opens rows. */
export interface ForecastViewContext {
  readonly link: (drill: DrillTarget | null) => RouteLocationRaw | null
}

export interface ShownFigure {
  readonly key: string
  readonly label: string
  readonly cents: number
  readonly to: RouteLocationRaw | null
}

export interface PayoutView {
  readonly id: PayoutOptionId
  readonly name: string
  readonly label: string
  /** When it can be paid, in words. */
  readonly when: string
  /** Why the payout cannot be made as it stands, or null when nothing stops it. */
  readonly warning: string | null
  readonly figures: readonly ShownFigure[]
  readonly capitalProtected: boolean
  readonly rules: readonly RuleChip[]
}

/** One line of the plan against the ledger, its months under it. */
export interface PlanActualView {
  readonly key: string
  readonly label: string
  readonly plan: number
  readonly actual: number
  readonly difference: number
  /** In words, such as "120.00 more than planned". */
  readonly verdict: string
  readonly months: readonly { readonly key: string; readonly month: string; readonly plan: number; readonly actual: number; readonly difference: number }[]
}

const PAYOUT_NAMES: Readonly<Record<PayoutOptionId, string>> = words.payouts

const BASIS_WORDS: readonly (readonly [MonthBasis, string])[] = [
  ['actual', words.basis.actual],
  ['paid-ahead', words.basis['paid-ahead']],
  ['planned', words.basis.planned],
  ['averaged', words.basis.averaged],
]

/** The forecast of a year as the Year page shows it, or why it could not be made. */
export type ForecastState = { readonly state: 'unregistered' } | { readonly state: 'failed'; readonly failure: string } | { readonly state: 'ready'; readonly view: ForecastView }

export type ForecastView = ReturnType<typeof forecastView>

/** The forecast needs the day the company was registered, since the tax periods count from it. */
export function forecastState(workbook: HrDooWorkbook, year: number, asOf: CivilDate, context: ForecastViewContext): ForecastState {
  if (workbook.companyFacts.companyRegistered === null) {
    return { state: 'unregistered' }
  }
  try {
    return { state: 'ready', view: forecastView(workbook, year, asOf, context) }
  } catch (failure) {
    if (failure instanceof RangeError) {
      return { state: 'failed', failure: failure.message }
    }
    throw failure
  }
}

/** Everything the Forecast tab of the Year page shows for one year, seen on `asOf`, and the dividend capacity its Pay tab shows. */
function forecastView(workbook: HrDooWorkbook, year: number, asOf: CivilDate, context: ForecastViewContext) {
  const forecast = forecastYear(workbook, year, asOf)
  const capacity = dividendCapacity(year, forecast, workbook)
  const { calendar, taxBase: base, liability } = forecast
  const linkOf = (figure: TracedFigure | null): RouteLocationRaw | null => (figure === null ? null : context.link(figure.drill))
  const running = calendar.running !== null && yearOfMonth(calendar.running) === year ? calendar.running : null
  const forecastMonths = forecast.profitBeforeTax.months.filter(isGuessed).length
  const yearEnd = dayLabel(civilDate(year, 12, 31))

  const incomeLines = forecast.lines.filter((entry) => entry.line === 'sales' || entry.line === 'other-operating-income')
  const costLines = forecast.lines.filter((entry) => !incomeLines.includes(entry))
  const chartMonths = calendar.months.map((month, index): ForecastChartMonth => {
    const inMonth = (lines: typeof forecast.lines) => lines.map((entry) => entry.forecast.months[index] as ForecastMonth)
    const known = (lines: typeof forecast.lines) => rowsBehind(lines.flatMap((entry) => knownFigures(entry.parts, index)))
    const income = inMonth(incomeLines)
    const costs = inMonth(costLines)
    return {
      month,
      income: sumMoney(income.map((entry) => entry.figure.amount)),
      costs: sumMoney(costs.map((entry) => entry.figure.amount)),
      profit: (forecast.profitBeforeTax.months[index] as ForecastMonth).figure.amount,
      incomeForecast: income.some(isGuessed),
      costsForecast: costs.some(isGuessed),
      basis: basisWords((forecast.profitBeforeTax.months[index] as ForecastMonth).bases),
      incomeRows: known(incomeLines),
      costsRows: known(costLines),
    }
  })

  const profitAndLoss: BuildUpLine[] = [
    ...forecast.lines
      .filter((entry) => entry.line === 'sales' || entry.forecast.total.amount !== 0)
      .map((entry): BuildUpLine => ({
        key: entry.line,
        label: lineLabel('pl', entry.line),
        caption: basisCaption(entry.forecast),
        value: { cents: entry.forecast.total.amount },
        to: context.link(rowsBehind(entry.parts.flatMap((part) => part.line.months.flatMap((_, index) => knownFigures([part], index))))),
        total: false,
        steps: entry.parts.flatMap((part, index) => partSteps(part, `${index}`, year, context)),
        rules: ruleChips(entry.forecast.total.rules),
      })),
    {
      key: 'profit-before-tax',
      label: words.profitBeforeTax,
      caption: basisCaption(forecast.profitBeforeTax),
      value: { cents: forecast.profitBeforeTax.total.amount },
      to: null,
      total: true,
      steps: [],
      rules: ruleChips(base.profitBeforeTax.rules),
    },
  ]

  const pdLine = (key: string, figure: TracedFigure, total = false): BuildUpLine => ({
    key,
    label: figureLabel(figure),
    caption: null,
    value: { cents: figure.amount },
    to: linkOf(figure),
    total,
    steps: stepsOf(figure, linkOf),
    rules: ruleChips(figure.rules),
  })
  const pdReturn: BuildUpLine[] = [
    pdLine('revenue', base.revenue),
    pdLine('expenses', base.expenses),
    pdLine('profit', base.profitBeforeTax, true),
    pdLine('increases', base.increases),
    pdLine('decreases', base.decreases),
    pdLine('losses', base.lossesUsed),
    pdLine('base', base.base, true),
    {
      key: 'rate',
      label: liability.rate.label,
      caption: null,
      value: { text: percentText(liability.rate.basisPoints) },
      to: null,
      total: false,
      steps: [{ key: 'test', label: figureLabel(liability.rateTestRevenue), cents: liability.rateTestRevenue.amount, to: linkOf(liability.rateTestRevenue), depth: 0 }],
      rules: ruleChips(liability.rate.rules),
    },
    pdLine('liability', liability.liability, true),
    ...(liability.advancesPaid === null ? [] : [pdLine('advances', liability.advancesPaid)]),
    ...(liability.balanceDue === null ? [] : [pdLine('balance-due', liability.balanceDue)]),
    ...(liability.refund === null || liability.refund.amount === 0 ? [] : [pdLine('refund', liability.refund)]),
    pdLine('monthly-advance', liability.monthlyAdvance),
    pdLine('profit-after-tax', forecast.profitAfterTax, true),
  ]

  const less = (figure: TracedFigure): TracedFigure => ({ ...figure, amount: negateMoney(figure.amount) })
  const capacityLines: BuildUpLine[] = [
    pdLine('profit-after-tax', capacity.profitAfterTax),
    pdLine('retained', capacity.retainedEarnings),
    pdLine('losses', less(capacity.lossesBroughtForward)),
    pdLine('paid-out', less(capacity.paidOutInYear)),
    pdLine('distributable', capacity.distributable, true),
    pdLine('share-capital', capacity.shareCapital),
    pdLine('net-assets', capacity.netAssetsAtYearEnd),
    pdLine('max-payout', capacity.maxPayout, true),
  ]
  const { prudence } = capacity
  const prudenceLines: BuildUpLine[] = [
    pdLine('clawback', prudence.clawbackExposure),
    pdLine('cash', prudence.cashAtYearEnd),
    pdLine('balance-due', less(prudence.balanceDue)),
    pdLine('december', less(prudence.decemberDue)),
    pdLine('cash-after', prudence.cashAfterObligations, true),
    pdLine('owed', prudence.owedByOwner),
  ]

  const cashMonths = forecast.cashByMonth.map((entry): BuildUpLine => ({
    key: entry.month,
    label: monthLabel(entry.month),
    caption: entry.basis === 'ledger' ? words.cashMonth.ledger : words.cashMonth.projected,
    value: { cents: entry.closing.amount },
    to: entry.basis === 'ledger' ? linkOf(entry.closing) : null,
    total: entry.month === monthKey(year, 12),
    steps: entry.basis === 'ledger' ? [] : stepsOf(entry.closing, linkOf),
    rules: ruleChips(entry.closing.rules),
  }))
  const { runway } = forecast
  const compared = planAgainstActual(forecast).map((line): PlanActualView => ({
    key: line.key,
    label: line.label,
    plan: line.plan.amount,
    actual: line.actual.amount,
    difference: line.difference.amount,
    verdict: differenceWords(line.difference.amount, line.cost),
    months: line.months.map((entry) => ({ key: entry.month, month: monthLabel(entry.month), plan: entry.plan.amount, actual: entry.actual.amount, difference: entry.difference.amount })),
  }))
  const notCounted = new Map(forecast.notModelled.map((entry) => [entry.line.id, entry.reason]))
  const employment = workbook.grants.flatMap((grant): string[] => {
    const until = grant.employmentRequiredUntil
    if (until === null || yearOf(until) !== year) {
      return []
    }
    const dropped = forecast.ownerPay?.salaryDropped.find((entry) => entry.grant === grant.slug) ?? null
    const pay =
      forecast.ownerPay === null
        ? words.employment.noScenario
        : dropped === null
          ? words.employment.keepsSalary
          : words.employment.stopsSalary(dayLabel(dropped.from), dropped.atRisk === null ? null : formatMoney(dropped.atRisk.amount))
    return [words.employment.requires(grant.slug, dayLabel(until), pay)]
  })

  return {
    forecast,
    running,
    tiles: [
      {
        label: words.profitBeforeTax,
        value: formatMoney(base.profitBeforeTax.amount),
        to: null,
        caption: forecastMonths === 0 ? words.tiles.everyMonthFromLedger : words.tiles.fromLedgerAlone(12 - forecastMonths),
        definition: words.tiles.profitDefinition,
      },
      {
        label: words.tiles.corporateTax,
        value: formatMoney(liability.liability.amount),
        to: ruleLink('hr.cit.rate'),
        caption: words.tiles.taxAt(percentText(liability.rate.basisPoints), formatMoney(base.base.amount)),
        definition: words.tiles.taxDefinition,
      },
      {
        label: words.tiles.profitAfterTax,
        value: formatMoney(forecast.profitAfterTax.amount),
        to: null,
        caption: words.tiles.couldBePaidOut(formatMoney(capacity.maxPayout.amount)),
        definition: words.tiles.afterTaxDefinition,
      },
      {
        label: words.tiles.cashAtYearEnd,
        value: formatMoney(forecast.cashAtYearEnd.amount),
        to: null,
        caption: words.tiles.projectedFor(yearEnd),
        definition: words.tiles.cashDefinition(forecast.paymentLag.label),
      },
    ],
    chartMonths,
    profitAndLoss,
    profitAndLossSummary: words.profitAndLossSummary(formatMoney(forecast.profitBeforeTax.total.amount)),
    pdReturn,
    pdReturnSummary: words.pdReturnSummary(formatMoney(liability.liability.amount), formatMoney(liability.monthlyAdvance.amount)),
    dividend: {
      capacity: capacityLines,
      prudence: prudenceLines,
      deterioration: ruleChips([prudence.deterioration]),
      decideBy: dayLabel(capacity.decideBy),
      payouts: capacity.options.map((option) => payoutView(option, linkOf)),
      summary: words.tiles.couldBePaidOut(formatMoney(capacity.maxPayout.amount)),
    },
    cashMonths,
    cashSummary: words.cashSummary(formatMoney(forecast.cashAtYearEnd.amount), yearEnd),
    paymentLag: forecast.paymentLag.label,
    runway: runway.months === null ? null : { lasts: runwayInWords(runway.months), monthlyCost: runway.monthlyCost.amount },
    planActual: compared,
    planActualSummary: compared.length === 0 ? words.nothingToCompare : plural(words.lines(compared.length), compared.length),
    notCounted,
    employment,
    watched: watchedCitations([base.base, liability.liability, forecast.profitAfterTax, forecast.cashAtYearEnd, ...(forecast.ownerPay?.lines.map((entry) => entry.forecast.total) ?? [])]),
    uninvoiced: forecast.uninvoicedMonths.map((entry) => ({ month: monthLabel(entry.month), next: entry.nextInvoice.number })),
    rowsToInvoice: expectedInvoices(workbook.billingPlan, workbook.invoices)
      .filter((entry) => yearOfMonth(entry.month) === year)
      .reduce((count, entry) => count + entry.items.length, 0),
  }
}

/** A month a plan row or an average stands in for, in whole or in part. */
function isGuessed(entry: ForecastMonth): boolean {
  return entry.bases.includes('planned') || entry.bases.includes('averaged')
}

/** The figures of a month the ledger settles, from the parts of a line, which open their rows. */
function knownFigures(parts: readonly LinePart[], index: number): TracedFigure[] {
  return parts.flatMap((part) => {
    const entry = part.line.months[index]
    return entry !== undefined && entry.bases.length > 0 && !isGuessed(entry) ? [entry.figure] : []
  })
}

function basisWords(bases: readonly MonthBasis[]): string {
  const named = BASIS_WORDS.filter(([basis]) => bases.includes(basis)).map(([, word]) => word)
  if (named.length > 0) {
    return named.join(words.basis.and)
  }
  return bases.includes('scheduled') ? words.basis.scheduled : words.basis.nothing
}

/** "Jan to Sep from the ledger, Oct averaged, Nov to Dec planned", or "Every month …" when one basis holds the year. */
function basisCaption(line: ForecastLine): string {
  const runs: { first: MonthKey; last: MonthKey; basis: string }[] = []
  for (const entry of line.months) {
    const basis = basisWords(entry.bases)
    const previous = runs[runs.length - 1]
    if (previous !== undefined && previous.basis === basis) {
      previous.last = entry.month
    } else {
      runs.push({ first: entry.month, last: entry.month, basis })
    }
  }
  const [only] = runs
  if (runs.length === 1 && only !== undefined) {
    return words.basis.everyMonth(only.basis)
  }
  return runs.map((run) => words.basis.run(run.first, run.last, run.basis)).join(', ')
}

/** A part of a profit and loss line, with the months a plan row or an average stands in for under it. */
function partSteps(part: LinePart, key: string, year: number, context: ForecastViewContext): BuildUpStep[] {
  const { line, sign } = part
  if (line.total.amount === 0) {
    return []
  }
  const scheduled = line.total.basis === 'assets'
  const rows = rowsBehind(line.months.flatMap((_, index) => knownFigures([part], index)))
  const guessed = line.months.filter(isGuessed)
  return [
    {
      key,
      label: line.label,
      cents: sign * line.total.amount,
      to: rows === null ? (scheduled ? { path: '/company/year', query: { year: String(year), tab: 'assets' } } : null) : context.link(rows),
      depth: 0,
    },
    ...guessed.map((entry): BuildUpStep => ({ key: `${key}-${entry.month}`, label: `${monthLabel(entry.month)}, ${basisWords(entry.bases)}`, cents: sign * entry.figure.amount, to: null, depth: 1 })),
  ]
}

function differenceWords(difference: number, cost: boolean): string {
  if (difference === 0) {
    return words.asPlanned
  }
  return words.difference(formatMoney(Math.abs(difference) as Money), cost, difference > 0)
}

function payoutView(option: PayoutOption, linkOf: (figure: TracedFigure | null) => RouteLocationRaw | null): PayoutView {
  const shown = (key: string, label: string, figure: TracedFigure | null): ShownFigure[] => (figure === null ? [] : [{ key, label, cents: figure.amount, to: linkOf(figure) }])
  const { cashNow } = option
  const cashShort = cashNow !== null && cashNow.largestPayout.amount < option.gross.amount
  return {
    id: option.id,
    name: PAYOUT_NAMES[option.id],
    label: option.label,
    when: option.earliestOn === null || option.latestOn === null ? withFullStop(figureLabel(option.gross)) : words.payout.when(dayLabel(option.earliestOn), dayLabel(option.latestOn)),
    warning: cashShort ? interimCashWarning(cashNow) : null,
    figures: [
      ...shown('gross', words.payout.gross, option.gross),
      ...shown('tax', words.payout.tax, option.dividendTax),
      ...shown('net', words.payout.net, option.net),
      ...shown('set-off', words.payout.setOff, option.setOff),
      ...shown('cash-out', words.payout.cashOut, option.cashOut),
      ...shown('cash-left', cashNow === null ? words.payout.cashLeft : words.payout.cashLeftAfter(dueOn(cashNow)), option.cashLeft),
      ...(cashShort ? shown('cash-allows', words.payout.cashAllows, cashNow.largestPayout) : []),
      ...shown('owed-after', words.payout.owedAfter, option.owedByOwnerAfter),
      ...shown('benefit', words.payout.benefit, option.loanBenefitPerYear),
      ...shown('net-assets', words.payout.netAssets, option.netAssetsAfter),
      ...shown('clawback', words.payout.clawback, option.clawbackExposure),
      ...shown('shortfall', words.payout.shortfall, option.shortfall),
      ...shown('retained', words.payout.retained, option.retainedAfter),
    ],
    capitalProtected: option.capitalProtected,
    rules: ruleChips([option.gross, option.dividendTax, option.loanBenefitPerYear, ...(option.shortfall === null ? [] : [option.shortfall])].flatMap((figure) => figure.rules)),
  }
}

function interimCashWarning(cash: InterimCash): string {
  return words.payout.cashShort(figureLabel(cash.cash), dueOn(cash), formatMoney(cash.largestPayout.amount))
}

/** The day by which what the cash must still pay falls due, or null when it names none. */
function dueOn(cash: InterimCash): string | null {
  return cash.fallingDue.on === null ? null : dayLabel(cash.fallingDue.on)
}
