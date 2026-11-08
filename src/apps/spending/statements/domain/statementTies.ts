import { words } from './words'
import { addAccountMoney, subtractAccountMoney, sumAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'

/** A statement read off a page or a pasted text, with the balances it prints, in the account's own currency. */
export interface PrintedStatement {
  readonly opening: AccountMoney
  readonly amounts: readonly AccountMoney[]
  readonly closing: AccountMoney
}

/** Whether a printed statement's rows lead from its opening to its closing balance, or how far off they end. */
export type StatementTie =
  { readonly kind: 'ties' } | { readonly kind: 'off'; readonly rows: AccountMoney; readonly reached: AccountMoney; readonly gap: AccountMoney; readonly statement: PrintedStatement }

/** Whether the opening balance plus every row equals the closing balance, each as printed. Nothing is filled in to close it. */
export function statementTies(statement: PrintedStatement): StatementTie {
  const rows = sumAccountMoney(statement.amounts)
  const reached = addAccountMoney(statement.opening, rows)
  return reached === statement.closing ? { kind: 'ties' } : { kind: 'off', rows, reached, gap: subtractAccountMoney(statement.closing, reached), statement }
}

/** Why a statement that does not tie is refused, with the gap in the account's currency. */
export function tieRefusal(tie: Extract<StatementTie, { kind: 'off' }>, currency: CurrencyCode): string {
  const amount = (money: AccountMoney): string => formatAccountMoney(money, currency)
  return words.doesNotTie(amount(tie.statement.opening), amount(tie.rows), amount(tie.reached), amount(tie.statement.closing), formatAccountMoney(tie.gap, currency, 'magnitude'))
}
