import { nearestTo } from './sameMoney'
import type { Account } from '../../workbook/domain/account'
import { refiledItems, waitsOnReview } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** How many days apart the two legs of a transfer may book. */
const TRANSFER_DAYS = 3

/** A transfer's two legs: the money out and the money in. */
export interface TransferPair<Leg = Transaction> {
  readonly debit: Leg
  readonly credit: Leg
}

export interface TransferPairs {
  /** One names the other's IBAN at an equal amount within 3 days, or they are the two legs of an exchange or a pocket move. */
  readonly pairs: readonly TransferPair[]
  /** A debit to an own IBAN, or a leg of an exchange or a pocket move, whose other leg is not in yet. Such a row counts as a transfer and waits. */
  readonly waiting: readonly Transaction[]
  /** Equal amounts within 3 days and nothing else, such as a card top-up. Only ever offered on review. */
  readonly offered: readonly TransferPair[]
}

/** A statement's row the pairing may still take: not on a pair yet, and with nothing you decided about it. */
export function isPairable(row: Transaction): boolean {
  return row.source === 'statement' && row.pair === null && row.categorisedBy !== 'person'
}

/** The IBANs of your accounts that have one. */
export function ownIbansOf(accounts: readonly Account[]): ReadonlySet<string> {
  return new Set(accounts.flatMap((account) => (account.iban === '' ? [] : [account.iban])))
}

/** Whether a row names no IBAN, or one of your own. */
export function namesNoStranger(row: Pick<Transaction, 'counterpartyIban'>, ownIbans: ReadonlySet<string>): boolean {
  return row.counterpartyIban === '' || ownIbans.has(row.counterpartyIban)
}

/**
 * Finds the transfers between two of your accounts among rows `isPairable` lets through. A friend paid the same amount on
 * the same day names an IBAN that is not yours, so that payment is neither paired nor offered. A row whose items have a category
 * is not offered either.
 */
export function transferPairs(rows: readonly Transaction[], accounts: readonly Account[], itemsOf: (row: Transaction) => readonly TransactionItem[]): TransferPairs {
  const accountById = new Map<RecordId, Account>(accounts.map((account) => [account.id, account]))
  const ownIbans = ownIbansOf(accounts)
  const inDateOrder = [...rows].sort((earlier, later) => earlier.date.localeCompare(later.date))
  const debits = inDateOrder.filter((row) => row.amount < 0)
  const credits = inDateOrder.filter((row) => row.amount > 0)
  const paired = new Set<Transaction>()

  const onTwoAccounts = (debit: Transaction, credit: Transaction): boolean => debit.account !== credit.account
  const sameMoneyMoved = (debit: Transaction, credit: Transaction): boolean =>
    onTwoAccounts(debit, credit) &&
    debit.amount === -credit.amount &&
    accountById.get(debit.account)?.currency === accountById.get(credit.account)?.currency &&
    Math.abs(daysBetween(debit.date, credit.date)) <= TRANSFER_DAYS
  const namesTheOther = (debit: Transaction, credit: Transaction): boolean =>
    (debit.counterpartyIban !== '' && debit.counterpartyIban === accountById.get(credit.account)?.iban) ||
    (credit.counterpartyIban !== '' && credit.counterpartyIban === accountById.get(debit.account)?.iban)
  const movedTogether = (debit: Transaction, credit: Transaction): boolean =>
    onTwoAccounts(debit, credit) && debit.movedAt !== '' && debit.movedAt === credit.movedAt && debit.pocket === credit.pocket && (!debit.pocket || debit.amount === -credit.amount)

  const pairWhere = (test: (debit: Transaction, credit: Transaction) => boolean): TransferPair[] =>
    debits.flatMap((debit) => {
      if (paired.has(debit)) return []
      const credit = nearestTo(
        debit.date,
        credits.filter((candidate) => !paired.has(candidate) && test(debit, candidate)),
      )
      if (credit === undefined) return []
      paired.add(debit).add(credit)
      return [{ debit, credit }]
    })

  const pairs = [...pairWhere(movedTogether), ...pairWhere((debit, credit) => sameMoneyMoved(debit, credit) && namesTheOther(debit, credit))]
  const waiting = inDateOrder.filter((row) => !paired.has(row) && (row.movedAt !== '' || (row.amount < 0 && ownIbans.has(row.counterpartyIban))))
  waiting.forEach((row) => paired.add(row))
  const offered = pairWhere(
    (debit, credit) => waitsOnReview(itemsOf(debit)) && waitsOnReview(itemsOf(credit)) && sameMoneyMoved(debit, credit) && namesNoStranger(debit, ownIbans) && namesNoStranger(credit, ownIbans),
  )
  return { pairs, waiting, offered }
}

/** The two legs as a pair: each names the other, its one item under Between my accounts, which a rule change leaves alone. */
export function legsOfPair(debit: ItemizedRow, credit: ItemizedRow, transferCategory: RecordId): readonly [ItemizedRow, ItemizedRow] {
  return [
    { row: { ...debit.row, categorisedBy: null, pair: credit.row.id }, items: refiledItems(debit.items, transferCategory) },
    { row: { ...credit.row, categorisedBy: null, pair: debit.row.id }, items: refiledItems(credit.items, transferCategory) },
  ]
}
