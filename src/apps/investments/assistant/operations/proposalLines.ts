import { QUANTITY_PLACES } from '../../holdings/presentation/holdingText'
import { words as cardWords } from '../../../../shared/app/words'
import { words as holdingsWords } from '../../holdings/presentation/words'
import { words as mailWords } from '../../mail/presentation/words'
import { thresholdText } from '../../overview/presentation/checkLines'
import { words as overviewWords } from '../../overview/presentation/words'
import { words as vendorWords } from '../../prices/infrastructure/vendors/words'
import { storedCityText } from '../../tax/presentation/surtaxCityChoices'
import { words as taxWords } from '../../tax/presentation/words'
import type { CashMovement } from '../../workbook/domain/cashMovement'
import { NEW_CHECK_DEFAULTS } from '../../workbook/domain/checkSetting'
import type { CheckSetting } from '../../workbook/domain/checkSetting'
import type { Exchange } from '../../workbook/domain/exchange'
import type { FundMixLine } from '../../workbook/domain/fundMix'
import type { HandPrice } from '../../workbook/domain/handPrice'
import type { Income } from '../../workbook/domain/income'
import { NEW_INSTRUMENT_DEFAULTS } from '../../workbook/domain/instrument'
import type { Instrument, PriceSource } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import {
  CASH_MOVEMENT_RECORDS,
  CHECK_RECORDS,
  EXCHANGE_RECORDS,
  FUND_MIX_RECORDS,
  INCOME_RECORDS,
  INSTRUMENT_RECORDS,
  INVESTMENT_ACCOUNT_RECORDS,
  MAIL_READER_RECORDS,
  PRICE_RECORDS,
  SETTING_RECORDS,
  SPIN_OFF_RECORDS,
  TARGET_RECORDS,
  TRADE_RECORDS,
  TRANSFER_RECORDS,
} from '../../workbook/domain/investmentKinds'
import { SURTAX_CITY_2023_KEY } from '../../workbook/domain/investmentSettings'
import { REGIONS } from '../../workbook/domain/mixGroup'
import type { MailReader } from '../../workbook/domain/mailReader'
import type { MixGroup, Region } from '../../workbook/domain/mixGroup'
import type { SpinOff } from '../../workbook/domain/spinOff'
import type { Target } from '../../workbook/domain/target'
import type { Trade } from '../../workbook/domain/trade'
import type { Transfer } from '../../workbook/domain/transfer'
import { words as recordWords } from '../../workbook/domain/words'
import { words } from '../words'
import type { CardNote, ProposalGroup } from '../../../../shared/app/assistantOperations'
import { proposalGroups, withNotes } from '../../../../shared/app/proposalGroups'
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
import type { SettingRow } from '../../../../shared/storage/domain/settingRows'
import { countryName } from '../../../../shared/text/countryName'
import { plural } from '../../../../shared/text/translation'

/** The fields Kuna keeps by itself or an import brought, which no operation sets, so a card leaves them off. */
const KEPT_BY_KUNA: ReadonlySet<string> = new Set(['id', 'importKey', 'dividend', 'recipe'])

/** The mail reader's fields by the names its card gives them. */
const MAIL_FIELD_NAMES: Readonly<Record<string, string>> = {
  on: mailWords.card.on,
  senders: mailWords.card.senders,
  subject: mailWords.card.subject,
  contents: mailWords.card.contents,
  since: mailWords.card.since,
}

/** The mail reader's senders say whose mail Kuna reads, so the card marks them. */
const WARNS: ReadonlySet<string> = new Set(['senders'])

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

function quotingText(quoted: Instrument['quoted']): string {
  const label = holdingsWords.instrumentDialog.quotings[quoted.kind]
  return quoted.kind === 'percent' ? words.proposals.bondQuoting(label, percentText(quoted.coupon), dayLabel(quoted.maturity)) : label
}

/** A field of an instrument or a line of its mix in the holding dialog's words, or undefined for a field shown as it is. */
function holdingValue(kind: RecordKind<unknown>, field: string, record: ProposedRecord, namesOf: ReadonlyMap<unknown, string>): string | null | undefined {
  if (isKind(kind, INSTRUMENT_RECORDS, record)) {
    const shown: Partial<Record<keyof Instrument, string | null>> = {
      type: record.type === null ? null : holdingsWords.types[record.type],
      class: holdingsWords.classes[record.class],
      quoted: quotingText(record.quoted),
      prices: VENDOR_NAMES[record.prices],
      sector: record.sector === null ? null : holdingsWords.sectors[record.sector],
      country: record.country === null ? null : countryText(record.country),
      ter: record.ter === null ? null : percentText(record.ter),
      distribution: record.distribution === null ? null : holdingsWords.distributions[record.distribution],
    }
    return shown[field as keyof Instrument]
  }
  if (isKind(kind, TARGET_RECORDS, record)) {
    const target: Target = record
    const shown: Partial<Record<keyof Target, string>> = { slice: sliceText(target.slice, namesOf), percent: percentText(target.percent) }
    return shown[field as keyof Target]
  }
  if (isKind(kind, FUND_MIX_RECORDS, record)) {
    const line: FundMixLine = record
    const shown: Partial<Record<keyof FundMixLine, string>> = { slice: sliceText(line.slice, namesOf), percent: percentText(line.percent) }
    return shown[field as keyof FundMixLine]
  }
  return undefined
}

/** Whether the record is the 2023 city, which the card names as the Tax screen's card does. */
function isSurtaxCity(kind: RecordKind<unknown>, record: ProposedRecord): record is ProposedRecord & SettingRow {
  return isKind(kind, SETTING_RECORDS, record) && record.key === SURTAX_CITY_2023_KEY
}

/** A field of a check's setting, the mail reader or the 2023 city in the words of the Checks tab, the mail card and the Tax screen, or undefined for a field shown as it is. */
function settingValue(kind: RecordKind<unknown>, field: string, record: ProposedRecord): string | null | undefined {
  if (isSurtaxCity(kind, record)) return field === 'value' ? storedCityText(record.value) : null
  if (isKind(kind, CHECK_RECORDS, record)) {
    const setting: CheckSetting = record
    const shown: Partial<Record<keyof CheckSetting, string | null>> = {
      check: overviewWords.checks.labels[setting.check],
      threshold: setting.threshold === null ? null : thresholdText(setting.check, setting.threshold),
    }
    return shown[field as keyof CheckSetting]
  }
  if (isKind(kind, MAIL_READER_RECORDS, record)) {
    const reader: MailReader = record
    const shown: Partial<Record<keyof MailReader, string | null>> = {
      senders: reader.senders.join(', '),
      leftOut: reader.leftOut.length === 0 ? null : plural(words.proposals.rowsLeftOut(reader.leftOut.length), reader.leftOut.length),
    }
    return shown[field as keyof MailReader]
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
  const ofSetting = settingValue(kind, field, record)
  if (ofSetting !== undefined) return ofSetting
  if (typeof value === 'boolean') return value ? cardWords.yes : cardWords.no
  const day = (field === 'date' || field === 'since') && typeof value === 'string' ? parseCivilDate(value) : null
  if (day !== null) return dayLabel(day)
  return namesOf.get(value) ?? String(value)
}

/** What the record is called on screen: an account or an instrument by its name, a trade by its side and holding, a cash movement or income by its day, kind and amount as the card writes them, a line of a fund's mix by its fund, the 2023 city by its card, and the rest by the write's own words. */
function labelOf(kind: RecordKind<unknown>, record: ProposedRecord, fallback: string, namesOf: ReadonlyMap<unknown, string>): string {
  if (isKind(kind, INVESTMENT_ACCOUNT_RECORDS, record) || isKind(kind, INSTRUMENT_RECORDS, record)) return record.name
  if (isKind(kind, TRADE_RECORDS, record)) return `${recordWords.sides[record.side]} ${namesOf.get(record.instrument) ?? ''}`.trim()
  if (isKind(kind, CASH_MOVEMENT_RECORDS, record)) return [dayLabel(record.date), recordWords.movementKinds[record.kind].toLowerCase(), formatCurrencyAmount(record.amount, record.currency)].join(', ')
  if (isKind(kind, INCOME_RECORDS, record)) return [dayLabel(record.date), recordWords.incomeKinds[record.kind].toLowerCase(), formatCurrencyAmount(record.gross, record.currency)].join(', ')
  if (isKind(kind, FUND_MIX_RECORDS, record)) return namesOf.get(record.instrument) ?? fallback
  if (isKind(kind, TARGET_RECORDS, record)) return sliceText(record.slice, namesOf)
  if (isKind(kind, CHECK_RECORDS, record)) return overviewWords.checks.labels[record.check]
  if (isKind(kind, MAIL_READER_RECORDS, record)) return mailWords.card.title
  if (isSurtaxCity(kind, record)) return taxWords.surtaxCity.title
  return fallback
}

/** What a checked write does, grouped by verb and kind in the order it does it, in Kuna's words and never the model's. Each step's notes sit on the group of its records. */
export function proposalGroupsOf(checked: CheckedWrite, before: InvestmentBook, notes: readonly CardNote[] = []): readonly ProposalGroup[] {
  // A trade or a price of an instrument the same card adds shows in that instrument's currency, and each added record by its name.
  const added = <R>(kind: RecordKind<R>): R[] => checked.changes.flatMap(({ change }) => (change.verb === 'add' && change.kind.name === kind.name ? [change.after as R] : []))
  const book: InvestmentBook = { ...before, accounts: [...before.accounts, ...added(INVESTMENT_ACCOUNT_RECORDS)], instruments: [...before.instruments, ...added(INSTRUMENT_RECORDS)] }
  const namesOf = new Map<unknown, string>([...book.accounts, ...book.instruments].map((record) => [record.id, record.name]))
  const originals: Originals = new WeakMap()
  const comparableWrite: CheckedWrite = { ...checked, changes: checked.changes.map((ruled) => ({ ...ruled, change: comparableChange(ruled.change, originals) })) }
  const original = (record: ProposedRecord): ProposedRecord => originals.get(record) ?? record
  const describer: ProposalDescriber = {
    keptByKuna: KEPT_BY_KUNA,
    fieldName: (field, record) =>
      record['key'] === SURTAX_CITY_2023_KEY && field === 'value'
        ? taxWords.surtaxCity.field
        : (MAIL_FIELD_NAMES[field] ?? (words.proposals.fields as Readonly<Record<string, string>>)[field] ?? field),
    shown: (kind, field, record) => shownValue(kind, field, original(record), book, namesOf),
    label: (kind, record, fallback) => labelOf(kind, original(record), fallback, namesOf),
    defaultsOf: (kind) => (kind.name === INSTRUMENT_RECORDS.name ? NEW_INSTRUMENT_DEFAULTS : kind.name === CHECK_RECORDS.name ? NEW_CHECK_DEFAULTS : {}),
    warns: (kind, field) => kind.name === MAIL_READER_RECORDS.name && WARNS.has(field),
  }
  return withNotes(
    proposalGroups(comparableWrite, () => describer),
    notes,
  )
}
