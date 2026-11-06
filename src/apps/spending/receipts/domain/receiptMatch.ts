import { inWindow, isNear } from '../../pairing/domain/sameMoney'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { Receipt } from '../../workbook/domain/receipt'
import type { Transaction } from '../../workbook/domain/transaction'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import { addMoney, negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { fold, normaliseIban } from '../../../../shared/text/fold'

/** What the matching reads of a receipt. */
export type ReceiptFacts = Pick<Receipt, 'merchant' | 'issuedOn' | 'total'>

/** A row a receipt may split. */
export interface ReceiptCandidate {
  readonly row: Transaction
  /** The row's amount less minus the total, zero for an equal amount. */
  readonly difference: Money
}

/** One clear candidate offered ready, several to pick from, or none, which makes a new row. */
export type ReceiptMatches =
  { readonly kind: 'ready'; readonly candidates: readonly ReceiptCandidate[] } | { readonly kind: 'pick'; readonly candidates: readonly ReceiptCandidate[] } | { readonly kind: 'none' }

/** Words of the merchant's name, without the bits a company form leaves, such as D.O.O. */
function merchantWords(merchant: string): readonly string[] {
  return fold(merchant)
    .split(/[^A-Z0-9]+/)
    .filter((word) => word.length >= 3)
}

/**
 * The rows a receipt may split, which only a row on a euro account can, since a fiscal total is in euros and a row on
 * another account is not the same money at the same number. No row with a receipt, and no row that moves money between
 * your accounts. Rows at minus the total within `sameMoney`'s window come first, by the merchant's words in the row's text and then
 * the nearest day. Only with none of those do the near ones show, such as a card payment with a tip, and those are always a pick.
 */
export function receiptMatches(receipt: ReceiptFacts, book: Pick<SpendingBook, 'accounts' | 'categories' | 'transactions' | 'receipts'>): ReceiptMatches {
  const euroAccounts = new Set(book.accounts.filter((account) => account.currency === EURO).map((account) => account.id))
  const ownIbans = new Set(book.accounts.flatMap((account) => (account.iban === '' ? [] : [normaliseIban(account.iban)])))
  const transfer = book.categories.find((category) => category.kind === 'transfer')?.id ?? null
  const withReceipt = new Set(book.receipts.map((held) => held.transaction))
  const open = book.transactions.filter(
    (row) =>
      euroAccounts.has(row.account) &&
      !withReceipt.has(row.id) &&
      row.pair === null &&
      row.movedAt === '' &&
      (transfer === null || row.category !== transfer) &&
      !ownIbans.has(normaliseIban(row.counterpartyIban)),
  )
  const asTyped = { date: receipt.issuedOn, amount: negateMoney(receipt.total) }
  const words = merchantWords(receipt.merchant)
  const wordsIn = (row: Transaction): number => {
    const text = fold(`${row.payee} ${row.description}`)
    return words.filter((word) => text.includes(word)).length
  }
  const away = (row: Transaction): number => Math.abs(daysBetween(receipt.issuedOn, row.date))
  const ranked = (rows: readonly Transaction[]): Transaction[] => [...rows].sort((one, other) => wordsIn(other) - wordsIn(one) || away(one) - away(other) || one.date.localeCompare(other.date))
  const candidateOf = (row: Transaction): ReceiptCandidate => ({ row, difference: addMoney(row.amount, receipt.total) })

  const equal = ranked(open.filter((row) => row.amount === asTyped.amount && inWindow(asTyped, row)))
  const [first, second] = equal
  if (first !== undefined) {
    const clear = second === undefined || wordsIn(first) > wordsIn(second)
    return { kind: clear ? 'ready' : 'pick', candidates: equal.map(candidateOf) }
  }
  const near = ranked(open.filter((row) => isNear(asTyped, row)))
  return near.length === 0 ? { kind: 'none' } : { kind: 'pick', candidates: near.map(candidateOf) }
}
