import { fold, normaliseIban } from '../../../shared/text/fold'
import type { Transaction } from './workbook'

/** What separates a payee's name from a description carried in the same field. */
const DESCRIPTION_MARK = ' · '

const NO_CARD_SETTLEMENT: ReadonlySet<string> = new Set()

export interface CounterpartyIdentity {
  /** `iban:` plus the IBAN when it decides, else `name:` plus the folded name. */
  readonly key: string
  /** The folded payee name. A group's label is the alphabetically first of these. */
  readonly foldedName: string
  /** The payee name as the row writes it, without the description and the outer spaces. */
  readonly writtenName: string
  /** The IBAN the key holds, blank when the name decides. */
  readonly iban: string
}

/**
 * Who the other side of a row is. The IBAN decides when there is one, because a payee arrives
 * spelled several ways. Without one, the name up to the description mark decides, folded. A card
 * purchase settled against one of `cardSettlementIbans` carries the bank as its payee and the
 * merchant after the mark, so there the merchant's name decides.
 */
export function counterpartyIdentity(
  transaction: Pick<Transaction, 'counterparty' | 'counterpartyIban'>,
  cardSettlementIbans: ReadonlySet<string> = NO_CARD_SETTLEMENT,
): CounterpartyIdentity {
  const markAt = transaction.counterparty.indexOf(DESCRIPTION_MARK)
  const cardPurchase = cardSettlementIbans.has(normaliseIban(transaction.counterpartyIban))
  const nameText =
    markAt === -1 ? transaction.counterparty : cardPurchase ? transaction.counterparty.slice(markAt + DESCRIPTION_MARK.length) : transaction.counterparty.slice(0, markAt)
  const writtenName = nameText.trim().replace(/\s+/g, ' ')
  const foldedName = fold(writtenName)
  const iban = cardPurchase ? '' : transaction.counterpartyIban
  return { key: iban === '' ? `name:${foldedName}` : `iban:${iban}`, foldedName, writtenName, iban }
}

/**
 * The label of every counterparty key the rows carry: the alphabetically first folded spelling,
 * so a label stays put as new rows arrive.
 */
export function counterpartyLabels(
  transactions: Iterable<Pick<Transaction, 'counterparty' | 'counterpartyIban'>>,
): ReadonlyMap<string, string> {
  const labels = new Map<string, string>()
  for (const transaction of transactions) {
    const { key, foldedName } = counterpartyIdentity(transaction)
    const label = labels.get(key)
    if (label === undefined || foldedName < label) {
      labels.set(key, foldedName)
    }
  }
  return labels
}
