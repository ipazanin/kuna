import type { HoldingFigures } from '../domain/holding'
import { heldHoldings } from '../domain/holdingsList'
import type { PortfolioFigures } from '../domain/portfolioFigures'
import { words } from './words'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import type { ChartOption } from '../../../../shared/charts/echarts'
import { changeTreemap, changeTreemapTooltip } from '../../../../shared/charts/treemap'
import { ratioOf, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney, formatPercent } from '../../../../shared/money/moneyFormat'
import type { Share } from '../../../../shared/money/percent'

/** A holding on the map, with what its table row shows. */
export interface MapTile {
  readonly holding: HoldingFigures
  readonly value: Money
  /** The gain on what is held over its cost, null with no cost. */
  readonly gain: Share | null
}

export interface HoldingsMap {
  readonly option: ChartOption
  readonly description: string
  /** Largest first, as the table lists them. */
  readonly tiles: readonly MapTile[]
}

/**
 * Each holding held and priced as a tile sized by its value and tinted by its gain on what is held: up to 10%, 10% to
 * 25% and over 25%, each way. The label carries the name and the signed percent, so the tint is never the only cue.
 * Cash is left out. A tile's key is its instrument's id, which a click passes back as its category.
 */
export function treemapChart(figures: PortfolioFigures, tokens: ChartTokens): HoldingsMap {
  const tiles = heldHoldings(figures)
    .flatMap((holding): MapTile[] => {
      const value = holding.valuation?.value ?? null
      return value === null || value <= 0 ? [] : [{ holding, value, gain: holding.unrealised === null ? null : ratioOf(holding.unrealised, holding.cost) }]
    })
    .sort((first, second) => second.value - first.value)
  const gainText = (tile: MapTile): string => (tile.gain === null ? '–' : formatPercent(tile.gain, 'always'))
  return {
    option: {
      tooltip: changeTreemapTooltip(),
      series: [
        changeTreemap(
          words.map.title,
          tiles.map((tile) => ({ key: tile.holding.instrument.id, label: tile.holding.instrument.name, caption: gainText(tile), value: tile.value, change: tile.gain })),
          tokens,
        ),
      ],
    },
    description: words.map.description(
      formatMoney(sumMoney(tiles.map((tile) => tile.value))),
      tiles.map((tile) => words.map.tile(tile.holding.instrument.name, formatMoney(tile.value), gainText(tile))).join(', '),
    ),
    tiles,
  }
}
