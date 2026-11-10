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

/**
 * Why a part after the first of a copied statement cannot go yet: no row of the parts before it is in Kuna, or it starts on a day
 * they reach. A part starts on a day after the one before it ends, since rows of one day are told apart by their count on that day.
 */
export type PartRefusal = 'parts-before-missing' | 'day-reached'

/** Why the part cannot follow the rows its statement's earlier parts put in Kuna, given by their days, or null. Part 1 always can. */
export function partRefusal(part: number, earlierDays: readonly string[], firstDay: string): PartRefusal | null {
  if (part === 1) return null
  if (earlierDays.length === 0) return 'parts-before-missing'
  return earlierDays.some((day) => day >= firstDay) ? 'day-reached' : null
}
