import { INCOME_KINDS } from './income'
import type { Income } from './income'
import { decimalField, importKeyOf, namedAccount, namedInstrument, optionalUnsigned, positiveDecimal, rateFor, requiredCurrency } from './investmentFields'
import { INCOME_RECORDS, INSTRUMENT_RECORDS, INVESTMENT_ACCOUNT_RECORDS } from './investmentKinds'
import { words } from './words'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredChoice, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function incomeOf(fields: StoredFields, id: RecordId | null): Income {
  const kind = requiredChoice(fields, 'kind', INCOME_KINDS, 'kind of income')
  if ((kind === 'dividend' || kind === 'coupon') && fields.instrument === undefined) refuse(words.instrumentNeeded(kind))
  const currency = requiredCurrency(fields, 'currency')
  const gross = positiveDecimal(fields, 'gross')
  const withheld = optionalUnsigned(fields, 'withheld') ?? DECIMAL_ZERO
  if (withheld > gross) refuse(words.withheldOverGross)
  return {
    id: ownId(id),
    account: namedAccount(fields, 'account'),
    kind,
    instrument: fields.instrument === undefined ? null : namedInstrument(fields, 'instrument'),
    date: requiredDate(fields, 'date'),
    currency,
    gross,
    withheld,
    rate: rateFor(fields, currency),
    importKey: importKeyOf(fields),
    note: textOf(fields.note),
  }
}

export const INCOME_CODEC: RecordCodec<Income> = withIdField(INCOME_RECORDS, words.labels.income, incomeOf, (income) =>
  filledFields({
    account: keyOfRecordId(INVESTMENT_ACCOUNT_RECORDS, income.account),
    kind: income.kind,
    instrument: income.instrument === null ? null : keyOfRecordId(INSTRUMENT_RECORDS, income.instrument),
    date: income.date,
    currency: income.currency,
    gross: decimalField(income.gross),
    withheld: income.withheld === DECIMAL_ZERO ? null : decimalField(income.withheld),
    rate: decimalField(income.rate),
    import_key: income.importKey,
    note: income.note,
  }),
)
