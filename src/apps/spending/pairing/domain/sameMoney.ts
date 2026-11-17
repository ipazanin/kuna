import type { Transaction } from '../../workbook/domain/transaction'
import { isNear, matchMoney } from '../../../../shared/app/moneyMatch'
import type { AccountMoney } from '../../../../shared/money/accountMoney'

/** What the money test reads of a row. */
export type MoneyRow = Pick<Transaction, 'account' | 'date' | 'amount'>

export interface SameMoneyMatch<Typed, Bank> {
  readonly typed: Typed
  readonly bank: Bank
}

export interface NearMatch<Typed, Bank> extends SameMoneyMatch<Typed, Bank> {
  /** The bank's amount less the typed one, zero for an equal amount on days further apart. */
  readonly difference: AccountMoney
}

export interface SameMoney<Typed, Bank> {
  readonly matches: readonly SameMoneyMatch<Typed, Bank>[]
  /** Only ever offered on review, never merged by itself. */
  readonly near: readonly NearMatch<Typed, Bank>[]
}

function byDate<Row extends MoneyRow>(rows: readonly Row[]): Row[] {
  return [...rows].sort((earlier, later) => earlier.date.localeCompare(later.date))
}

/**
 * Pairs what you typed with what a bank booked. They are the same money on one account, at an equal amount, when the
 * bank's day is from 3 days before to 7 days after the typed day. Typed rows take their nearest candidate one to one in
 * date order, so two equal coffees on one day stay two. What is left over may be offered as a near match, one to one as well.
 */
export function sameMoney<Typed extends MoneyRow, Bank extends MoneyRow>(typedRows: readonly Typed[], bankRows: readonly Bank[]): SameMoney<Typed, Bank> {
  const found = matchMoney(byDate(typedRows), byDate(bankRows), { mayBe: (typed, bank) => typed.account === bank.account, near: isNear })
  return {
    matches: found.filter((match) => match.exact).map(({ expected, row }) => ({ typed: expected, bank: row })),
    near: found.filter((match) => !match.exact).map(({ expected, row, difference }) => ({ typed: expected, bank: row, difference })),
  }
}

/** The rows on the file you typed or a receipt made, which no bank row filled yet. */
export function typedRowsOf(book: { readonly transactions: readonly Transaction[] }): readonly Transaction[] {
  return book.transactions.filter((row) => row.source !== 'statement' && row.importKey === '')
}
