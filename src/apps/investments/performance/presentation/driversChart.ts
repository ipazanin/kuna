import type { PeriodGains } from '../domain/periodGains'
import { words } from './words'
import { moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { BarSeries, ChartOption } from '../../../../shared/charts/echarts'
import { formatChartMoney, formatMoney } from '../../../../shared/money/moneyFormat'
import { sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** The holdings drawn on their own, the largest by how far they moved. The rest share one bar. */
const HOLDINGS_SHOWN = 8

export interface Driver {
  readonly label: string
  readonly amount: Money
  /** Fees are a cost and take no tone. */
  readonly cost: boolean
}

export interface DriversChart {
  readonly option: ChartOption
  readonly description: string
}

/**
 * What each holding added to the period's gain, largest first, then the cash's currency effect, the income that names
 * no holding and the fees. Together they are the gain, Start to End less what was put in and taken out.
 */
export function periodDrivers(gains: PeriodGains): Driver[] {
  const moved = [...gains.holdings].filter((holding) => holding.total !== 0).sort((first, second) => Math.abs(second.total) - Math.abs(first.total))
  const others = moved.slice(HOLDINGS_SHOWN)
  const holdings = moved
    .slice(0, HOLDINGS_SHOWN)
    .sort((first, second) => second.total - first.total)
    .map((holding): Driver => ({ label: holding.instrument.name, amount: holding.total, cost: false }))
  const drivers: Driver[] = [
    ...holdings,
    ...(others.length === 0 ? [] : [{ label: words.drivers.others, amount: sumMoney(others.map((holding) => holding.total)), cost: false }]),
    { label: words.drivers.currencyOnCash, amount: gains.currencyOnCash, cost: false },
    { label: words.drivers.incomeOnCash, amount: gains.incomeOnCash, cost: false },
    { label: words.drivers.fees, amount: gains.fees, cost: true },
  ]
  return drivers.filter((driver) => driver.amount !== 0)
}

/** One bar a driver, the first on top, in the positive tone for a gain and the negative one for a loss. The fees are grey. */
export function driversChart(drivers: readonly Driver[], tokens: ChartTokens): DriversChart {
  const colourOf = (driver: Driver): string => (driver.cost ? tokens.deemphasis : driver.amount > 0 ? tokens.positive : tokens.negative)
  const bars: BarSeries = {
    type: 'bar',
    name: words.drivers.gain,
    barMaxWidth: 18,
    data: drivers.map((driver) => ({ value: driver.amount, itemStyle: { color: colourOf(driver), borderRadius: 2 } })),
  }
  return {
    option: {
      grid: { top: 8, right: 16 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: axisTooltip({ tokens, formatAmount: (amount) => formatChartMoney(amount, 'always') }) },
      xAxis: { type: 'value', axisLabel: { ...moneyAxisLabel(tokens), hideOverlap: true } },
      yAxis: { type: 'category', inverse: true, data: drivers.map((driver) => driver.label), axisLabel: { color: tokens.inkSecondary, width: 160, overflow: 'truncate' } },
      series: [bars],
    },
    description: words.drivers.description(drivers.map((driver) => `${driver.label} ${formatMoney(driver.amount, 'always')}`).join(', ')),
  }
}
