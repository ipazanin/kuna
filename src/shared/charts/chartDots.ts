import type { ChartOption } from './echarts'

/** The diameter in pixels of every dot that marks money moving, whatever its amount, which the tooltip and the table give. */
export const DOT_SIZE = 12

/** The diameter of a ring that marks a change with no amount, such as a new rate. It is wider than a dot, so a dot at the same place shows inside it. */
export const RING_SIZE = DOT_SIZE + 8

/** The entries of a dot its tooltip names one by one, before a line for the rest. */
const ENTRIES_NAMED = 3

/** How far from a dot's centre, in pixels, a pointer still opens that dot's tooltip: past the dot's edge for a cursor, and half of a 44 px target for a finger. */
const DOT_REACH = 12
const DOT_REACH_ON_A_PHONE = 22

/**
 * Where a dot sits against its place, in pixels across and down. Two kinds of dot at one place sit side by side,
 * the first kind to the left, so neither hides the other, and a dot alone sits on its place.
 */
export function dotOffset(shared: boolean, first: boolean): [number, number] {
  return [shared ? (first ? -DOT_SIZE / 2 : DOT_SIZE / 2) : 0, 0]
}

/** A dot of one of a chart's scatter series: its series, its place on the category axis, its value and its offset in pixels. */
export interface ScatterDot {
  readonly series: number
  readonly place: number
  readonly value: number
  readonly offset: readonly [number, number]
}

/** Every dot of a chart's scatter series. */
export function scatterDots(option: ChartOption): ScatterDot[] {
  const series = Array.isArray(option.series) ? option.series : option.series === undefined ? [] : [option.series]
  return series.flatMap((single, index) =>
    single.type === 'scatter' && Array.isArray(single.data)
      ? single.data.flatMap((entry, place) => {
          const drawn = typeof entry === 'object' && entry !== null && !Array.isArray(entry) ? (entry as { value?: unknown; symbolOffset?: unknown }) : { value: entry }
          const offset = Array.isArray(drawn.symbolOffset) ? drawn.symbolOffset.map(Number) : [0, 0]
          return typeof drawn.value === 'number' ? [{ series: index, place, value: drawn.value, offset: [offset[0] ?? 0, offset[1] ?? 0] as const }] : []
        })
      : [],
  )
}

/** A dot's place, with its centre on the chart in pixels. */
export interface DotCentre {
  readonly place: number
  readonly x: number
  readonly y: number
}

/** The dot whose centre lies nearest the pointer, the one listed first of two as near, or null when none lies within reach. */
export function snappedDot(pointer: { readonly x: number; readonly y: number }, dots: readonly DotCentre[], phone: boolean): DotCentre | null {
  const reach = phone ? DOT_REACH_ON_A_PHONE : DOT_REACH
  const distance = (dot: DotCentre): number => Math.hypot(dot.x - pointer.x, dot.y - pointer.y)
  return dots.filter((dot) => distance(dot) <= reach).sort((one, other) => distance(one) - distance(other))[0] ?? null
}

/** A dot at its place on the category axis, with the lines its tooltip gives. */
export interface PlacedDot {
  readonly place: number
  readonly lines: readonly string[]
}

/** The tooltip lines of the dots at the hovered category, in the order the dots come. */
export function dotLinesAt(categories: readonly string[], dots: readonly PlacedDot[]): (category: string) => string[] {
  return (category) => {
    const hovered = categories.indexOf(category)
    return dots.filter((dot) => dot.place === hovered).flatMap((dot) => dot.lines)
  }
}

/** A dot's first entries a line each, and the rest in one line, so a dot of many entries keeps its tooltip short. */
export function namedFirst<T>(entries: readonly T[], lineOf: (entry: T) => string, restLine: (rest: readonly T[]) => string): string[] {
  const rest = entries.slice(ENTRIES_NAMED)
  return [...entries.slice(0, ENTRIES_NAMED).map(lineOf), ...(rest.length === 0 ? [] : [restLine(rest)])]
}
