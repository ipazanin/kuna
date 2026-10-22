import type { RouteLocationRaw } from 'vue-router'

import type { DrillTarget } from '../../../../features/filters/domain/drillTarget'
import { runwayInWords } from '../../../../features/overview/domain/headline'
import type { Workbook } from '../../../../features/workbook/domain/workbook'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthKey, yearOfMonth } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { negateMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney, formatWholeMoney } from '../../../../shared/money/moneyFormat'
import { dayLabel, ruleLink } from '../../ruleset/presentation/ruleWording'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { dividendCapacity } from '../../domain/dividend/dividendCapacity'
import type { InterimCash, PayoutOption, PayoutOptionId } from '../../domain/dividend/dividendCapacity'
import type { ForecastLine, ForecastMonth, LinePart, MonthBasis } from '../../domain/forecast/forecastLines'
import { forecastYear } from '../../domain/forecast/forecastYear'
import { planAgainstActual } from '../../domain/forecast/planAgainstActual'
import { percentText } from '../../domain/payroll/payrollArithmetic'
import { citObligationLine } from '../CitObligationList.vue'
import type { CitObligationLine } from '../CitObligationList.vue'
import { missingAccrualRoles } from '../accrualRoles'
import { figureLabel, ruleChips, stepsOf, watchedIn } from '../tracedFigureView'
import type { BuildUpStep, RuleChip } from '../yearEnd/LineBuildUp.vue'
import { lineLabel } from '../yearEnd/yearEndWording'
import type { BuildUpLine } from './BuildUpList.vue'
import type { ForecastChartMonth } from './forecastChart'
import { rowsBehind } from './rowsBehind'

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

const PAYOUT_NAMES: Readonly<Record<PayoutOptionId, string>> = {
  'after-adoption': 'One payout next year',
  interim: 'Interim payout now',
  keep: 'Keep it in the company',
}

const BASIS_WORDS: readonly (readonly [MonthBasis, string])[] = [
  ['actual', 'from the ledger'],
  ['paid-ahead', 'paid ahead'],
  ['planned', 'planned'],
  ['averaged', 'averaged'],
]

const SHORT_MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' })

/** Everything the Forecast screen shows for one year, seen on `asOf`. */
export function forecastView(workbook: Workbook, year: number, asOf: CivilDate, context: ForecastViewContext) {
  const forecast = forecastYear(workbook, year, asOf)
  const capacity = dividendCapacity(year, forecast, workbook)
  const { calendar, taxBase: base, liability, cit } = forecast
  const linkOf = (figure: TracedFigure | null): RouteLocationRaw | null => (figure === null ? null : context.link(figure.drill))
  const running = calendar.running !== null && yearOfMonth(calendar.running) === year ? calendar.running : null
  const forecastMonths = forecast.profitBeforeTax.months.filter(isGuessed).length

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
      .map(
        (entry): BuildUpLine => ({
          key: entry.line,
          label: lineLabel('pl', entry.line),
          caption: basisCaption(entry.forecast),
          value: { cents: entry.forecast.total.amount },
          to: context.link(rowsBehind(entry.parts.flatMap((part) => part.line.months.flatMap((_, index) => knownFigures([part], index))))),
          total: false,
          steps: entry.parts.flatMap((part, index) => partSteps(part, `${index}`, context)),
          rules: ruleChips(entry.forecast.total.rules),
        }),
      ),
    {
      key: 'profit-before-tax',
      label: 'Profit before tax',
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

  const cashMonths = forecast.cashByMonth.map(
    (entry): BuildUpLine => ({
      key: entry.month,
      label: monthLabel(entry.month),
      caption: entry.basis === 'ledger' ? 'The bank balance at the month end' : 'Projected',
      value: { cents: entry.closing.amount },
      to: entry.basis === 'ledger' ? linkOf(entry.closing) : null,
      total: entry.month === monthKey(year, 12),
      steps: entry.basis === 'ledger' ? [] : stepsOf(entry.closing, linkOf),
      rules: ruleChips(entry.closing.rules),
    }),
  )
  const { runway } = forecast
  const compared = planAgainstActual(forecast).map(
    (line): PlanActualView => ({
      key: line.key,
      label: line.label,
      plan: line.plan.amount,
      actual: line.actual.amount,
      difference: line.difference.amount,
      verdict: differenceWords(line.difference.amount, line.cost),
      months: line.months.map((entry) => ({ key: entry.month, month: monthLabel(entry.month), plan: entry.plan.amount, actual: entry.actual.amount, difference: entry.difference.amount })),
    }),
  )
  const notCounted = new Map(forecast.notModelled.map((entry) => [entry.line.sheetRow, entry.reason]))
  const employment = workbook.grants.flatMap((grant): string[] => {
    const until = grant.employmentRequiredUntil
    if (until === null || yearOf(until) !== year) {
      return []
    }
    const dropped = forecast.ownerPay?.salaryDropped.find((entry) => entry.grant === grant.slug) ?? null
    const pay =
      forecast.ownerPay === null
        ? 'The plan sets no owner pay scenario, so the owner pay categories carry on as they are.'
        : dropped === null
          ? 'The planned owner pay keeps a salary until then.'
          : `The planned owner pay stops the salary on ${dayLabel(dropped.from)}${dropped.atRisk === null ? '' : `, which puts ${formatMoney(dropped.atRisk.amount)} at risk`}.`
    return [`${grant.slug} requires the employment until ${dayLabel(until)}. ${pay}`]
  })

  return {
    forecast,
    running,
    tiles: [
      {
        label: 'Profit before tax',
        value: formatWholeMoney(base.profitBeforeTax.amount),
        to: null,
        caption: forecastMonths === 0 ? 'Every month from the ledger' : `${12 - forecastMonths} of 12 months from the ledger alone`,
        definition: 'Income less costs on the accrual view, as the accountant books them. Months the ledger has not closed take the plan row, or for revenue the billing plan’s rows still to invoice, else the line’s average.',
      },
      {
        label: 'Corporate tax',
        value: formatWholeMoney(liability.liability.amount),
        to: ruleLink('hr.cit.rate'),
        caption: `At ${percentText(liability.rate.basisPoints)} on a base of ${formatWholeMoney(base.base.amount)}`,
        definition: 'PD line 53, the tax on the base after the add-backs. Opens the rule with the rates.',
      },
      {
        label: 'Profit after tax',
        value: formatWholeMoney(forecast.profitAfterTax.amount),
        to: null,
        caption: `${formatWholeMoney(capacity.maxPayout.amount)} could be paid out`,
        definition: 'Profit before tax less the corporate tax of the year. What can be paid out also counts earlier years and the share capital.',
      },
      {
        label: 'Cash at the year end',
        value: formatWholeMoney(forecast.cashAtYearEnd.amount),
        to: null,
        caption: runway.months === null ? `Projected for 31 Dec ${year}` : `Lasts ${runwayInWords(runway.months)} at the cost of Oct to Dec`,
        definition: `Cash on the newest booking, then each month as it would be paid: revenue when the client pays, open invoices, the VAT position, costs, purchases, the dividend and the corporate tax. ${forecast.paymentLag.label}. Runway is this cash over the average monthly cost of the year's last three months, corporate tax included and depreciation left out, as Overview counts it. A planning projection, not a bank balance.`,
      },
    ],
    chartMonths,
    profitAndLoss,
    profitAndLossSummary: `Profit before tax ${formatWholeMoney(forecast.profitBeforeTax.total.amount)}`,
    pdReturn,
    pdReturnSummary: `Tax ${formatWholeMoney(liability.liability.amount)}, a monthly advance of ${formatWholeMoney(liability.monthlyAdvance.amount)}`,
    obligations: cit.obligations.map((entry): CitObligationLine => citObligationLine(entry, linkOf)),
    obligationsSummary: `${formatWholeMoney(cit.advancesPaid.amount)} paid, ${formatWholeMoney(cit.advancesToCome.amount)} still to come`,
    advancesPaid: cit.advancesPaid,
    advancesToCome: cit.advancesToCome,
    balanceDue: cit.balanceDue === null ? null : { label: cit.balanceDue.expected.label, cents: cit.balanceDue.expected.amount, dueOn: dayLabel(cit.balanceDue.dueOn), rules: ruleChips(cit.balanceDue.expected.rules) },
    refund: liability.refund !== null && liability.refund.amount > 0 ? liability.refund.amount : null,
    newAdvance:
      cit.newAdvance === null || cit.newAdvance.month === null
        ? null
        : { month: monthLabel(cit.newAdvance.month), cents: cit.newAdvance.expected.amount, dueOn: dayLabel(cit.newAdvance.dueOn), rules: ruleChips(cit.newAdvance.expected.rules) },
    unmatched: cit.unmatched.map((figure, index): ShownFigure => ({ key: `${index}`, label: figureLabel(figure), cents: figure.amount, to: linkOf(figure) })),
    capacityLines,
    prudenceLines,
    deterioration: ruleChips([prudence.deterioration]),
    decideBy: dayLabel(capacity.decideBy),
    payouts: capacity.options.map((option) => payoutView(option, linkOf)),
    cashMonths,
    cashSummary: `${formatWholeMoney(forecast.cashAtYearEnd.amount)} on 31 Dec ${year}`,
    paymentLag: forecast.paymentLag.label,
    runway: runway.months === null ? null : { lasts: runwayInWords(runway.months), monthlyCost: runway.monthlyCost.amount },
    planActual: compared,
    planActualSummary: compared.length === 0 ? 'Nothing to compare yet' : `${compared.length} ${compared.length === 1 ? 'line' : 'lines'}`,
    notCounted,
    employment,
    grantReleased: forecast.grantRelease.total.amount,
    watched: watchedIn([base.base, liability.liability, forecast.profitAfterTax, forecast.cashAtYearEnd, ...(forecast.ownerPay?.lines.map((entry) => entry.forecast.total) ?? [])]),
    uninvoiced: forecast.uninvoicedMonths.map((entry) => ({ month: monthLabel(entry.month), next: entry.nextInvoice.number })),
    missingRoles: missingAccrualRoles(workbook.categories),
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
  const words = BASIS_WORDS.filter(([basis]) => bases.includes(basis)).map(([, word]) => word)
  if (words.length > 0) {
    return words.join(' and ')
  }
  return bases.includes('scheduled') ? 'from the asset and grant schedules' : 'nothing'
}

/** "Jan to Sep from the ledger, Oct averaged, Nov to Dec planned", or "Every month …" when one basis holds the year. */
function basisCaption(line: ForecastLine): string {
  const runs: { first: MonthKey; last: MonthKey; words: string }[] = []
  for (const entry of line.months) {
    const words = basisWords(entry.bases)
    const previous = runs[runs.length - 1]
    if (previous !== undefined && previous.words === words) {
      previous.last = entry.month
    } else {
      runs.push({ first: entry.month, last: entry.month, words })
    }
  }
  const [only] = runs
  if (runs.length === 1 && only !== undefined) {
    return `Every month ${only.words}`
  }
  const short = (month: MonthKey) => SHORT_MONTH.format(new Date(`${month}-01T00:00:00Z`))
  return runs.map((run) => `${run.first === run.last ? short(run.first) : `${short(run.first)} to ${short(run.last)}`} ${run.words}`).join(', ')
}

/** A part of a profit and loss line, with the months a plan row or an average stands in for under it. */
function partSteps(part: LinePart, key: string, context: ForecastViewContext): BuildUpStep[] {
  const { line, sign } = part
  if (line.total.amount === 0) {
    return []
  }
  const scheduled = line.total.basis === 'assets'
  const rows = rowsBehind(line.months.flatMap((_, index) => knownFigures([part], index)))
  const guessed = line.months.filter(isGuessed)
  return [
    { key, label: line.label, cents: sign * line.total.amount, to: rows === null ? (scheduled ? { path: '/assets' } : null) : context.link(rows), depth: 0 },
    ...guessed.map(
      (entry): BuildUpStep => ({ key: `${key}-${entry.month}`, label: `${monthLabel(entry.month)}, ${basisWords(entry.bases)}`, cents: sign * entry.figure.amount, to: null, depth: 1 }),
    ),
  ]
}

function differenceWords(difference: number, cost: boolean): string {
  if (difference === 0) {
    return 'As planned'
  }
  const more = difference > 0
  return `${formatMoney(Math.abs(difference) as Money)} ${cost ? (more ? 'more spent' : 'less spent') : more ? 'more' : 'less'} than planned`
}

function payoutView(option: PayoutOption, linkOf: (figure: TracedFigure | null) => RouteLocationRaw | null): PayoutView {
  const shown = (key: string, label: string, figure: TracedFigure | null): ShownFigure[] => (figure === null ? [] : [{ key, label, cents: figure.amount, to: linkOf(figure) }])
  const { cashNow } = option
  const cashShort = cashNow !== null && cashNow.largestPayout.amount < option.gross.amount
  return {
    id: option.id,
    name: PAYOUT_NAMES[option.id],
    label: option.label,
    when:
      option.earliestOn === null || option.latestOn === null
        ? `${figureLabel(option.gross)}.`
        : `Earliest on ${dayLabel(option.earliestOn)}, and no later than ${dayLabel(option.latestOn)}.`,
    warning: cashShort ? interimCashWarning(cashNow) : null,
    figures: [
      ...shown('gross', 'Payout before tax', option.gross),
      ...shown('tax', 'Dividend tax', option.dividendTax),
      ...shown('net', 'Net to the owner', option.net),
      ...shown('set-off', 'Set off against what the owner owes', option.setOff),
      ...shown('cash-out', 'Paid out in cash, with the tax', option.cashOut),
      ...shown('cash-left', cashNow === null ? 'Cash left after it' : `Cash left after it and ${dueWords(cashNow)}`, option.cashLeft),
      ...(cashShort ? shown('cash-allows', 'The most the cash allows now', cashNow.largestPayout) : []),
      ...shown('owed-after', 'The owner still owes', option.owedByOwnerAfter),
      ...shown('benefit', 'Loan benefit in kind a year', option.loanBenefitPerYear),
      ...shown('net-assets', 'Net assets after it', option.netAssetsAfter),
      ...shown('clawback', 'Grant clawback at risk', option.clawbackExposure),
      ...shown('shortfall', 'Taxed as the owner’s income', option.shortfall),
      ...shown('retained', 'Kept in the company', option.retainedAfter),
    ],
    capitalProtected: option.capitalProtected,
    rules: ruleChips([option.gross, option.dividendTax, option.loanBenefitPerYear, ...(option.shortfall === null ? [] : [option.shortfall])].flatMap((figure) => figure.rules)),
  }
}

function interimCashWarning(cash: InterimCash): string {
  return `${figureLabel(cash.cash)}, less ${dueWords(cash)}, does not cover this payout and its tax. It covers an interim payout of at most ${formatWholeMoney(cash.largestPayout.amount)}.`
}

function dueWords(cash: InterimCash): string {
  return cash.fallingDue.on === null ? 'what falls due' : `what falls due by ${dayLabel(cash.fallingDue.on)}`
}
