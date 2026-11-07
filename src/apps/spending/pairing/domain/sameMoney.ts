import type { Transaction } from '../../workbook/domain/transaction'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { subtractAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'

/** How long before and after the typed day a bank may book the same money. */
const BOOKED_DAYS_BEFORE = 3
const BOOKED_DAYS_AFTER = 7

/** How far past that window an equal amount is still offered, either way. */
const NEAR_DAYS = 14

/** The share of the larger amount a different amount may differ by and still be offered. */
const NEAR_AMOUNT_SHARE = 0.1

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

/** What the same-money tests read of each side, which need not be a row yet, as a receipt is not. */
export type DatedMoney = Pick<Transaction, 'date' | 'amount'>

/** Whether the bank's day falls from 3 days before to 7 days after the typed day. */
export function inWindow(typed: DatedMoney, bank: DatedMoney): boolean {
  const days = daysBetween(typed.date, bank.date)
  return days >= -BOOKED_DAYS_BEFORE && days <= BOOKED_DAYS_AFTER
}

/** Whether a bank row is close enough to be offered: an equal amount within 14 days, or within a tenth of the larger amount inside the window. */
export function isNear(typed: DatedMoney, bank: DatedMoney): boolean {
  if (typed.amount === bank.amount) return Math.abs(daysBetween(typed.date, bank.date)) <= NEAR_DAYS
  const sameWay = typed.amount < 0 === bank.amount < 0
  return sameWay && inWindow(typed, bank) && Math.abs(typed.amount - bank.amount) <= NEAR_AMOUNT_SHARE * Math.max(Math.abs(typed.amount), Math.abs(bank.amount))
}

function byDate<Row extends MoneyRow>(rows: readonly Row[]): Row[] {
  return [...rows].sort((earlier, later) => earlier.date.localeCompare(later.date))
}

/** The row booked nearest the day, the earlier on a tie. The rows come in date order. */
export function nearestTo<Row extends Pick<Transaction, 'date'>>(date: CivilDate, rows: readonly Row[]): Row | undefined {
  const away = (row: Row): number => Math.abs(daysBetween(date, row.date))
  return rows.reduce<Row | undefined>((nearest, row) => (nearest === undefined || away(row) < away(nearest) ? row : nearest), undefined)
}

/** Each typed row in date order takes the nearest bank row of the same money that `fits`, and leaves it taken. */
function oneToOne<Typed extends MoneyRow, Bank extends MoneyRow>(
  typedRows: readonly Typed[],
  banks: readonly Bank[],
  taken: Set<Bank>,
  fits: (typed: MoneyRow, bank: MoneyRow) => boolean,
): { readonly matches: SameMoneyMatch<Typed, Bank>[]; readonly unmatched: Typed[] } {
  const matches: SameMoneyMatch<Typed, Bank>[] = []
  const unmatched: Typed[] = []
  for (const typed of byDate(typedRows)) {
    const bank = nearestTo(
      typed.date,
      banks.filter((candidate) => !taken.has(candidate) && candidate.account === typed.account && candidate.amount === typed.amount && fits(typed, candidate)),
    )
    if (bank === undefined) {
      unmatched.push(typed)
    } else {
      taken.add(bank)
      matches.push({ typed, bank })
    }
  }
  return { matches, unmatched }
}

/**
 * Pairs what you typed with what a bank booked. They are the same money on one account, at an equal amount, when the
 * bank's day is from 3 days before to 7 days after the typed day. Typed rows take their nearest candidate one to one in
 * date order, so two equal coffees on one day stay two. What is left over may be offered as a near match, one to one as well.
 */
export function sameMoney<Typed extends MoneyRow, Bank extends MoneyRow>(typedRows: readonly Typed[], bankRows: readonly Bank[]): SameMoney<Typed, Bank> {
  const banks = byDate(bankRows)
  const taken = new Set<Bank>()
  const { matches, unmatched } = oneToOne(typedRows, banks, taken, inWindow)
  const near: NearMatch<Typed, Bank>[] = []
  for (const typed of unmatched) {
    const bank = nearestTo(
      typed.date,
      banks.filter((candidate) => !taken.has(candidate) && candidate.account === typed.account && isNear(typed, candidate)),
    )
    if (bank !== undefined) {
      taken.add(bank)
      near.push({ typed, bank, difference: subtractAccountMoney(bank.amount, typed.amount) })
    }
  }
  return { matches, near }
}

/** The rows on the file you typed or a receipt made, which no bank row filled yet. */
export function typedRowsOf(book: { readonly transactions: readonly Transaction[] }): readonly Transaction[] {
  return book.transactions.filter((row) => row.source !== 'statement' && row.importKey === '')
}
