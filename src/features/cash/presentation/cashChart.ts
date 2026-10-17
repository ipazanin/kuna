import { monthAxisLabel, monthLabel } from '../../../shared/calendar/monthLabel'
import { incompleteBand, moneyAxisLabel } from '../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../shared/charts/chartTooltip'
import type { LineSeries } from '../../../shared/charts/echarts'
import { formatWholeMoney } from '../../../shared/money/moneyFormat'
import type { DrillChart } from '../../filters/presentation/chartDrill'
import type { BalanceMonth } from '../domain/balances'

export const TOTAL_SERIES = 'All accounts'

/**
 * The colour of each account, from its place in the `accounts` tab, so narrowing the accounts in
 * view never repaints the ones left. The first two slots carry income and operating elsewhere, so
 * accounts start at the third.
 */
export function accountColours(accounts: readonly string[], tokens: ChartTokens): ReadonlyMap<string, string> {
  return new Map(accounts.map((account, index) => [account, tokens.series[(index + 2) % tokens.series.length] ?? tokens.ink]))
}

/** Month-end balance per account stacked as areas, with the total as a line over them. */
export function balanceChart(
  months: readonly BalanceMonth[],
  accounts: readonly string[],
  colours: ReadonlyMap<string, string>,
  tokens: ChartTokens,
  accountName: (account: string) => string,
): DrillChart {
  // A series is named for the reader, so a click finds its account back by that name.
  const accountBySeries = new Map(accounts.map((account) => [accountName(account), account]))
  const categories: string[] = months.map((month) => month.month)
  const incomplete = months.map((month) => !month.complete)
  const areas: LineSeries[] = accounts.map((account, index) => {
    const colour = colours.get(account) ?? tokens.ink
    return {
      type: 'line',
      name: accountName(account),
      stack: 'balance',
      color: colour,
      showSymbol: false,
      lineStyle: { width: 1.5 },
      areaStyle: { color: colour, opacity: 0.22 },
      data: months.map((month) => month.byAccount[account]?.amount ?? null),
      ...(index === 0 ? { markArea: incompleteBand(categories, incomplete, tokens) } : {}),
    }
  })
  const last = months[months.length - 1]
  return {
    option: {
      grid: { top: 16, right: 16 },
      tooltip: {
        trigger: 'axis',
        formatter: axisTooltip({
          tokens,
          incompleteCategories: categories.filter((_, index) => incomplete[index]),
          categoryLabel: monthAxisLabel('long'),
          formatAmount: (amount) => formatWholeMoney(amount),
        }),
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: categories,
        axisLabel: { color: tokens.inkMuted, formatter: monthAxisLabel('short') },
      },
      yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      series: [
        ...areas,
        { type: 'line', name: TOTAL_SERIES, color: tokens.ink, showSymbol: false, data: months.map((month) => month.total.amount), z: 4 },
      ],
    },
    description:
      last === undefined
        ? 'No months to show.'
        : `Month-end balance of ${accounts.map(accountName).join(', ')} from ${monthLabel(months[0]!.month)} to ${monthLabel(last.month)}, stacked, with the total as a line. ` +
          `${last.complete ? 'At the end of' : 'So far in'} ${monthLabel(last.month)} the total was ${formatWholeMoney(last.total.amount)}.`,
    drillAt: ({ seriesName, dataIndex }) => {
      const month = months[dataIndex]
      if (month === undefined) {
        return null
      }
      const account = accountBySeries.get(seriesName)
      return account === undefined ? month.total.drill : (month.byAccount[account]?.drill ?? null)
    },
  }
}
