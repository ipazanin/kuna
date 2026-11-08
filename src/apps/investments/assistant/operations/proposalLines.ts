import { QUANTITY_PLACES } from '../../holdings/presentation/holdingText'
import { words as holdingsWords } from '../../holdings/presentation/words'
import { words as vendorWords } from '../../prices/infrastructure/vendors/words'
import type { CashMovement } from '../../workbook/domain/cashMovement'
import type { Exchange } from '../../workbook/domain/exchange'
import type { FundMixLine } from '../../workbook/domain/fundMix'
import type { HandPrice } from '../../workbook/domain/handPrice'
import type { Income } from '../../workbook/domain/income'
import type { Instrument, PriceSource } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import {
  CASH_MOVEMENT_RECORDS,
  EXCHANGE_RECORDS,
  FUND_MIX_RECORDS,
  INCOME_RECORDS,
  INSTRUMENT_RECORDS,
  INVESTMENT_ACCOUNT_RECORDS,
  PRICE_RECORDS,
  SPIN_OFF_RECORDS,
  TRADE_RECORDS,
  TRANSFER_RECORDS,
} from '../../workbook/domain/investmentKinds'
import { REGIONS } from '../../workbook/domain/mixGroup'
import type { MixGroup, Region } from '../../workbook/domain/mixGroup'
import type { SpinOff } from '../../workbook/domain/spinOff'
import type { Trade } from '../../workbook/domain/trade'
import type { Transfer } from '../../workbook/domain/transfer'
import { words as recordWords } from '../../workbook/domain/words'
import { words } from '../words'
import type { ProposalGroup } from '../../../../shared/app/assistantOperations'
import { proposalGroups } from '../../../../shared/app/proposalGroups'
import type { ProposalDescriber, ProposedRecord } from '../../../../shared/app/proposalGroups'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { decimalOfText, timesDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { formatCurrencyAmount, formatQuantity, formatUnitPrice } from '../../../../shared/money/moneyFormat'
import type { CheckedWrite } from '../../../../shared/storage/application/recordWrites'
import type { RecordChange } from '../../../../shared/storage/application/recordStorage'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { countryName } from '../../../../shared/text/countryName'

/** The fields Kuna keeps by itself or an import brought, which no operation sets, so a card leaves them off. */
const KEPT_BY_KUNA: ReadonlySet<string> = new Set(['id', 'importKey', 'dividend', 'quoted', 'benchmark'])

/** A spin-off keeps its cost share as a fraction, which the dialog shows in percent. */
const HUNDRED = decimalOfText('100')!
const PERCENT_PLACES = 4

const VENDOR_NAMES: Readonly<Record<PriceSource, string>> = {
  twelvedata: vendorWords.twelveData.name,
  alphavantage: vendorWords.alphaVantage.name,
  manual: holdingsWords.instrumentDialog.manual,
}

/** A value JSON can write: the books keep a decimal as a whole number of its steps, which a card compares as its digits. */
function comparable(value: unknown): unknown {
  if (typeof value === 'bigint') return String(value)
  if (Array.isArray(value)) return value.map(comparable)
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([field, inner]) => [field, comparable(inner)]))
  return value
}

/** Each comparable record and the record it was made from, which a card reads its values off. */
type Originals = WeakMap<object, ProposedRecord>

function comparableChange(change: RecordChange, originals: Originals): RecordChange {
  const of = (record: unknown): unknown => {
    const made = comparable(record)
    originals.set(made as object, record as ProposedRecord)
    return made
  }
  switch (change.verb) {
    case 'add':
      return { ...change, after: of(change.after) }
    case 'change':
      return { ...change, before: of(change.before), after: of(change.after) }
    case 'remove':
      return { ...change, before: of(change.before) }
    default:
      return change
  }
}

/** Whether the record is of the kind, so its fields read with their types. */
function isKind<R>(kind: RecordKind<unknown>, of: RecordKind<R>, record: ProposedRecord): record is ProposedRecord & R {
  return kind.name === of.name && typeof record === 'object'
}

function percentText(percent: Decimal): string {
  return words.proposals.percent(formatQuantity(percent, PERCENT_PLACES))
}

function quantityText(value: Decimal | null): string | null {
  return value === null ? null : formatQuantity(value, QUANTITY_PLACES)
}

function amountText(value: Decimal | null, currency: CurrencyCode | null): string | null {
  return value === null || currency === null ? null : formatCurrencyAmount(value, currency)
}

function countryText(text: string): string {
  return (REGIONS as readonly string[]).includes(text) ? holdingsWords.regions[text as Region] : countryName(text)
}

function sliceText(slice: MixGroup, namesOf: ReadonlyMap<unknown, string>): string {
  switch (slice.mix) {
    case 'sector':
      return holdingsWords.sectors[slice.group]
    case 'country':
      return countryText(slice.group)
    case 'class':
      return holdingsWords.classes[slice.group]
    case 'account':
      return namesOf.get(slice.group) ?? ''
    default:
      return slice.group
  }
}

/** A field of a record of the transaction dialog in the words and formats the dialog shows it in, or undefined for a field shown as it is. */
function transactionValue(kind: RecordKind<unknown>, field: string, record: ProposedRecord, book: InvestmentBook, namesOf: ReadonlyMap<unknown, string>): string | null | undefined {
  const currencyOf = (instrument: unknown): CurrencyCode | null => book.instruments.find((candidate) => candidate.id === instrument)?.currency ?? null
  if (isKind(kind, TRADE_RECORDS, record)) {
    const currency = currencyOf(record.instrument)
    const shown: Partial<Record<keyof Trade, string | null>> = {
      side: recordWords.sides[record.side],
      quantity: quantityText(record.quantity),
      price: currency === null ? null : formatUnitPrice(record.price, currency),
      fees: amountText(record.fees, currency),
      rate: quantityText(record.rate),
      accrued: amountText(record.accrued, currency),
    }
    return shown[field as keyof Trade]
  }
  if (isKind(kind, INCOME_RECORDS, record)) {
    const shown: Partial<Record<keyof Income, string | null>> = {
      kind: recordWords.incomeKinds[record.kind],
      gross: amountText(record.gross, record.currency),
      withheld: amountText(record.withheld, record.currency),
      rate: quantityText(record.rate),
    }
    return shown[field as keyof Income]
  }
  if (isKind(kind, CASH_MOVEMENT_RECORDS, record)) {
    const shown: Partial<Record<keyof CashMovement, string | null>> = {
      kind: recordWords.movementKinds[record.kind],
      amount: amountText(record.amount, record.currency),
      rate: quantityText(record.rate),
    }
    return shown[field as keyof CashMovement]
  }
  if (isKind(kind, EXCHANGE_RECORDS, record)) {
    const shown: Partial<Record<keyof Exchange, string | null>> = {
      sold: amountText(record.sold, record.soldCurrency),
      bought: amountText(record.bought, record.boughtCurrency),
      fees: record.fees === null ? null : amountText(record.fees.amount, record.fees.currency),
    }
    return shown[field as keyof Exchange]
  }
  if (isKind(kind, TRANSFER_RECORDS, record) && field === 'moved') {
    const moved: Transfer['moved'] = record.moved
    return moved.kind === 'cash' ? amountText(moved.amount, moved.currency) : words.proposals.units(formatQuantity(moved.quantity, QUANTITY_PLACES), namesOf.get(moved.instrument) ?? '')
  }
  if (isKind(kind, SPIN_OFF_RECORDS, record)) {
    const shown: Partial<Record<keyof SpinOff, string | null>> = { quantity: quantityText(record.quantity), costShare: percentText(timesDecimal(record.costShare, HUNDRED)) }
    return shown[field as keyof SpinOff]
  }
  if (isKind(kind, PRICE_RECORDS, record) && field === 'price') {
    const handPrice: HandPrice = record
    const currency = currencyOf(handPrice.instrument)
    return currency === null ? null : formatUnitPrice(handPrice.price, currency)
  }
  return undefined
}

/** A field of an instrument or a line of its mix in the holding dialog's words, or undefined for a field shown as it is. */
function holdingValue(kind: RecordKind<unknown>, field: string, record: ProposedRecord, namesOf: ReadonlyMap<unknown, string>): string | null | undefined {
  if (isKind(kind, INSTRUMENT_RECORDS, record)) {
    const shown: Partial<Record<keyof Instrument, string | null>> = {
      type: record.type === null ? null : holdingsWords.types[record.type],
      class: holdingsWords.classes[record.class],
      prices: VENDOR_NAMES[record.prices],
      sector: record.sector === null ? null : holdingsWords.sectors[record.sector],
      country: record.country === null ? null : countryText(record.country),
      ter: record.ter === null ? null : percentText(record.ter),
      distribution: record.distribution === null ? null : holdingsWords.distributions[record.distribution],
    }
    return shown[field as keyof Instrument]
  }
  if (isKind(kind, FUND_MIX_RECORDS, record)) {
    const line: FundMixLine = record
    const shown: Partial<Record<keyof FundMixLine, string>> = { slice: sliceText(line.slice, namesOf), percent: percentText(line.percent) }
    return shown[field as keyof FundMixLine]
  }
  return undefined
}

/**
 * A value as a person reads it on screen: an amount in its currency, units and rates as numbers, a percent with its sign,
 * a day in words, a name for an account or instrument it points at, and the dialogs' words for a side, a kind, a type or a sector.
 */
function shownValue(kind: RecordKind<unknown>, field: string, record: ProposedRecord, book: InvestmentBook, namesOf: ReadonlyMap<unknown, string>): string | null {
  const value = record[field]
  if (value === null || value === undefined || value === '') return null
  const ofTransaction = transactionValue(kind, field, record, book, namesOf)
  if (ofTransaction !== undefined) return ofTransaction
  const ofHolding = holdingValue(kind, field, record, namesOf)
  if (ofHolding !== undefined) return ofHolding
  if (typeof value === 'boolean') return value ? words.proposals.yes : words.proposals.no
  const day = field === 'date' && typeof value === 'string' ? parseCivilDate(value) : null
  if (day !== null) return dayLabel(day)
  return namesOf.get(value) ?? String(value)
}

/** What the record is called on screen: an account or an instrument by its name, a trade by its side and holding, a line of a fund's mix by its fund, and the rest by the write's own words. */
function labelOf(kind: RecordKind<unknown>, record: ProposedRecord, fallback: string, namesOf: ReadonlyMap<unknown, string>): string {
  if (isKind(kind, INVESTMENT_ACCOUNT_RECORDS, record) || isKind(kind, INSTRUMENT_RECORDS, record)) return record.name
  if (isKind(kind, TRADE_RECORDS, record)) return `${recordWords.sides[record.side]} ${namesOf.get(record.instrument) ?? ''}`.trim()
  if (isKind(kind, FUND_MIX_RECORDS, record)) return namesOf.get(record.instrument) ?? fallback
  return fallback
}

/** What a checked write does, grouped by verb and kind in the order it does it, in Kuna's words and never the model's. */
export function proposalGroupsOf(checked: CheckedWrite, book: InvestmentBook): readonly ProposalGroup[] {
  const namesOf = new Map<unknown, string>([...book.accounts, ...book.instruments].map((record) => [record.id, record.name]))
  checked.changes.forEach(({ change }) => {
    if (change.verb === 'add' && (change.kind.name === INVESTMENT_ACCOUNT_RECORDS.name || change.kind.name === INSTRUMENT_RECORDS.name)) {
      const added = change.after as { readonly id: string; readonly name: string }
      namesOf.set(added.id, added.name)
    }
  })
  const originals: Originals = new WeakMap()
  const comparableWrite: CheckedWrite = { ...checked, changes: checked.changes.map((ruled) => ({ ...ruled, change: comparableChange(ruled.change, originals) })) }
  const original = (record: ProposedRecord): ProposedRecord => originals.get(record) ?? record
  const describer: ProposalDescriber = {
    keptByKuna: KEPT_BY_KUNA,
    fieldName: (field) => (words.proposals.fields as Readonly<Record<string, string>>)[field] ?? field,
    shown: (kind, field, record) => shownValue(kind, field, original(record), book, namesOf),
    label: (kind, record, fallback) => labelOf(kind, original(record), fallback, namesOf),
    warns: () => false,
  }
  return proposalGroups(comparableWrite, () => describer)
}
