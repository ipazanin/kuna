import type { TreemapSeriesOption } from 'echarts/charts'

import type { ChartTokens } from './chartTokens'
import { escapeHtml } from './chartTooltip'
import { formatMoney } from '../money/moneyFormat'

/** A tile of a map, sized by its value and tinted by how far it moved up or down. */
export interface ChangeTile {
  /** Stays the same for the same thing, and comes back as the category of a click on the tile. */
  readonly key: string
  readonly label: string
  /** The line under the label, such as the signed change. */
  readonly caption: string
  /** In cents, above zero. */
  readonly value: number
  /** The change as a fraction, such as 0.207, or null for a tile with nothing to measure, which takes the card's surface. */
  readonly change: number | null
}

/** The step of a change, the same up or down: up to 10%, up to 25%, and over 25%. */
export function changeStep(change: number): 0 | 1 | 2 {
  const size = Math.abs(change)
  return size <= 0.1 ? 0 : size <= 0.25 ? 1 : 2
}

const LABEL_FONT_SIZE = 12
const LABEL_LINE_HEIGHT = 16
const LABEL_PADDING = 5
/** A wide estimate of a character's width at the label's size, since ECharts does not measure the text it lays out. */
const CHARACTER_WIDTH = 7
const LABEL_MIN_HEIGHT = 2 * LABEL_LINE_HEIGHT + 2 * LABEL_PADDING

/**
 * The tiles as one treemap series. A tile shows its label and its caption, or no label when either does not fit, so the
 * tooltip and the table carry it. ECharts cannot hide a treemap label that does not fit, so `labelLayout` sets its size
 * to 0. The faintest tints sit under 3:1 on the card, so each tile's edge is a border in muted ink.
 */
export function changeTreemap(name: string, tiles: readonly ChangeTile[], tokens: ChartTokens): TreemapSeriesOption {
  return {
    type: 'treemap',
    name,
    roam: false,
    nodeClick: false,
    breadcrumb: { show: false },
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    levels: [{ itemStyle: { borderColor: tokens.surface, borderWidth: 0, gapWidth: 2 } }],
    label: {
      show: true,
      color: tokens.ink,
      fontSize: LABEL_FONT_SIZE,
      lineHeight: LABEL_LINE_HEIGHT,
      padding: LABEL_PADDING,
      overflow: 'truncate',
      formatter: ({ data }: { data: unknown }) => {
        const tile = tileOf({ data })
        return tile === null ? '' : `${tile.label}\n${tile.caption}`
      },
    },
    labelLayout: ({ rect, text }) => (labelFits(text, rect) ? {} : { fontSize: 0 }),
    data: tiles.map((tile) => ({
      name: tile.key,
      value: tile.value,
      tile,
      itemStyle: { color: tintOf(tile.change, tokens), borderColor: tokens.inkMuted, borderWidth: 1, borderRadius: 4 },
    })),
  }
}

/** Whether every line of a label fits inside its tile with the label's padding. */
export function labelFits(text: string, tile: { readonly width: number; readonly height: number }): boolean {
  const widest = Math.max(...text.split('\n').map((line) => line.length))
  return tile.height >= LABEL_MIN_HEIGHT && tile.width >= widest * CHARACTER_WIDTH + 2 * LABEL_PADDING
}

/** The tooltip of a change treemap: the tile's label, then its value and its caption. Labels can come from the user's file, so they are escaped. */
export function changeTreemapTooltip(): { trigger: 'item'; formatter: (point: unknown) => string } {
  return {
    trigger: 'item',
    formatter: (point: unknown) => {
      const tile = tileOf(point)
      return tile === null ? '' : `${escapeHtml(tile.label)}<br><b>${escapeHtml(formatMoney(tile.value))}</b>, ${escapeHtml(tile.caption)}`
    },
  }
}

/** The tile under a tooltip or a label, from the point ECharts passes. */
function tileOf(point: unknown): ChangeTile | null {
  const data = (point as { data?: { tile?: ChangeTile } } | null)?.data
  return data?.tile ?? null
}

function tintOf(change: number | null, tokens: ChartTokens): string {
  if (change === null) return tokens.surface
  return (change < 0 ? tokens.loss : tokens.gain)[changeStep(change)] ?? tokens.surface
}
