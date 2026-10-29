import type { ChartTokens } from './chartTokens'
import { formatCompactMoney } from '../money/moneyFormat'

/**
 * One ECharts theme for both colour schemes, built from the tokens of whichever scheme is active.
 * Marks follow the dataviz specs: bars at most 24 px with a 4 px rounded data end, 2 px lines,
 * 8 px markers, solid hairline grid and axes in the recessive greys.
 */
export function buildChartTheme(tokens: ChartTokens): Record<string, unknown> {
  const axisLabel = { color: tokens.inkMuted, fontSize: 11, fontFamily: tokens.fontFamily }
  return {
    color: [...tokens.series],
    backgroundColor: 'transparent',
    textStyle: { fontFamily: tokens.fontFamily, color: tokens.inkSecondary, fontSize: 12 },
    grid: {
      left: 4,
      right: 12,
      top: 12,
      bottom: 4,
      outerBoundsMode: 'same',
      outerBoundsContain: 'axisLabel',
    },
    categoryAxis: {
      axisLine: { show: true, lineStyle: { color: tokens.axis, width: 1 } },
      axisTick: { show: false },
      axisLabel: { ...axisLabel, margin: 10 },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel,
      splitNumber: 4,
      splitLine: { show: true, lineStyle: { color: tokens.grid, width: 1, type: 'solid' } },
    },
    bar: {
      barMaxWidth: 24,
      itemStyle: { borderRadius: BAR_END_UP },
      emphasis: { focus: 'none', itemStyle: { opacity: 0.85 } },
    },
    line: {
      symbol: 'circle',
      symbolSize: 8,
      showSymbol: false,
      lineStyle: { width: 2, cap: 'round', join: 'round' },
      itemStyle: { borderColor: tokens.surface, borderWidth: 2 },
      emphasis: { scale: false },
    },
    tooltip: {
      backgroundColor: tokens.tooltip,
      borderColor: tokens.tooltipBorder,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: tokens.ink, fontFamily: tokens.fontFamily, fontSize: 12 },
      extraCssText: 'border-radius: 8px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);',
      axisPointer: {
        lineStyle: { color: tokens.axis, width: 1 },
        shadowStyle: { color: tokens.ghost },
      },
    },
  }
}

export const BAR_END_UP = [4, 4, 0, 0]
export const BAR_END_DOWN = [0, 0, 4, 4]
export const BAR_END_RIGHT = [0, 4, 4, 0]

/** The 2 px surface gap between touching stacked segments, drawn as a 1 px surface edge on each. */
export function stackGap(tokens: ChartTokens): { borderColor: string; borderWidth: number } {
  return { borderColor: tokens.surface, borderWidth: 1 }
}

export function moneyAxisLabel(tokens: ChartTokens): { color: string; fontSize: number; formatter: (cents: number) => string } {
  return { color: tokens.inkMuted, fontSize: 11, formatter: (cents: number) => formatCompactMoney(cents) }
}

/**
 * Diagonal stripes in the surface colour, cut across the fill of the current part-month. The bar
 * keeps its series colour, so identity holds, and the stripes say the month is not over.
 */
function incompleteDecal(tokens: ChartTokens): Record<string, unknown> {
  return {
    symbol: 'rect',
    symbolSize: 1,
    color: tokens.hatch,
    dashArrayX: [1, 0],
    dashArrayY: [3, 3],
    rotation: Math.PI / 4,
  }
}

export interface IncompletePoint {
  readonly value: number | null
  readonly itemStyle: { readonly decal: Record<string, unknown> }
}

/** Hatches the points of months that are not complete, such as the current part-month. */
export function markIncomplete(values: readonly (number | null)[], incomplete: readonly boolean[], tokens: ChartTokens): (number | null | IncompletePoint)[] {
  return values.map((amount, index) => {
    if (!incomplete[index]) return amount
    return { value: amount, itemStyle: { decal: incompleteDecal(tokens) } }
  })
}

/**
 * A hatched band over the stretch of a line chart that leads into a month that is not complete,
 * for an axis without a boundary gap, where a single point cannot carry the stripes a bar does.
 */
export function incompleteBand(categories: readonly string[], incomplete: readonly boolean[], tokens: ChartTokens): Record<string, unknown> {
  return {
    silent: true,
    itemStyle: { color: { image: stripeTile(tokens), repeat: 'repeat' } },
    data: categories.flatMap((category, index) => {
      if (!incomplete[index] || categories.length < 2) return []
      const neighbour = index === 0 ? categories[1] : categories[index - 1]
      return [[{ xAxis: index === 0 ? category : neighbour }, { xAxis: index === 0 ? neighbour : category }]]
    }),
  }
}

/** Diagonal stripes on the ghost tint, as a fill pattern. A mark area ignores decals, so it gets this instead. */
function stripeTile(tokens: ChartTokens): HTMLCanvasElement {
  const size = 6
  const tile = document.createElement('canvas')
  tile.width = size
  tile.height = size
  const pen = tile.getContext('2d')
  if (pen !== null) {
    pen.fillStyle = tokens.ghost
    pen.fillRect(0, 0, size, size)
    pen.strokeStyle = tokens.deemphasis
    pen.lineWidth = 1
    pen.beginPath()
    pen.moveTo(0, size)
    pen.lineTo(size, 0)
    pen.moveTo(-size / 2, size / 2)
    pen.lineTo(size / 2, -size / 2)
    pen.moveTo(size / 2, size * 1.5)
    pen.lineTo(size * 1.5, size / 2)
    pen.stroke()
  }
  return tile
}
