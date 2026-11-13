import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { NO_BANK_FACTS } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import { wholeItemOf } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { absAccountMoney, negateAccountMoney } from '../../../../shared/money/accountMoney'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'

/** One leg of a transfer between two of your accounts. */
export interface TransferLeg {
  readonly account: Transaction['account']
  /** Above zero: what left the one account, or reached the other, in its currency. */
  readonly amount: Transaction['amount']
}

/**
 * The two legs of a transfer, money out of one account and into the other, each naming the other as its pair and with one item
 * under Between my accounts that holds the note. The money stays yours, so neither leg has a payee.
 */
export function newTransfer(from: TransferLeg, to: TransferLeg, entry: Pick<Transaction, 'date'> & { readonly note: string; readonly category: RecordId }): readonly [ItemizedRow, ItemizedRow] {
  const outId = recordIdOf(TRANSACTION_RECORDS, newRecordId())
  const inId = recordIdOf(TRANSACTION_RECORDS, newRecordId())
  const shared = { ...NO_BANK_FACTS, date: entry.date, payee: '', source: 'typed' as const, categorisedBy: 'person' as const }
  const legOf = (row: Transaction): ItemizedRow => ({ row, items: [wholeItemOf(row, { category: entry.category, note: entry.note.trim(), link: null })] })
  return [
    legOf({ ...shared, id: outId, account: from.account, amount: negateAccountMoney(absAccountMoney(from.amount)), pair: inId }),
    legOf({ ...shared, id: inId, account: to.account, amount: absAccountMoney(to.amount), pair: outId }),
  ]
}
