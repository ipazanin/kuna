import { describe, expect, it, vi } from 'vitest'

import { paymentsByYear } from '../src/apps/loans/bankLoans/domain/loanFigures'
import { loanPlan } from '../src/apps/loans/bankLoans/domain/loanPlan'
import { paymentsChart } from '../src/apps/loans/bankLoans/presentation/paymentsChart'
import { subsidyColourOf } from '../src/apps/loans/bankLoans/presentation/subsidyColour'
import { splitOfRows } from '../src/apps/loans/bankLoans/domain/loanFigures'
import { NO_COSTS } from '../src/apps/loans/scenarios/domain/loanScenario'
import { scenarioPlan } from '../src/apps/loans/scenarios/domain/scenarioPlan'
import type { ScenarioPlan } from '../src/apps/loans/scenarios/domain/scenarioPlan'
import { scenarioBalanceChart, scenarioInterestChart } from '../src/apps/loans/scenarios/presentation/scenarioCharts'
import type { ChartedScenario } from '../src/apps/loans/scenarios/presentation/scenarioCharts'
import { scenarioMonths } from '../src/apps/loans/scenarios/presentation/scenarioMonths'
import type { LoanChange } from '../src/apps/loans/scenarios/domain/loanScenario'
import { balanceChart } from '../src/apps/loans/balances/presentation/balanceChart'
import { DOT_SIZE, RING_SIZE } from '../src/shared/charts/chartDots'
import { yearStep } from '../src/shared/charts/monthAxis'
import type { BalanceMove, MonthBalance } from '../src/apps/loans/balances/presentation/balanceChart'
import type { ChartTokens } from '../src/shared/charts/chartTokens'
import { parseMonthKey } from '../src/shared/calendar/monthKey'
import { ZERO } from '../src/shared/money/money'
import { formatCompactMoney, formatMoney } from '../src/shared/money/moneyFormat'
import { civil, euros } from './fixtures/ledger'
import { bankLoan, extraPayment, ratePeriod } from './fixtures/loans'

const TOKENS = new Proxy({}, { get: (_target, name) => String(name) }) as unknown as ChartTokens

interface DrawnSeries {
  name: string
  type: string
  data: unknown[]
}

function seriesOf(chart: { option: unknown }): DrawnSeries[] {
  return (chart.option as { series: DrawnSeries[] }).series
}

/** A bar's value, whether it is a plain number or carries a rounded top. */
function valueOf(point: unknown): number {
  return typeof point === 'number' ? point : (point as { value: number }).value
}

function tooltipOf(chart: { option: unknown }, label: string): string {
  const formatter = (chart.option as { tooltip: { formatter: (points: unknown) => string } }).tooltip.formatter
  return formatter([{ seriesName: 'Principal you pay', axisValueLabel: label, value: 100, color: 'red' }])
}

// The charts read their loan colours from the page, which a spec has none of, so each token reads as its own name.
vi.stubGlobal('document', { documentElement: {} })
vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (token: string) => token }))

describe('the payments chart', () => {
  // 1,200.00 over 18 instalments from 2026-02-05, a subsidy of 50.00 on instalments 1 to 5 (to 2026-06-05) and an extra 300.00 on 2026-04-20.
  const loan = bankLoan({ instalments: 18, subsidy: { monthly: euros(50), firstInstalment: 1, instalments: 5, payer: 'APN' } })
  const plan = loanPlan(loan, [ratePeriod(loan, '2026-02-05', '12')], [extraPayment(loan, '2026-04-20', 300, 'shorter-term')])
  const years = paymentsByYear(plan)
  const chart = paymentsChart(years, 2026, 'APN', TOKENS, false, 2027)

  it('stacks the extra payment, your principal, the subsidy principal, the subsidy interest and your interest, in that order, with the rule for the years to come last', () => {
    expect(seriesOf(chart).map((series) => series.name)).toEqual(['Extra payment', 'Principal you pay', 'Principal APN pays', 'Interest APN pays', 'Interest you pay', ''])
    expect([chart.hasSubsidy, chart.hasExtra, chart.hasAhead]).toEqual([true, true, true])
  })

  it('draws each year from the payments of that year and rounds only the top part of a bar', () => {
    const [extra, principal, subsidyPrincipal, subsidyInterest, interest] = seriesOf(chart)

    expect(extra!.data.map(valueOf)).toEqual(years.map((entry) => entry.extra))
    expect(principal!.data.map(valueOf)).toEqual(years.map((entry) => entry.principal))
    expect(subsidyPrincipal!.data.map(valueOf)).toEqual(years.map((entry) => entry.subsidyPrincipal))
    expect(subsidyInterest!.data.map(valueOf)).toEqual(years.map((entry) => entry.subsidyInterest))
    expect(interest!.data.map(valueOf)).toEqual(years.map((entry) => entry.interest))
    // Every year here pays interest, so the interest series holds the top of each bar.
    expect(interest!.data.every((point) => typeof point === 'object')).toBe(true)
    expect(principal!.data.every((point) => typeof point === 'number')).toBe(true)
  })

  it('runs the brass band from the current year on, and leaves out a part or a band that nothing needs', () => {
    const withoutExtra = paymentsChart(paymentsByYear(loanPlan(loan, [ratePeriod(loan, '2026-02-05', '12')], [])), 2026, 'APN', TOKENS, false, null)
    const inLastYear = paymentsChart(years, 2027, 'APN', TOKENS, false, null)

    expect(seriesOf(chart).at(-1)!.data).toEqual([0, 0])
    expect(seriesOf(withoutExtra).map((series) => series.name)).not.toContain('Extra payment')
    expect(inLastYear.hasAhead).toBe(false)
    expect(seriesOf(inLastYear).map((series) => series.name)).not.toContain('')
  })

  it('describes the subsidy total over the subsidised years and the year with the most interest', () => {
    const subsidised = formatMoney(years.reduce((total, entry) => total + entry.subsidyPrincipal + entry.subsidyInterest, 0))
    const interest = (entry: (typeof years)[number]): number => entry.interest + entry.subsidyInterest
    const most = years.reduce((largest, entry) => (interest(entry) > interest(largest) ? entry : largest))

    expect(chart.description).toContain(`APN pays ${subsidised} of them from 2026 to 2026.`)
    expect(chart.description).toContain(`Interest is largest in ${most.year} at ${formatMoney(interest(most))}`)
  })

  it('adds what you pay, what the subsidy pays and the estimate to the tooltip of a year', () => {
    const first = years[0]!
    const youPay = formatMoney(first.principal + first.interest + first.extra)

    expect(tooltipOf(chart, '2026')).toContain(`You pay ${youPay}`)
    expect(tooltipOf(chart, '2026')).toContain('APN pays')
    expect(tooltipOf(chart, '2026')).not.toContain('estimate')
    expect(tooltipOf(chart, '2027')).toContain('Includes an estimate at the variable rate')
    expect(tooltipOf(chart, '2027')).not.toContain('APN pays')
  })

  it('keys the subsidy by the part it pays', () => {
    const none = { subsidyPrincipal: ZERO, subsidyInterest: ZERO }

    expect(subsidyColourOf({ ...none, subsidyInterest: euros(1) })).toBe('var(--loan-interest)')
    expect(subsidyColourOf({ ...none, subsidyPrincipal: euros(1) })).toBe('var(--loan-principal)')
    expect(subsidyColourOf({ subsidyPrincipal: euros(1), subsidyInterest: euros(1) })).toBe('var(--chart-deemphasis)')
  })
})

describe('the balance chart', () => {
  const OWED = { token: '--loan-you-owe' }
  const months: MonthBalance[] = ['2026-09', '2026-10', '2026-11', '2026-12'].map((month, index) => ({ month: parseMonthKey(month)!, owed: euros(1000 - index * 100) }))
  const current = parseMonthKey('2026-10')!

  it('draws owed so far up to the current month and the plan from it, sharing the current month', () => {
    const series = seriesOf(balanceChart(months, current, TOKENS, false, OWED))

    expect(series.map((entry) => entry.name)).toEqual(['Owed so far', 'Still to come, by the plan'])
    expect(series[0]!.data).toEqual([euros(1000), euros(900), null, null])
    expect(series[1]!.data).toEqual([null, euros(900), euros(800), euros(700)])
  })

  it('draws only owed so far when no month is after the current one', () => {
    expect(seriesOf(balanceChart(months, parseMonthKey('2026-12')!, TOKENS, false, OWED)).map((entry) => entry.name)).toEqual(['Owed so far'])
  })

  it('notes the variable rate in the tooltip from its month on at every width, and marks it on the chart only on a wide screen', () => {
    const estimateFrom = parseMonthKey('2026-11')!
    const wide = balanceChart(months, current, TOKENS, false, { ...OWED, estimateFrom })
    const phone = balanceChart(months, current, TOKENS, true, { ...OWED, estimateFrom })

    for (const chart of [wide, phone]) {
      expect(tooltipOf(chart, '2026-10')).not.toContain('estimate')
      expect(tooltipOf(chart, '2026-11')).toContain('An estimate at the variable rate')
    }
    expect(seriesOf(wide)[1]).toHaveProperty('markArea')
    expect(seriesOf(phone)[1]).not.toHaveProperty('markArea')
  })

  it("marks a month's moves as one dot per effect on its balance, all one size, a new rate as a wider ring around its month, and names them in the tooltip", () => {
    const moves: BalanceMove[] = [
      { date: civil('2026-09-20'), kind: 'Instalment 1', amount: euros(100), note: '', effect: 'lowers' },
      { date: civil('2026-09-25'), kind: 'Extra payment', amount: euros(300), note: '', effect: 'lowers' },
      { date: civil('2026-10-02'), kind: 'Borrowed', amount: euros(100), note: 'Boat parts', effect: 'raises' },
      { date: civil('2026-10-20'), kind: 'Repaid', amount: euros(20), note: '', effect: 'lowers' },
      { date: civil('2026-11-20'), kind: 'New rate 3.85%, variable', amount: null, note: '6M EURIBOR + 1.20', effect: 'rate' },
      { date: civil('2027-03-01'), kind: 'Repaid', amount: euros(50), note: '', effect: 'lowers' },
    ]
    const chart = balanceChart(months, current, TOKENS, false, { ...OWED, moves })
    const [, , lowers, raises, rate] = seriesOf(chart) as unknown as {
      symbolSize: number
      z: number
      itemStyle: { color: string; borderColor: string; borderWidth: number }
      data: ('-' | { value: number; symbolOffset: [number, number] })[]
    }[]

    // September's 400.00 and October's 20.00 are one size. October also raised what is owed, so its two dots sit 5 px either side of the month.
    // The move of March 2027 falls outside the months.
    expect(lowers!.data).toEqual([{ value: euros(1000), symbolOffset: [0, 0] }, { value: euros(900), symbolOffset: [-5, 0] }, '-', '-'])
    expect(raises!.data).toEqual(['-', { value: euros(900), symbolOffset: [5, 0] }, '-', '-'])
    expect(rate!.data).toEqual(['-', '-', { value: euros(800), symbolOffset: [0, 0] }, '-'])
    expect([lowers, raises, rate].map((series) => [series!.symbolSize, series!.z, series!.itemStyle])).toEqual([
      [DOT_SIZE, 3, { color: '--loan-lowers', borderColor: 'surface', borderWidth: 1 }],
      [DOT_SIZE, 3, { color: '--loan-raises', borderColor: 'surface', borderWidth: 1 }],
      [RING_SIZE, 4, { color: 'transparent', borderColor: '--loan-interest', borderWidth: 2 }],
    ])
    expect(tooltipOf(chart, '2026-09')).toContain('20 Sep · Instalment 1 €100.00')
    expect(tooltipOf(chart, '2026-11')).toContain('20 Nov · New rate 3.85%, variable · 6M EURIBOR + 1.20')
    expect(chart.legend.map((entry) => [entry.label, entry.colour, entry.mark])).toEqual([
      ['Owed so far', 'var(--loan-you-owe)', 'line'],
      ['Still to come, by the plan', 'var(--loan-ahead)', 'dashed'],
      ['Lowers what is owed', 'var(--loan-lowers)', 'dot'],
      ['Raises what is owed', 'var(--loan-raises)', 'dot'],
      ['Rate change', 'var(--loan-interest)', 'ring'],
    ])
    expect(chart.description).toContain(' Dots mark the 5 movements on their months: what lowers the debt, what raises the debt and a new rate as a ring. A month’s movements of one kind share a dot.')
  })

  it("leaves today's dot out in a month whose payment or borrowing has a dot on the same balance, so that dot shows", () => {
    const todayDot = (moves: BalanceMove[]) =>
      (seriesOf(balanceChart(months, current, TOKENS, false, { ...OWED, moves }))[0] as unknown as { markPoint: { data: { coord: unknown }[] } }).markPoint.data
    const repaidThisMonth: BalanceMove[] = [{ date: civil('2026-10-20'), kind: 'Instalment 2', amount: euros(100), note: '', effect: 'lowers' }]
    const newRateThisMonth: BalanceMove[] = [{ date: civil('2026-10-20'), kind: 'New rate 3.85%, variable', amount: null, note: '', effect: 'rate' }]

    expect(todayDot([])).toEqual([expect.objectContaining({ coord: [current, euros(900)] })])
    expect(todayDot(repaidThisMonth)).toEqual([])
    // A ring is open, so today's dot still shows inside it.
    expect(todayDot(newRateThisMonth)).toEqual([expect.objectContaining({ coord: [current, euros(900)] })])
  })

  it('describes only the dots the chart draws', () => {
    const payments: BalanceMove[] = [
      { date: civil('2026-09-20'), kind: 'Instalment 1', amount: euros(100), note: '', effect: 'lowers' },
      { date: civil('2026-10-20'), kind: 'Instalment 2', amount: euros(100), note: '', effect: 'lowers' },
    ]
    const rateOnly: BalanceMove[] = [{ date: civil('2026-11-20'), kind: 'New rate 3.85%, variable', amount: null, note: '', effect: 'rate' }]

    expect(balanceChart(months, current, TOKENS, false, { ...OWED, moves: payments }).description).toContain(
      ' Dots mark the 2 movements on their months: what lowers the debt. A month’s movements of one kind share a dot.',
    )
    expect(balanceChart(months, current, TOKENS, false, { ...OWED, moves: rateOnly }).description).toMatch(/ A dot marks the one movement on its month: a new rate as a ring\.$/)
  })

  it("draws an informal loan's expected plan as one brass dashed line with no wash, and never its months after today as a plan", () => {
    // The plan has 950.00 at the end of Sep, 850.00 at the end of Oct and nothing from Nov, while a repayment typed ahead for Dec keeps its dot.
    const expected: MonthBalance[] = [
      { month: parseMonthKey('2026-09')!, owed: euros(950) },
      { month: parseMonthKey('2026-10')!, owed: euros(850) },
      { month: parseMonthKey('2026-11')!, owed: ZERO },
    ]
    const ahead: BalanceMove[] = [{ date: civil('2026-12-03'), kind: 'Repaid', amount: euros(100), note: '', effect: 'lowers' }]
    const chart = balanceChart(months, current, TOKENS, false, { ...OWED, moves: ahead, expected })
    const series = seriesOf(chart) as unknown as { name: string; lineStyle?: { type?: unknown }; areaStyle?: unknown; data: unknown[] }[]

    expect(series.map((entry) => entry.name)).toEqual(['Owed so far', 'Expected by the plan', ''])
    expect(series[1]!.data).toEqual([euros(950), euros(850), ZERO, null])
    expect(series[1]!.lineStyle?.type).toEqual([5, 4])
    expect(series[1]).not.toHaveProperty('areaStyle')
    expect(series[2]!.data).toEqual(['-', '-', '-', { value: euros(700), symbolOffset: [0, 0] }])
    expect(chart.legend.map((entry) => [entry.label, entry.colour, entry.mark])).toEqual([
      ['Owed so far', 'var(--loan-you-owe)', 'line'],
      ['Expected by the plan', 'var(--loan-ahead)', 'dashed'],
      ['Lowers what is owed', 'var(--loan-lowers)', 'dot'],
    ])
    expect(chart.description).toContain(
      ` The dashed line is what would be owed at each month end had every instalment of the expected plan been paid, ${formatMoney(euros(850))} at the end of Oct 2026. By the plan nothing is owed from Nov 2026.`,
    )
    expect(chart.description).not.toContain('The plan reaches')
  })

  it('names the month an expected plan owes nothing from out of the whole line, when the range shows only months after it', () => {
    // The plan reached zero in Mar 2026, and the chart shows Sep to Dec 2026, every one of them at zero by the plan.
    const expected: MonthBalance[] = ['2026-01', '2026-02', '2026-03', '2026-04'].map((month, index) => ({ month: parseMonthKey(month)!, owed: euros([200, 100, 0, 0][index]!) }))
    const flat: MonthBalance[] = [...expected, ...months.map((entry) => ({ month: entry.month, owed: ZERO }))]
    const chart = balanceChart(months, current, TOKENS, false, { ...OWED, expected: flat })

    expect(seriesOf(chart)[1]!.data).toEqual([ZERO, ZERO, ZERO, ZERO])
    expect(chart.description).toContain(' By the plan nothing is owed from Mar 2026.')
  })

  it('says where an expected plan still owes when the chart stops before it ends, and draws no plan line for a loan without one', () => {
    const expected: MonthBalance[] = months.map((entry) => ({ month: entry.month, owed: euros(2000) }))
    expect(balanceChart(months, current, TOKENS, false, { ...OWED, expected }).description).toContain(` By the plan ${formatMoney(euros(2000))} is still owed in Dec 2026, where the chart stops.`)

    const planless = balanceChart(months, current, TOKENS, false, { ...OWED, expected: [] })
    expect(seriesOf(planless).map((entry) => entry.name)).toEqual(['Owed so far'])
    expect(planless.legend.map((entry) => entry.label)).toEqual(['Owed so far'])
  })

  it('describes the span, the balance now and where the plan ends', () => {
    expect(balanceChart(months, current, TOKENS, false, OWED).description).toContain(`At the end of Oct 2026 it is ${formatMoney(euros(900))}.`)
    expect(balanceChart(months, current, TOKENS, false, OWED).description).toContain(`The plan reaches ${formatMoney(euros(700))} by Dec 2026.`)
    expect(balanceChart([], current, TOKENS, false, OWED).description).toBe('No months to show.')
  })
})

describe('the year step of a chart axis', () => {
  it('names every year on a short axis and thins a long one, more on a phone', () => {
    expect([yearStep(3, false), yearStep(12, false), yearStep(13, false), yearStep(30, false)]).toEqual([1, 1, 2, 2])
    expect([yearStep(3, true), yearStep(4, true), yearStep(5, true), yearStep(10, true), yearStep(11, true)]).toEqual([1, 1, 2, 2, 5])
  })
})

describe('the scenario charts', () => {
  // 1,200.00 over 12 instalments at 12% from 2026-02-05, compared from 2026-05-10: as it stands, 300.00 extra on 2026-07-05 for a
  // shorter term, and the same for a lower instalment, which ends when the loan does.
  const loan = bankLoan()
  const base = { loan, ratePeriods: [ratePeriod(loan, '2026-02-05', '12')], extraPayments: [], costs: NO_COSTS }
  const today = civil('2026-05-10')
  const planOf = (changes: readonly LoanChange[]): ScenarioPlan => {
    const plan = scenarioPlan(base, changes, today)
    if ('refused' in plan) throw new Error(plan.refused)
    return plan
  }
  const extra = (effect: 'shorter-term' | 'lower-instalment'): LoanChange => ({ kind: 'extra-payment', date: civil('2026-07-05'), amount: euros(300), effect })
  const charted = (key: string, letter: string, slot: number, plan: ScenarioPlan): ChartedScenario => ({
    key,
    letter,
    name: key,
    colour: `--scenario-${slot}`,
    months: scenarioMonths(plan, today),
    variableFrom: null,
  })
  const stands = planOf([])
  const scenarios = [charted('as it stands', 'A', 1, stands), charted('shorter', 'B', 2, planOf([extra('shorter-term')])), charted('lower', 'C', 3, planOf([extra('lower-instalment')]))]

  it('walks each month end from the start of the comparison to the payoff, with the interest you pay since', () => {
    const months = scenarioMonths(stands, today)

    expect(months.map((entry) => entry.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01'])
    expect(months[0]).toEqual({ month: '2026-05', owed: stands.rows.find((row) => row.date === '2026-05-05')!.balance, interest: 0 })
    expect(months.at(-1)).toEqual({ month: '2027-01', owed: 0, interest: splitOfRows(stands.rows.filter((row) => row.date > today)).interest })
  })

  it('draws one line per scenario in its colour, the base last, with letters where each is paid off, joined in a shared month', () => {
    const chart = scenarioBalanceChart(scenarios, 'as it stands', TOKENS, false, null)
    const series = seriesOf(chart) as unknown as { name: string; color: string; markPoint: { data: { name: string }[] } }[]

    expect(series.map((entry) => [entry.name, entry.color])).toEqual([
      ['B shorter', '--scenario-2'],
      ['C lower', '--scenario-3'],
      ['A as it stands', '--scenario-1'],
    ])
    expect(series.map((entry) => entry.markPoint.data.map((point) => point.name))).toEqual([['B'], [], ['A C']])
    expect(chart.description).toBe('What each scenario owes at each month end. A, as it stands, is paid off in Jan 2027. B, shorter, is paid off in Nov 2026. C, lower, is paid off in Jan 2027.')
  })

  it('marks the first variable month with a hairline on a wide screen only', () => {
    const variable = scenarios.map((entry, index) => (index === 1 ? { ...entry, variableFrom: parseMonthKey('2026-09')! } : entry))

    expect(seriesOf(scenarioBalanceChart(variable, 'as it stands', TOKENS, false, null))[0]).toHaveProperty('markLine.data', [{ xAxis: '2026-09' }])
    expect(seriesOf(scenarioBalanceChart(variable, 'as it stands', TOKENS, true, null))[0]).not.toHaveProperty('markLine')
    expect(tooltipOf(scenarioBalanceChart(variable, 'as it stands', TOKENS, false, null), '2026-10')).toContain('An estimate at the variable rate')
  })

  it('holds each interest total to the right edge, labels it there and pushes close totals apart', () => {
    const month = (text: string, interest: number) => ({ month: parseMonthKey(text)!, owed: ZERO, interest: euros(interest) })
    const close: ChartedScenario[] = [
      { key: 'a', letter: 'A', name: 'a', colour: '--scenario-1', months: [month('2026-05', 0), month('2026-06', 100), month('2026-07', 200)], variableFrom: null },
      { key: 'b', letter: 'B', name: 'b', colour: '--scenario-2', months: [month('2026-05', 0), month('2026-06', 195)], variableFrom: null },
    ]
    const chart = scenarioInterestChart(close, 'a', TOKENS, false, true, null)
    const series = seriesOf(chart) as unknown as { name: string; data: unknown[]; markPoint: { data: { coord: [string, number]; label: { formatter: string } }[] } }[]

    expect(series[0]!.name).toBe('B b')
    expect(series[0]!.data).toEqual([0, euros(195), euros(195)])
    // 200.00 is the tallest total, so the label of 195.00 drops to 200.00 − 8% of 200.00 = 184.00.
    expect(series.map((entry) => entry.markPoint.data[0]!.coord)).toEqual([
      ['2026-07', euros(184)],
      ['2026-07', euros(200)],
    ])
    expect(series[1]!.markPoint.data[0]!.label.formatter).toBe('A €200')
    expect(chart.description).toBe('The interest you pay from today, added up month by month. A, a, comes to €200.00. B, b, comes to €195.00.')
  })

  it('cuts both charts to a range, with a letter only where a payoff is shown and the interest reached at the new right edge', () => {
    // May to Oct 2026: B is paid off in Nov 2026 and A and C in Jan 2027, so no payoff letter shows.
    const window = { from: civil('2026-05-10'), to: civil('2026-10-31') }
    const owed = scenarioBalanceChart(scenarios, 'as it stands', TOKENS, false, window)
    const interest = scenarioInterestChart(scenarios, 'as it stands', TOKENS, false, true, window)
    const interestSeries = seriesOf(interest) as unknown as { data: number[]; markPoint: { data: { coord: [string, number]; label: { formatter: string } }[] } }[]
    const all = scenarioInterestChart(scenarios, 'as it stands', TOKENS, false, true, null)

    expect((owed.option.xAxis as { data: string[] }).data).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
    expect((seriesOf(owed) as unknown as { markPoint: { data: unknown[] } }[]).map((entry) => entry.markPoint.data)).toEqual([[], [], []])
    expect(interestSeries.map((entry) => entry.markPoint.data[0]!.coord[0])).toEqual(['2026-10', '2026-10', '2026-10'])
    expect(interestSeries.map((entry) => entry.markPoint.data[0]!.label.formatter.split(' ')[0])).toEqual(['B', 'C', 'A'])
    expect(interestSeries.every((entry) => entry.markPoint.data[0]!.label.formatter.endsWith(formatCompactMoney(entry.data.at(-1)!)))).toBe(true)
    // The descriptions keep every payoff and every total, cut or not.
    expect(owed.description).toBe(scenarioBalanceChart(scenarios, 'as it stands', TOKENS, false, null).description)
    expect(interest.description).toBe(all.description)
  })
})
