import { transcribedImportKeys } from './statementRows'
import type { StatementRow, StatementRows } from './statementRows'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { LookAlikes } from '../../../../shared/money/lookAlikeBookings'
import { statementTies } from '../../../../shared/money/statementTies'
import type { StatementTie } from '../../../../shared/money/statementTies'
import { normaliseIban } from '../../../../shared/text/fold'

/** A row the AI copied off a statement, read into the account's money and a day. */
export interface CopiedRow {
  readonly date: CivilDate
  readonly amount: AccountMoney
  readonly payee: string
  readonly iban: string | null
}

/**
 * One part of a statement the AI copied, on the account it is for. The statement's name, the same on every part, labels its rows,
 * so the parts are told as one statement. The label leaves out words of one language, so a part read in the other still joins it.
 */
export function copiedStatementRows(account: Account, name: string, rows: readonly CopiedRow[], lookAlikes: LookAlikes): StatementRows {
  const dated = rows.map((row) => ({ account: account.id, date: row.date, amount: row.amount, payee: row.payee.trim(), iban: row.iban }))
  const keys = transcribedImportKeys(dated)
  return {
    label: `${account.name}, ${name.trim()}`,
    rows: dated.map(({ iban, ...row }, at): StatementRow => ({
      ...row,
      category: null,
      description: '',
      counterpartyIban: iban === null ? '' : normaliseIban(iban),
      importKey: keys[at]!,
      movedAt: '',
      pocket: false,
      cashWithdrawal: false,
    })),
    notes: [],
    transcribed: { lookAlikes },
  }
}

/** The rows the statement's earlier parts put on its account: those of its label whose key no row of this part carries. */
export function earlierPartRows(transactions: readonly Transaction[], part: StatementRows): readonly Transaction[] {
  const account = part.rows[0]?.account
  const keys = new Set(part.rows.map((row) => row.importKey))
  return transactions.filter((row) => row.account === account && row.statement === part.label && !keys.has(row.importKey))
}

/**
 * Whether the statement's printed balances tie: the opening, then the rows its earlier parts put in Kuna, then this part's rows,
 * reach the closing. A row an earlier part found in Kuna from another source is not among them, so it reads as missing.
 */
export function copiedStatementTie(part: StatementRows, earlier: readonly Transaction[], opening: AccountMoney, closing: AccountMoney): StatementTie<AccountMoney> {
  return statementTies({ opening, amounts: [...earlier, ...part.rows].map((row) => row.amount), closing })
}
