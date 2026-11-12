import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { NO_BANK_FACTS } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import { absAccountMoney, negateAccountMoney } from '../../../../shared/money/accountMoney'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'

/** One leg of a transfer between two of your accounts. */
export interface TransferLeg {
  readonly account: Transaction['account']
  /** Above zero: what left the one account, or reached the other, in its currency. */
  readonly amount: Transaction['amount']
}

/**
 * The two legs of a transfer, money out of one account and into the other, each naming the other as its pair. The money stays
 * yours, so neither leg has a payee.
 */
export function newTransfer(from: TransferLeg, to: TransferLeg, entry: Pick<Transaction, 'date' | 'note' | 'category'>): readonly [Transaction, Transaction] {
  const outId = recordIdOf(TRANSACTION_RECORDS, newRecordId())
  const inId = recordIdOf(TRANSACTION_RECORDS, newRecordId())
  const shared = { ...NO_BANK_FACTS, date: entry.date, payee: '', note: entry.note.trim(), category: entry.category, source: 'typed' as const, categorisedBy: 'person' as const, link: null }
  return [
    { ...shared, id: outId, account: from.account, amount: negateAccountMoney(absAccountMoney(from.amount)), pair: inId },
    { ...shared, id: inId, account: to.account, amount: absAccountMoney(to.amount), pair: outId },
  ]
}
