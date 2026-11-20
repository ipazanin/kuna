import type { OffersBook } from './instalmentOffers'
import { movedInTime } from './linkTarget'
import type { CashMovementTarget, LinkTarget } from './linkTarget'
import { holdsLink, rowItemsOf } from '../../workbook/domain/rowItems'
import { rowLinkText } from '../../workbook/domain/rowLink'
import type { Transaction } from '../../workbook/domain/transaction'
import { nearestTo } from '../../../../shared/app/moneyMatch'
import { ZERO_ACCOUNT_MONEY, absAccountMoney, accountMoneyOfEuros, subtractAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { moneyAt, percentFromWhole } from '../../../../shared/money/percent'

/** How far the euros a row moved may be from a deposit's or a withdrawal's, as a share of the movement's euros, for To review to offer the link. */
export const CASH_MOVEMENT_NEAR = percentFromWhole(2)

/**
 * How much more arrived than left, below zero when less arrived: at the broker for a deposit, the movement's euros less what the
 * row paid, and from the broker for a withdrawal, what the row got less the movement's euros. Null for an account not in euros,
 * whose money does not compare with the movement's euros.
 */
export function arrivedBeyond(target: CashMovementTarget, row: Pick<Transaction, 'amount'>, currency: CurrencyCode): AccountMoney | null {
  if (currency !== EURO) return null
  const moved = absAccountMoney(row.amount)
  const euros = accountMoneyOfEuros(target.amount)
  return target.movement === 'deposit' ? subtractAccountMoney(euros, moved) : subtractAccountMoney(moved, euros)
}

/** Whether the money the row moved is within 2 percent of the movement's euros, either way. */
export function nearInEuros(target: CashMovementTarget, row: Pick<Transaction, 'amount'>): boolean {
  const apart = absAccountMoney(subtractAccountMoney(absAccountMoney(row.amount), accountMoneyOfEuros(target.amount)))
  return apart <= accountMoneyOfEuros(moneyAt(target.amount, CASH_MOVEMENT_NEAR))
}

/** A row that may pay a deposit into a broker's account, or be a withdrawal from it, which a person links with one tap. */
export interface CashMovementOffer<Target extends CashMovementTarget = CashMovementTarget> {
  readonly row: Transaction
  readonly target: Target
  /** How much more arrived than left, as `arrivedBeyond` has it, zero when they are equal. */
  readonly difference: AccountMoney
}

/**
 * The rows that may each be a deposit or a withdrawal no row is linked to yet. A row may be one when it is on a euro account,
 * with no link and no other leg, and waits on review with no category on any of its money, since To review shows offers only on
 * those rows. Each row in day order takes the deposit or withdrawal nearest its day that `movedInTime` lets it be, with its
 * euros within 2 percent, and each movement is taken once.
 */
export function cashMovementOffers<Target extends LinkTarget>(book: OffersBook, targets: readonly Target[]): readonly CashMovementOffer<Target & CashMovementTarget>[] {
  const itemsOf = rowItemsOf(book)
  const linked = new Set(book.items.flatMap((item) => (item.link === null ? [] : [rowLinkText(item.link)])))
  const euroAccounts = new Set(book.accounts.filter((account) => account.currency === EURO).map((account) => account.id))
  const unfiled = (row: Transaction): boolean => {
    const items = itemsOf(row)
    return !holdsLink(items) && items.every((item) => item.category === null)
  }
  const rows = book.transactions.filter((row) => euroAccounts.has(row.account) && row.pair === null && unfiled(row))
  const open = targets.filter((target): target is Target & CashMovementTarget => target.kind === 'cash-movement' && !linked.has(rowLinkText(target.link)))
  const taken = new Set<Target & CashMovementTarget>()
  return [...rows]
    .sort((earlier, later) => earlier.date.localeCompare(later.date))
    .flatMap((row): CashMovementOffer<Target & CashMovementTarget>[] => {
      const fits = open.filter((target) => !taken.has(target) && movedInTime(row, target) && nearInEuros(target, row))
      const target = nearestTo(
        row.date,
        fits.map((candidate) => ({ date: candidate.day, target: candidate })),
      )?.target
      if (target === undefined) return []
      taken.add(target)
      return [{ row, target, difference: arrivedBeyond(target, row, EURO) ?? ZERO_ACCOUNT_MONEY }]
    })
}
