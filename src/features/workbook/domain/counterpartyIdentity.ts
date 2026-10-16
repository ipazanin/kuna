import { fold } from '../../../shared/text/fold'
import type { Transaction } from './workbook'

/** What separates a payee's name from a description carried in the same field. */
const DESCRIPTION_MARK = ' · '

export interface CounterpartyIdentity {
  /** `iban:` plus the IBAN when the row has one, else `name:` plus the folded name. */
  readonly key: string
  /** The folded payee name. A group's label is the alphabetically first of these. */
  readonly foldedName: string
}

/**
 * Who the other side of a row is. The IBAN decides when there is one, because a payee arrives
 * spelled several ways. Without one, the name up to the description mark decides, folded.
 */
export function counterpartyIdentity(transaction: Pick<Transaction, 'counterparty' | 'counterpartyIban'>): CounterpartyIdentity {
  const markAt = transaction.counterparty.indexOf(DESCRIPTION_MARK)
  const foldedName = fold(markAt === -1 ? transaction.counterparty : transaction.counterparty.slice(0, markAt))
  const key = transaction.counterpartyIban === '' ? `name:${foldedName}` : `iban:${transaction.counterpartyIban}`
  return { key, foldedName }
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
