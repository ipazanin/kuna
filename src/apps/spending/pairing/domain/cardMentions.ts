import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'

/**
 * Four digits after a mask, as statements print a card: `*3670`, `**3670`, `XXXX3670`, `•••• 3670`, `...3670` or a masked
 * number such as `5355 **** **** 3670`. A run of X counts only from two on, and bare digits never count, since a date, an
 * amount or a reference holds them too. A mask straight after letters is a merchant's reference, such as `REVOLUT**9037*`.
 */
const MASKED_CARD = /(?<![\p{L}*•●…])(?:\*+|[•●]+|[Xx]{2,}|(?<!\.)\.{2,}|…)[\s*•●Xx.…-]*(\d{4})(?!\d)/gu

/** The last four digits of each card the text names behind a mask. */
export function cardsNamedIn(text: string): ReadonlySet<string> {
  return new Set([...text.matchAll(MASKED_CARD)].map((match) => match[1]!))
}

/** The cards a row names in its payee or its description. */
export function cardsNamedBy(row: Pick<Transaction, 'payee' | 'description'>): ReadonlySet<string> {
  return cardsNamedIn(`${row.payee}\n${row.description}`)
}

/**
 * Whether the row names a card that pays from `other` and not from the row's own account, such as a Revolut top-up that names an
 * OTP card. A card both accounts list, as one card holding two currencies does, says nothing about which way the money went.
 */
export function namesCardOf(named: ReadonlySet<string>, own: Pick<Account, 'id' | 'cards'> | undefined, other: Pick<Account, 'id' | 'cards'>): boolean {
  return own?.id !== other.id && other.cards.some((card) => named.has(card) && !(own?.cards.includes(card) ?? false))
}
