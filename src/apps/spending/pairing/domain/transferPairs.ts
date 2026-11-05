import { nearestTo } from './sameMoney'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** How many days apart the two legs of a transfer may book. */
const TRANSFER_DAYS = 3

/** A transfer's two legs: the money out and the money in. */
export interface TransferPair {
  readonly debit: Transaction
  readonly credit: Transaction
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

/**
 * Finds the transfers between two of your accounts among rows `isPairable` lets through. A friend paid the same amount on
 * the same day names an IBAN that is not yours, so that payment is neither paired nor offered. A row that has a category
 * is not offered either.
 */
export function transferPairs(rows: readonly Transaction[], accounts: readonly Account[]): TransferPairs {
  const accountById = new Map<RecordId, Account>(accounts.map((account) => [account.id, account]))
  const ownIbans = new Set(accounts.flatMap((account) => (account.iban === '' ? [] : [account.iban])))
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
  const namesNoStranger = (row: Transaction): boolean => row.counterpartyIban === '' || ownIbans.has(row.counterpartyIban)
  const offered = pairWhere((debit, credit) => debit.category === null && credit.category === null && sameMoneyMoved(debit, credit) && namesNoStranger(debit) && namesNoStranger(credit))
  return { pairs, waiting, offered }
}

/** The two legs as a pair: each names the other, under Between my accounts, which a rule change leaves alone. */
export function legsOfPair(debit: Transaction, credit: Transaction, transferCategory: RecordId): readonly [Transaction, Transaction] {
  return [
    { ...debit, category: transferCategory, categorisedBy: null, pair: credit.id },
    { ...credit, category: transferCategory, categorisedBy: null, pair: debit.id },
  ]
}
