import type { Transaction } from '../../workbook/domain/transaction'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

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
  readonly difference: Money
}

export interface SameMoney<Typed, Bank> {
  readonly matches: readonly SameMoneyMatch<Typed, Bank>[]
  /** Only ever offered on review, never merged by itself. */
  readonly near: readonly NearMatch<Typed, Bank>[]
}

function inWindow(typed: MoneyRow, bank: MoneyRow): boolean {
  const days = daysBetween(typed.date, bank.date)
  return days >= -BOOKED_DAYS_BEFORE && days <= BOOKED_DAYS_AFTER
}

function isNear(typed: MoneyRow, bank: MoneyRow): boolean {
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

/**
 * Pairs what you typed with what a bank booked. They are the same money on one account, at an equal amount, when the
 * bank's day is from 3 days before to 7 days after the typed day. Typed rows take their nearest candidate one to one in
 * date order, so two equal coffees on one day stay two. What is left over may be offered as a near match, one to one as well.
 */
export function sameMoney<Typed extends MoneyRow, Bank extends MoneyRow>(typedRows: readonly Typed[], bankRows: readonly Bank[]): SameMoney<Typed, Bank> {
  const banks = byDate(bankRows)
  const taken = new Set<Bank>()
  const matches: SameMoneyMatch<Typed, Bank>[] = []
  const unmatched: Typed[] = []
  for (const typed of byDate(typedRows)) {
    const bank = nearestTo(
      typed.date,
      banks.filter((candidate) => !taken.has(candidate) && candidate.account === typed.account && candidate.amount === typed.amount && inWindow(typed, candidate)),
    )
    if (bank === undefined) {
      unmatched.push(typed)
    } else {
      taken.add(bank)
      matches.push({ typed, bank })
    }
  }
  const near: NearMatch<Typed, Bank>[] = []
  for (const typed of unmatched) {
    const bank = nearestTo(
      typed.date,
      banks.filter((candidate) => !taken.has(candidate) && candidate.account === typed.account && isNear(typed, candidate)),
    )
    if (bank !== undefined) {
      taken.add(bank)
      near.push({ typed, bank, difference: subtractMoney(bank.amount, typed.amount) })
    }
  }
  return { matches, near }
}
