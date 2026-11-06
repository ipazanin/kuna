import { requiredReference } from './recordReference'
import type { Receipt } from './receipt'
import { RECEIPT_RECORDS, TRANSACTION_RECORDS } from './spendingKinds'
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

export function receiptOf(fields: StoredFields, id: RecordId | null): Receipt {
  const total = requiredMoney(fields, 'total')
  if (total <= 0) refuse(words.totalNotAboveZero)
  return {
    id: ownId(id),
    transaction: requiredReference(fields, 'transaction', TRANSACTION_RECORDS),
    merchant: textOf(fields.merchant),
    merchantOib: textOf(fields.merchant_oib),
    buyerOib: textOf(fields.buyer_oib),
    ...issuedOf(textOf(fields.issued_at)),
    total,
    jir: textOf(fields.jir),
    zki: textOf(fields.zki),
    readBy: textOf(fields.read_by),
    photo: textOf(fields.photo),
  }
}

export const RECEIPT_CODEC: RecordCodec<Receipt> = withIdField(RECEIPT_RECORDS, words.receiptLabel, receiptOf, (receipt) =>
  filledFields({
    transaction: keyOfRecordId(TRANSACTION_RECORDS, receipt.transaction),
    merchant: receipt.merchant,
    merchant_oib: receipt.merchantOib,
    buyer_oib: receipt.buyerOib,
    issued_at: receipt.issuedTime === '' ? receipt.issuedOn : `${receipt.issuedOn} ${receipt.issuedTime}`,
    total: amountText(receipt.total),
    jir: receipt.jir,
    zki: receipt.zki,
    read_by: receipt.readBy,
    photo: receipt.photo,
  }),
)
