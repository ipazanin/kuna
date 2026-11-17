import { inWindow, isNear } from '../../../../shared/app/moneyMatch'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { Receipt } from '../../workbook/domain/receipt'
import type { Transaction } from '../../workbook/domain/transaction'
import { filedAsTransfer, rowItemsOf } from '../../workbook/domain/rowItems'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import { accountMoneyOfEuros, addAccountMoney, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { fold, normaliseIban } from '../../../../shared/text/fold'
import { payeeKey } from '../../payees/domain/payeeKey'
import { bankNamesIn } from './sameMerchant'

/** What the matching reads of a receipt. A blank OIB or place says nothing. */
export type ReceiptFacts = Pick<Receipt, 'merchant' | 'merchantOib' | 'issuedOn' | 'total' | 'latitude' | 'longitude'>

/** A row a receipt may split. */
export interface ReceiptCandidate {
  readonly row: Transaction
  /** The row's amount less minus the total, zero for an equal amount. */
  readonly difference: AccountMoney
}

/** One clear candidate offered ready, several to pick from, or none, which makes a new row or waits for the bank's. */
export type ReceiptMatches =
  { readonly kind: 'ready'; readonly candidates: readonly ReceiptCandidate[] } | { readonly kind: 'pick'; readonly candidates: readonly ReceiptCandidate[] } | { readonly kind: 'none' }

/** A company form says nothing of who a merchant is. */
const COMPANY_FORMS: ReadonlySet<string> = new Set(['DOO', 'JDOO', 'OBRT', 'OPG'])

/** The words of a name that can tell a merchant apart, without short bits such as those of D.O.O. and without a company form. */
function distinctWords(text: string): ReadonlySet<string> {
  return new Set(
    fold(text)
      .split(/[^A-Z0-9]+/)
      .filter((word) => word.length >= 3 && !COMPANY_FORMS.has(word)),
  )
}

/** How a fiscal receipt says it was paid: GOTOVINA is cash, KARTICA a card. */
export const RECEIPT_PAYMENTS = ['cash', 'card'] as const

export type ReceiptPayment = (typeof RECEIPT_PAYMENTS)[number]

/** Whether money paid this way can be on the account: cash only on a cash account, and a card never on one. */
export function paidOn(paid: ReceiptPayment, account: Pick<Account, 'kind'>): boolean {
  return (account.kind === 'cash') === (paid === 'cash')
}

/** The accounts a fiscal receipt can be on: open and in euros, since its total is. */
export function receiptAccounts(accounts: readonly Account[]): readonly Account[] {
  return accounts.filter((account) => !account.closed && account.currency === EURO)
}

/** The radio value of a new entry, beside the candidates' row ids. */
export const NEW_ENTRY = 'new'

/**
 * Where a receipt goes as things stand: your pick while it is still on offer, else the ready candidate, a new entry when
 * nothing matches, and blank while you must pick. Worked out each time, so a merchant typed or a read finishing never moves your pick.
 */
export function placeOf(matches: ReceiptMatches | null, picked: string | null): string {
  if (matches === null) return ''
  const candidates = matches.kind === 'none' ? [] : matches.candidates
  if (picked !== null && (picked === NEW_ENTRY || candidates.some((candidate) => candidate.row.id === picked))) return picked
  if (matches.kind === 'none') return NEW_ENTRY
  return matches.kind === 'ready' ? (candidates[0]?.row.id ?? '') : ''
}

/** The receipt already on the file with this JIR or ZKI, which name one fiscal receipt. A blank one names none. */
export function heldReceiptOf(codes: Pick<Receipt, 'jir' | 'zki'>, receipts: readonly Receipt[]): Receipt | null {
  return receipts.find((held) => (codes.jir !== '' && held.jir === codes.jir) || (codes.zki !== '' && held.zki === codes.zki)) ?? null
}

/**
 * The rows a receipt may split: payments out of a euro account, since a fiscal total is in euros and a row on another
 * account is not the same money at the same number. No row a receipt split already and no row that moves money between
 * your accounts. A row split by hand may take one, and the receipt's lines replace its parts.
 */
export function splittableRows(book: Pick<SpendingBook, 'accounts' | 'categories' | 'transactions' | 'receipts' | 'items'>): readonly Transaction[] {
  const euroAccounts = new Set(book.accounts.filter((account) => account.currency === EURO).map((account) => account.id))
  const ownIbans = new Set(book.accounts.flatMap((account) => (account.iban === '' ? [] : [normaliseIban(account.iban)])))
  const isTransfer = filedAsTransfer(book.categories)
  const withReceipt = new Set(book.receipts.map((receipt) => receipt.transaction))
  const itemsOf = rowItemsOf(book)
  return book.transactions.filter(
    (row) =>
      row.amount < 0 &&
      euroAccounts.has(row.account) &&
      !withReceipt.has(row.id) &&
      row.pair === null &&
      row.movedAt === '' &&
      !isTransfer(itemsOf(row)) &&
      !ownIbans.has(normaliseIban(row.counterpartyIban)),
  )
}

/**
 * The splittable rows this receipt may be. A receipt that says how it was paid matches only rows on accounts paid that way,
 * and one that does not say matches on any. The bank's names for the merchant come from the receipts on file, and `matchesAmong` gives the order and the rule.
 */
export function receiptMatches(receipt: ReceiptFacts, book: Pick<SpendingBook, 'accounts' | 'categories' | 'transactions' | 'receipts' | 'items'>, paid: ReceiptPayment | null): ReceiptMatches {
  const paidThere = new Set(book.accounts.filter((account) => paid === null || paidOn(paid, account)).map((account) => account.id))
  return matchesAmong(
    receipt,
    splittableRows(book).filter((row) => paidThere.has(row.account)),
    bankNamesIn(book)(receipt),
  )
}

/**
 * Which of these rows the receipt may be. Rows at minus the total within the matching window come first: a row whose payee is one of
 * the bank's names for the merchant, then by the merchant's words among the row's words, then the nearest day. One is clear when it
 * beats the next on the bank's name and then on words, or when it is alone and the bank's name or the merchant's words name it,
 * or there is neither to disagree with it. Only with none at minus the total do the near ones show, such as a card payment with a
 * tip, and those are always a pick.
 */
export function matchesAmong(receipt: Pick<ReceiptFacts, 'merchant' | 'issuedOn' | 'total'>, open: readonly Transaction[], bankNames: ReadonlySet<string>): ReceiptMatches {
  const total = accountMoneyOfEuros(receipt.total)
  const asTyped = { date: receipt.issuedOn, amount: negateAccountMoney(total) }
  const words = distinctWords(receipt.merchant)
  const wordsIn = (row: Transaction): number => {
    const named = distinctWords(`${row.payee} ${row.description}`)
    return [...words].filter((word) => named.has(word)).length
  }
  const known = (row: Transaction): number => (bankNames.has(payeeKey(row.payee)) ? 1 : 0)
  const away = (row: Transaction): number => Math.abs(daysBetween(receipt.issuedOn, row.date))
  const ranked = (rows: readonly Transaction[]): Transaction[] =>
    [...rows].sort((one, other) => known(other) - known(one) || wordsIn(other) - wordsIn(one) || away(one) - away(other) || one.date.localeCompare(other.date))
  const candidateOf = (row: Transaction): ReceiptCandidate => ({ row, difference: addAccountMoney(row.amount, total) })

  const equal = ranked(open.filter((row) => row.amount === asTyped.amount && inWindow(asTyped, row)))
  const [first, second] = equal
  if (first !== undefined) {
    const clear =
      second === undefined
        ? known(first) > 0 || wordsIn(first) > 0 || (words.size === 0 && bankNames.size === 0)
        : known(first) > known(second) || (known(first) === known(second) && wordsIn(first) > wordsIn(second))
    return { kind: clear ? 'ready' : 'pick', candidates: equal.map(candidateOf) }
  }
  const near = ranked(open.filter((row) => isNear(asTyped, row)))
  return near.length === 0 ? { kind: 'none' } : { kind: 'pick', candidates: near.map(candidateOf) }
}
