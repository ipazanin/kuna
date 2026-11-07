import { INCOME_KINDS } from './income'
import type { DividendFacts, Income } from './income'
import { decimalField, importKeyOf, namedAccount, namedInstrument, optionalDecimal, rateFor, requiredCurrency, requiredDecimal } from './investmentFields'
import { INCOME_RECORDS, INSTRUMENT_RECORDS, INVESTMENT_ACCOUNT_RECORDS } from './investmentKinds'
import { words } from './words'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { optionalDate, ownId, refuse, requiredChoice, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

/** A dividend's facts from a broker's report, or nothing when the record holds none. */
function dividendFactsOf(fields: StoredFields): { readonly dividend?: DividendFacts } {
  const sourceCountry = textOf(fields.source_country)
  const dividendType = textOf(fields.dividend_type)
  const facts: DividendFacts = {
    exDate: optionalDate(fields, 'ex_date'),
    payDate: optionalDate(fields, 'pay_date'),
    sourceCountry: sourceCountry === '' ? null : sourceCountry,
    dividendType: dividendType === '' ? null : dividendType,
  }
  return Object.values(facts).every((fact) => fact === null) ? {} : { dividend: facts }
}

/**
 * A gross below zero is a reversal the broker booked against an earlier payment, which its note has to say, and its
 * withheld is zero or below, the tax given back with it. Withheld never goes past gross.
 */
export function incomeOf(fields: StoredFields, id: RecordId | null): Income {
  const kind = requiredChoice(fields, 'kind', INCOME_KINDS, 'kind of income')
  if ((kind === 'dividend' || kind === 'coupon') && fields.instrument === undefined) refuse(words.instrumentNeeded(kind))
  const currency = requiredCurrency(fields, 'currency')
  const gross = requiredDecimal(fields, 'gross')
  if (gross === DECIMAL_ZERO) refuse(storedWords.reasons.notAboveZero('gross'))
  const reverses = gross < DECIMAL_ZERO
  if (reverses && textOf(fields.note).trim() === '') refuse(words.reversalWithoutNote)
  const withheld = optionalDecimal(fields, 'withheld') ?? DECIMAL_ZERO
  if (!reverses && withheld < DECIMAL_ZERO) refuse(words.belowZero('withheld'))
  if (reverses && withheld > DECIMAL_ZERO) refuse(words.withheldAgainstGross)
  if (reverses ? withheld < gross : withheld > gross) refuse(words.withheldOverGross)
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
    ...dividendFactsOf(fields),
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
    ex_date: income.dividend?.exDate,
    pay_date: income.dividend?.payDate,
    source_country: income.dividend?.sourceCountry,
    dividend_type: income.dividend?.dividendType,
  }),
)
