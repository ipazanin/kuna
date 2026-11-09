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
