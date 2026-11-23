import { spendingRanked } from '../domain/spanBreakdown'
import type { BreakdownLine, Grouping } from '../domain/spanBreakdown'
import { words } from './words'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { BAR_END_RIGHT, moneyAxisLabel, stripeDecal } from '../../../../shared/charts/chartTheme'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { BarSeries, ChartOption } from '../../../../shared/charts/echarts'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'
import { plural } from '../../../../shared/text/translation'

/** An open list, such as payees, colours its four largest lines and folds the rest into one hatched grey bar. */
const OPEN_LIST_SHOWN = 4

export interface BreakdownChart {
  readonly option: ChartOption
  readonly description: string
  /** The line of a bar, by its place on the axis, or null for the bar that holds the rest. */
  readonly lineAt: (place: number) => BreakdownLine | null
  readonly empty: boolean
  /** How many bars it draws, which its height follows. */
  readonly lineCount: number
}

interface Bar {
  readonly name: string
  readonly spent: Money
  readonly colour: string
  readonly line: BreakdownLine | null
}

/** A line's name as Analysis shows it. Under accounts, the line on no account holds the shared costs. */
export function lineName(line: BreakdownLine, grouping: Grouping): string {
  return grouping === 'account' && line.key === null ? words.analysis.breakdown.sharedCosts : line.name
}

/**
 * What each line of a span spent, the most on top. Groups of categories wear their own colours and every one that spent shows.
 * Payees, labels and accounts are an open list, so the four largest take the first four series colours and the rest is one grey bar.
 * The rest is hatched, since a group with no swatch left is plain grey and must not read as the rest.
 */
export function breakdownChart(lines: readonly BreakdownLine[], grouping: Grouping, colourOfLine: (line: BreakdownLine) => string, span: string, tokens: ChartTokens): BreakdownChart {
  const bars = ((): Bar[] => {
    if (grouping === 'category') return spendingRanked(lines, lines.length).top.map((line) => ({ name: line.name, spent: line.spent, colour: tokenColour(colourOfLine(line)), line }))
    const { top, rest } = spendingRanked(lines, OPEN_LIST_SHOWN)
    return [
      ...top.map((line, place) => ({ name: lineName(line, grouping), spent: line.spent, colour: tokens.series[place] ?? tokens.deemphasis, line })),
      ...(rest === null ? [] : [{ name: plural(words.analysis.breakdown.others(rest.lines), rest.lines), spent: rest.spent, colour: tokens.deemphasis, line: null }]),
    ]
  })()
  // A category axis runs from the bottom up, so the largest bar goes last to sit on top.
  const drawn = [...bars].reverse()
  const series: BarSeries = {
    type: 'bar',
    name: words.spent,
    barMaxWidth: 18,
    data: drawn.map((bar) => ({ value: bar.spent, itemStyle: { color: bar.colour, borderRadius: BAR_END_RIGHT, ...(bar.line === null ? { decal: stripeDecal(tokens) } : {}) } })),
  }
  return {
    option: {
      grid: { top: 8, right: 16 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: axisTooltip({ tokens }) },
      xAxis: { type: 'value', axisLabel: { ...moneyAxisLabel(tokens), hideOverlap: true } },
      yAxis: { type: 'category', data: drawn.map((bar) => bar.name), axisLabel: { color: tokens.inkSecondary, width: 140, overflow: 'truncate' } },
      series: [series],
    },
    description: bars.length === 0 ? words.analysis.breakdown.nothingSpent : words.analysis.breakdown.describe(span, bars.map((bar) => `${bar.name} ${formatMoney(bar.spent)}`).join(', ')),
    lineAt: (place) => drawn[place]?.line ?? null,
    empty: bars.length === 0,
    lineCount: bars.length,
  }
}
