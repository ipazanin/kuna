import { words } from './words'
import { absMoney, addMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** A statement read off a page or a pasted text, with the balances it prints. */
export interface PrintedStatement {
  readonly opening: Money
  readonly amounts: readonly Money[]
  readonly closing: Money
}

/** Whether a printed statement's entries lead from its opening to its closing balance, or how far off they end. */
export type StatementTie = { readonly kind: 'ties' } | { readonly kind: 'off'; readonly rows: Money; readonly reached: Money; readonly gap: Money; readonly statement: PrintedStatement }

/** Whether the opening balance plus every entry equals the closing balance, each as printed. Nothing is filled in to close it. */
export function statementTies(statement: PrintedStatement): StatementTie {
  const rows = sumMoney(statement.amounts)
  const reached = addMoney(statement.opening, rows)
  return reached === statement.closing ? { kind: 'ties' } : { kind: 'off', rows, reached, gap: subtractMoney(statement.closing, reached), statement }
}

/** Why a statement that does not tie is refused, with the gap. */
export function tieRefusal(tie: Extract<StatementTie, { kind: 'off' }>): string {
  return words.transcribed.doesNotTie(tie.statement.opening, tie.rows, tie.reached, tie.statement.closing, absMoney(tie.gap))
}
