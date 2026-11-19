/** The colours an open list's largest parts take on a `DonutCard`, largest first. */
export const OPEN_LIST_COLOURS = ['--series-1', '--series-2', '--series-3', '--series-4'] as const

/** The colours the largest debts take on Net worth's What you owe ring, largest first, with no gain, loss or bar colour among them. */
export const DEBT_LIST_COLOURS = ['--net-debt-1', '--net-debt-2', '--net-debt-3'] as const

/** The colour of the one part an open list folds the rest into. */
export const FOLDED_COLOUR = '--chart-deemphasis'

/** An open list's parts, already largest first, split into the ones that keep a slice of their own, each with its colour, and the rest that fold into one grey part. */
export interface FoldedList<Part> {
  readonly kept: readonly { readonly part: Part; readonly colour: string }[]
  readonly folded: readonly Part[]
}

/** Keeps one part for each colour, in order, and folds the rest. */
export function foldOpenList<Part>(parts: readonly Part[], colours: readonly string[]): FoldedList<Part> {
  const kept = parts.slice(0, colours.length)
  return { kept: kept.map((part, place) => ({ part, colour: colours[place]! })), folded: parts.slice(kept.length) }
}
