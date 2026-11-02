import { describe, expect, it } from 'vitest'

import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { treemapChart } from '../src/apps/investments/holdings/presentation/treemapChart'
import type { ChartTokens } from '../src/shared/charts/chartTokens'
import { changeStep, changeTreemapTooltip, labelFits } from '../src/shared/charts/treemap'
import { WORKED_PRICES, WORKED_RATES, workedPortfolio } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const TOKENS = new Proxy({}, { get: (_target, name) => (name === 'gain' || name === 'loss' ? [1, 2, 3].map((step) => `${String(name)}-${step}`) : String(name)) }) as unknown as ChartTokens

describe('the map of holdings', () => {
  it('sizes each holding held by its value and tints it by the step of its gain, leaving the cash out', () => {
    const records = workedPortfolio()
    const map = treemapChart(portfolioFigures({ book: records, prices: WORKED_PRICES, rates: WORKED_RATES, today: civil('2026-10-29') }), TOKENS)
    const [series] = map.option.series as { data: { name: string; value: number; itemStyle: { color: string } }[] }[]

    // The World ETF 321.00 on 1,554.00 is +20.7%, the second step. Stock B 61.79 on 715.00 is +8.6%, the first.
    expect(series!.data.map((tile) => [tile.value, tile.itemStyle.color])).toEqual([
      [euros(1875), 'gain-2'],
      [euros(776.79), 'gain-1'],
    ])
    expect(map.tiles.map((tile) => tile.holding.instrument.name)).toEqual(['World ETF', 'Stock B'])
    expect(map.description).toBe('Map of holdings, €2,651.79 in all: World ETF €1,875.00 (+20.7%), Stock B €776.79 (+8.6%).')
  })

  it('escapes the name in the tooltip, since it comes from the file', () => {
    const tile = { key: 'a', label: 'Fund <b>A</b> & Co', caption: '+8.6%', value: euros(776.79), change: 0.086 }
    expect(changeTreemapTooltip().formatter({ data: { tile } })).toBe('Fund &#60;b&#62;A&#60;/b&#62; &#38; Co<br><b>€776.79</b>, +8.6%')
  })

  it('shows a label only when its name and its caption both fit the tile', () => {
    // "World ETF" is 9 characters, 63 px wide estimated, with 5 px of padding each side.
    expect(labelFits('World ETF\n+20.7%', { width: 73, height: 42 })).toBe(true)
    expect(labelFits('World ETF\n+20.7%', { width: 72, height: 42 })).toBe(false)
    expect(labelFits('World ETF\n+20.7%', { width: 200, height: 41 })).toBe(false)
  })

  it('steps a change up to 10%, up to 25% and over 25% the same either way', () => {
    expect([0, 0.1, 0.1001, 0.25, 0.2501, -0.05, -0.2, -0.312].map(changeStep)).toEqual([0, 0, 1, 1, 2, 0, 1, 2])
  })
})
