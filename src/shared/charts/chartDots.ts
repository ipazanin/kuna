/** The diameter in pixels of every dot that marks money moving, whatever its amount, which the tooltip and the table give. */
export const DOT_SIZE = 10

/** The diameter of a ring that marks a change with no amount, such as a new rate. It is wider than a dot, so a dot at the same place shows inside it. */
export const RING_SIZE = DOT_SIZE + 8

/** The entries of a dot its tooltip names one by one, before a line for the rest. */
const ENTRIES_NAMED = 3

/** How far from a dot, as a share of a chart's points, a tooltip still names what the dot holds. */
const REACH = 0.01
const REACH_ON_A_PHONE = 0.04

/**
 * Where a dot sits against its place, in pixels across and down. Two kinds of dot at one place sit side by side,
 * the first kind to the left, so neither hides the other, and a dot alone sits on its place.
 */
export function dotOffset(shared: boolean, first: boolean): [number, number] {
  return [shared ? (first ? -DOT_SIZE / 2 : DOT_SIZE / 2) : 0, 0]
}

/** How many points either side of the hovered one a tooltip still reaches a dot on a line of this many points, since a point on a long line is narrower than a finger. */
export function dotReach(points: number, phone: boolean): number {
  return Math.ceil(points * (phone ? REACH_ON_A_PHONE : REACH))
}

/** A dot at its place on the category axis, with the lines its tooltip gives. */
export interface PlacedDot {
  readonly place: number
  readonly lines: readonly string[]
}

/**
 * The tooltip lines of the dots at the place nearest the hovered category within reach, in the order the dots
 * come, the earlier place of two as near. A place other than the hovered one leads with its own label, so the
 * lines say whose they are.
 */
export function nearestDotLines(categories: readonly string[], dots: readonly PlacedDot[], reach: number, labelOf: (place: number) => string): (category: string) => string[] {
  return (category) => {
    const hovered = categories.indexOf(category)
    const distance = (place: number): number => Math.abs(place - hovered)
    const nearest = dots
      .map((dot) => dot.place)
      .filter((place) => hovered >= 0 && distance(place) <= reach)
      .sort((one, other) => distance(one) - distance(other))[0]
    if (nearest === undefined) return []
    const lines = dots.filter((dot) => dot.place === nearest).flatMap((dot) => dot.lines)
    return nearest === hovered ? lines : [labelOf(nearest), ...lines]
  }
}

/** A dot's first entries a line each, and the rest in one line, so a dot of many entries keeps its tooltip short. */
export function namedFirst<T>(entries: readonly T[], lineOf: (entry: T) => string, restLine: (rest: readonly T[]) => string): string[] {
  const rest = entries.slice(ENTRIES_NAMED)
  return [...entries.slice(0, ENTRIES_NAMED).map(lineOf), ...(rest.length === 0 ? [] : [restLine(rest)])]
}
