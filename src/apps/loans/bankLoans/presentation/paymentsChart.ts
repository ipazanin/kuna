import { interestOf, subsidyShareOf, yourShareOf } from '../domain/loanFigures'
import type { YearPayments } from '../domain/loanFigures'
import { yearStep } from '../../balances/presentation/balanceChart'
import { words } from './words'
import { BAR_END_UP, moneyAxisLabel, stackGap, stripeDecal } from '../../../../shared/charts/chartTheme'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { BarSeries, ChartOption, LineSeries } from '../../../../shared/charts/echarts'
import { sumMoney } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'

export interface PaymentsChart {
  readonly option: ChartOption
  readonly description: string
  /** Whether the chart has a part the subsidy pays, an extra payment and years still to come, which its legend names. */
  readonly hasSubsidy: boolean
  readonly hasExtra: boolean
  readonly hasAhead: boolean
}

type Part = 'extra' | 'principal' | 'subsidyPrincipal' | 'subsidyInterest' | 'interest'

/** The stack from the baseline up, so the two parts the subsidy pays touch in the middle. */
const STACK: readonly Part[] = ['extra', 'principal', 'subsidyPrincipal', 'subsidyInterest', 'interest']

/**
 * One stacked bar per calendar year: an extra payment at the bottom as an outline, then the principal
 * you pay, the principal and the interest the subsidy pays, striped, and the interest you pay on
 * top. A dashed rule marks this year, and a brass rule under the axis runs from it to the end.
 * The tooltip adds what you pay in the year, what the subsidy pays and whether the year holds an estimate.
 */
export function paymentsChart(years: readonly YearPayments[], currentYear: number, payer: string, tokens: ChartTokens, phone: boolean, estimateFromYear: number | null): PaymentsChart {
  const categories = years.map((entry) => String(entry.year))
  const principalColour = tokenColour('--loan-principal')
  const interestColour = tokenColour('--loan-interest')
  const ahead = tokenColour('--loan-ahead')
  const present = (part: Part): boolean => years.some((entry) => entry[part] > 0)
  const parts = STACK.filter((part) => present(part) || part === 'principal' || part === 'interest')
  const topOf = (entry: YearPayments): Part | undefined => parts.filter((part) => entry[part] > 0).at(-1)

  const looks: Readonly<Record<Part, { name: string; style: Record<string, unknown> }>> = {
    extra: { name: words.payments.extra, style: { color: tokens.surface, borderColor: principalColour, borderWidth: 1.5 } },
    principal: { name: words.payments.principalYouPay, style: { color: principalColour, ...stackGap(tokens) } },
    subsidyPrincipal: { name: words.payments.principalSubsidy(payer), style: { color: principalColour, decal: stripeDecal(tokens), ...stackGap(tokens) } },
    subsidyInterest: { name: words.payments.interestSubsidy(payer), style: { color: interestColour, decal: stripeDecal(tokens), ...stackGap(tokens) } },
    interest: { name: words.payments.interestYouPay, style: { color: interestColour, ...stackGap(tokens) } },
  }

  const bars = parts.map((part): BarSeries => ({
    type: 'bar',
    name: looks[part].name,
    stack: 'payments',
    itemStyle: { ...looks[part].style, borderRadius: 0 },
    data: years.map((entry) => (topOf(entry) === part ? { value: entry[part], itemStyle: { borderRadius: BAR_END_UP } } : entry[part])),
    ...(part === parts[0]
      ? {
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: tokens.axis, type: 'dashed', width: 1 },
            label: { formatter: words.payments.today, position: 'end', color: tokens.inkSecondary, fontSize: 11 },
            data: categories.includes(String(currentYear)) ? [{ xAxis: String(currentYear) }] : [],
          },
        }
      : {}),
  }))
  const hasAhead = years.some((entry) => entry.year > currentYear)
  const stillToCome: LineSeries = {
    type: 'line',
    name: '',
    silent: true,
    symbol: 'none',
    color: ahead,
    lineStyle: { width: 3, color: ahead },
    z: 5,
    data: years.map((entry) => (entry.year >= currentYear ? 0 : null)),
  }

  const yearsByLabel = new Map(years.map((entry) => [String(entry.year), entry]))
  const footnotesOf = (label: string): string[] => {
    const entry = yearsByLabel.get(label)
    if (entry === undefined) return []
    const subsidy = subsidyShareOf(entry)
    return [
      words.payments.youPayLine(formatMoney(yourShareOf(entry))),
      ...(subsidy > 0 ? [words.payments.subsidyLine(words.subsidyPays(payer), formatMoney(subsidy), entry.subsidyPrincipal > 0 ? formatMoney(entry.subsidyPrincipal) : '')] : []),
      ...(estimateFromYear !== null && entry.year >= estimateFromYear ? [words.payments.estimate] : []),
    ]
  }
  const first = years[0]
  const last = years.at(-1)
  const step = first === undefined || last === undefined ? 1 : yearStep(last.year - first.year, phone)
  return {
    option: {
      grid: { top: 24, right: 16 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (points: unknown) =>
          axisTooltip({
            tokens,
            categoryLabel: (year) => plural(words.payments.year(year, yearsByLabel.get(year)?.instalments ?? 0), yearsByLabel.get(year)?.instalments ?? 0),
            formatAmount: (amount) => formatMoney(amount),
            footnotes: footnotesOf,
          })((Array.isArray(points) ? points : [points]).filter((point: { seriesName?: string; value?: unknown }) => point.seriesName !== '' && typeof point.value === 'number' && point.value > 0)),
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: tokens.inkMuted, interval: (_index: number, year: string) => Number(year) % step === 0 },
      },
      yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      series: [...bars, ...(hasAhead ? [stillToCome] : [])],
    },
    description: descriptionOf(years, payer),
    hasSubsidy: present('subsidyPrincipal') || present('subsidyInterest'),
    hasExtra: present('extra'),
    hasAhead,
  }
}

function descriptionOf(years: readonly YearPayments[], payer: string): string {
  const first = years[0]
  const last = years.at(-1)
  if (first === undefined || last === undefined) return ''
  const subsidised = years.filter((entry) => subsidyShareOf(entry) > 0)
  const firstSubsidised = subsidised[0]
  const lastSubsidised = subsidised.at(-1)
  const most = years.reduce((largest, entry) => (interestOf(entry) > interestOf(largest) ? entry : largest), first)
  return (
    words.payments.description(String(first.year), String(last.year)) +
    (firstSubsidised === undefined || lastSubsidised === undefined
      ? ''
      : words.payments.subsidyDescription(words.subsidyPays(payer), formatMoney(sumMoney(subsidised.map(subsidyShareOf))), String(firstSubsidised.year), String(lastSubsidised.year))) +
    words.payments.interestDescription(formatMoney(interestOf(most)), String(most.year), formatMoney(interestOf(last)), String(last.year))
  )
}
