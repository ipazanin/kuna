import type { AccountMoney } from './accountMoney'
import type { Money } from './money'

/** A statement read off a page, a pasted text or a file, with the balances it prints, in cents of one currency. */
export interface PrintedStatement<Cents extends Money | AccountMoney> {
  readonly opening: Cents
  readonly amounts: readonly Cents[]
  readonly closing: Cents
}

/** Whether a printed statement's rows lead from its opening to its closing balance, or how far off they end. */
export type StatementTie<Cents extends Money | AccountMoney> =
  { readonly kind: 'ties' } | { readonly kind: 'off'; readonly rows: Cents; readonly reached: Cents; readonly gap: Cents; readonly statement: PrintedStatement<Cents> }

/** Whether the opening balance plus every row equals the closing balance, each as printed. Nothing is filled in to close it. */
export function statementTies<Cents extends Money | AccountMoney>(statement: PrintedStatement<Cents>): StatementTie<Cents> {
  let rows = 0
  for (const amount of statement.amounts) {
    rows += amount
  }
  const reached = statement.opening + rows
  if (reached === statement.closing) {
    return { kind: 'ties' }
  }
  return { kind: 'off', rows: rows as Cents, reached: reached as Cents, gap: (statement.closing - reached) as Cents, statement }
}

/**
 * Whether a card of a statement the AI copied gives the printed balances as the rule asks: both or neither, as a statement prints
 * both or none, and nothing worked out. A statement in parts gives its opening alone on part 1 and both again on its last part.
 */
export function givesPrintedBalances(opening: number | null, closing: number | null, part: number): boolean {
  return (opening === null) === (closing === null) || (part === 1 && closing === null)
}

/** Why a copied card cannot go in beside the rows Kuna holds of the same source: the parts before it are missing, or it splits these days. */
export type CardDaysRefusal<Day extends string> = { readonly kind: 'parts-before-missing' } | { readonly kind: 'split'; readonly days: readonly Day[] }

/**
 * Why a card the AI copied cannot go in beside the rows Kuna holds of the same source, given by their days, or null. Rows of one day
 * are told apart by their count on that day, so a card gives every row of each of its days, or an equal row on a split day would be
 * taken for one Kuna has. A day is any text that names one day of the source, such as a date or a key that holds it.
 *
 * A part of a statement is stricter, and its days are dates. Part 1 always can. A later part needs rows of the parts before it in
 * Kuna, and starts on a day after they end, so every day of the card up to the last day they reach counts as split. A card that
 * is no part of a statement passes null for its part.
 */
export function cardDaysRefusal<Day extends string>(daysHeld: readonly Day[], cardDays: readonly Day[], part: number | null): CardDaysRefusal<Day> | null {
  if (part === 1) return null
  if (part !== null && daysHeld.length === 0) return { kind: 'parts-before-missing' }
  const held = new Set(daysHeld)
  const lastHeld = [...daysHeld].sort().at(-1)
  const split = cardDays.filter((day) => (part === null ? held.has(day) : lastHeld !== undefined && day <= lastHeld))
  return split.length === 0 ? null : { kind: 'split', days: [...new Set(split)].sort() }
}
