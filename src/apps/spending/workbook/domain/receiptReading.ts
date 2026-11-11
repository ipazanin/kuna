import { optionalReference } from './recordReference'
import type { Receipt } from './receipt'
import { ACCOUNT_RECORDS, RECEIPT_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
import { words } from './words'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredMoney, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

const ISSUED_AT = /^(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))?$/

function issuedOf(text: string): { readonly issuedOn: CivilDate; readonly issuedTime: string } {
  const [, day, time] = ISSUED_AT.exec(text) ?? []
  const issuedOn = day === undefined ? null : parseCivilDate(day)
  return issuedOn === null ? refuse(words.notIssuedAt(text)) : { issuedOn, issuedTime: time ?? '' }
}

/** A receipt names its entry, or the account it waits on until the bank brings its row, and never both. */
export function receiptOf(fields: StoredFields, id: RecordId | null): Receipt {
  const total = requiredMoney(fields, 'total')
  if (total <= 0) refuse(words.totalNotAboveZero)
  const transaction = optionalReference(fields, 'transaction', TRANSACTION_RECORDS)
  const account = optionalReference(fields, 'account', ACCOUNT_RECORDS)
  if ((transaction === null) === (account === null)) refuse(words.receiptEntryOrAccount)
  return {
    id: ownId(id),
    transaction,
    account,
    merchant: textOf(fields.merchant),
    merchantOib: textOf(fields.merchant_oib),
    buyerOib: textOf(fields.buyer_oib),
    ...issuedOf(textOf(fields.issued_at)),
    total,
    jir: textOf(fields.jir),
    zki: textOf(fields.zki),
    readBy: textOf(fields.read_by),
    photo: textOf(fields.photo),
    latitude: textOf(fields.latitude),
    longitude: textOf(fields.longitude),
  }
}

export const RECEIPT_CODEC: RecordCodec<Receipt> = withIdField(RECEIPT_RECORDS, words.receiptLabel, receiptOf, (receipt) =>
  filledFields({
    transaction: receipt.transaction === null ? null : keyOfRecordId(TRANSACTION_RECORDS, receipt.transaction),
    account: receipt.account === null ? null : keyOfRecordId(ACCOUNT_RECORDS, receipt.account),
    merchant: receipt.merchant,
    merchant_oib: receipt.merchantOib,
    buyer_oib: receipt.buyerOib,
    issued_at: receipt.issuedTime === '' ? receipt.issuedOn : `${receipt.issuedOn} ${receipt.issuedTime}`,
    total: amountText(receipt.total),
    jir: receipt.jir,
    zki: receipt.zki,
    read_by: receipt.readBy,
    photo: receipt.photo,
    latitude: receipt.latitude,
    longitude: receipt.longitude,
  }),
)
