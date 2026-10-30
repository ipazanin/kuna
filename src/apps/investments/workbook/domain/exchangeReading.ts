import type { Exchange, ExchangeFees } from './exchange'
import { decimalField, importKeyOf, namedAccount, optionalUnsigned, positiveDecimal, requiredCurrency } from './investmentFields'
import { EXCHANGE_RECORDS, INVESTMENT_ACCOUNT_RECORDS } from './investmentKinds'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'

function feesOf(fields: StoredFields): ExchangeFees | null {
  const amount = optionalUnsigned(fields, 'fees')
  if (amount === null && fields.fee_currency === undefined) return null
  if (amount === null || fields.fee_currency === undefined) refuse(storedWords.reasons.goTogether('fees', 'fee_currency'))
  return { amount, currency: requiredCurrency(fields, 'fee_currency') }
}

export function exchangeOf(fields: StoredFields, id: RecordId | null): Exchange {
  const soldCurrency = requiredCurrency(fields, 'sold_currency')
  const boughtCurrency = requiredCurrency(fields, 'bought_currency')
  if (soldCurrency === boughtCurrency) refuse(words.sameCurrencies)
  return {
    id: ownId(id),
    account: namedAccount(fields, 'account'),
    date: requiredDate(fields, 'date'),
    sold: positiveDecimal(fields, 'sold'),
    soldCurrency,
    bought: positiveDecimal(fields, 'bought'),
    boughtCurrency,
    fees: feesOf(fields),
    importKey: importKeyOf(fields),
    note: textOf(fields.note),
  }
}

export const EXCHANGE_CODEC: RecordCodec<Exchange> = withIdField(EXCHANGE_RECORDS, words.labels.exchange, exchangeOf, (exchange) =>
  filledFields({
    account: keyOfRecordId(INVESTMENT_ACCOUNT_RECORDS, exchange.account),
    date: exchange.date,
    sold: decimalField(exchange.sold),
    sold_currency: exchange.soldCurrency,
    bought: decimalField(exchange.bought),
    bought_currency: exchange.boughtCurrency,
    fees: decimalField(exchange.fees?.amount ?? null),
    fee_currency: exchange.fees?.currency,
    import_key: exchange.importKey,
    note: exchange.note,
  }),
)
