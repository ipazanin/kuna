import type { TransactionKind, TransactionRecord } from '../domain/listedTransactions'
import type { RateBook } from '../../prices/domain/rateBook'
import type { CashMovementKind } from '../../workbook/domain/cashMovement'
import type { IncomeKind } from '../../workbook/domain/income'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { CASH_MOVEMENT_RECORDS, EXCHANGE_RECORDS, INCOME_RECORDS, PRICE_RECORDS, SPIN_OFF_RECORDS, SPLIT_RECORDS, TRADE_RECORDS, TRANSFER_RECORDS } from '../../workbook/domain/investmentKinds'
import { words } from './words'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO, currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, decimalOfMoney, decimalOfText, decimalText, scaledDecimal, timesDecimal, typedDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { amountShown } from '../../../../shared/money/amountTyping'
import { AMOUNT_SEPARATORS, typedAmount } from '../../../../shared/money/typedAmount'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { language } from '../../../../shared/text/language'

/** What happened, as the dialog offers it. Each names one kind of record, and a kind with a direction names it too. */
export const HAPPENINGS = ['buy', 'sell', 'income', 'deposit', 'withdrawal', 'fee', 'fee-refund', 'exchange', 'transfer', 'split', 'spin-off', 'price'] as const

export type Happening = (typeof HAPPENINGS)[number]

const KIND_OF: Readonly<Record<Happening, TransactionKind>> = {
  buy: 'trade',
  sell: 'trade',
  income: 'income',
  deposit: 'cash-movement',
  withdrawal: 'cash-movement',
  fee: 'cash-movement',
  'fee-refund': 'cash-movement',
  exchange: 'exchange',
  transfer: 'transfer',
  split: 'split',
  'spin-off': 'spin-off',
  price: 'price',
}

export function kindOfHappening(happened: Happening): TransactionKind {
  return KIND_OF[happened]
}

/** The happenings a record can change to: a buy into a sale and back, a deposit into a fee, and every other kind only into itself. */
export function happeningsOfKind(kind: TransactionKind): Happening[] {
  return HAPPENINGS.filter((happened) => KIND_OF[happened] === kind)
}

const RECORDS_OF: Readonly<Record<TransactionKind, RecordKind>> = {
  trade: TRADE_RECORDS,
  income: INCOME_RECORDS,
  'cash-movement': CASH_MOVEMENT_RECORDS,
  exchange: EXCHANGE_RECORDS,
  transfer: TRANSFER_RECORDS,
  split: SPLIT_RECORDS,
  'spin-off': SPIN_OFF_RECORDS,
  price: PRICE_RECORDS,
}

/** The key a record's id was made from, which its draft keeps so a change writes the same record. */
export function keyOf(entry: TransactionRecord): string {
  return keyOfRecordId(RECORDS_OF[entry.kind], entry.record.id)
}

export function happeningOf(entry: TransactionRecord): Happening {
  switch (entry.kind) {
    case 'trade':
      return entry.record.side
    case 'cash-movement':
      return entry.record.kind
    default:
      return entry.kind
  }
}

/** The dialog's fields as typed. Records are named by their ids, blank for none. */
export interface TransactionTexts {
  happened: Happening
  account: string
  toAccount: string
  instrument: string
  received: string
  date: string
  quantity: string
  price: string
  fees: string
  rate: string
  incomeKind: IncomeKind
  currency: string
  amount: string
  withheld: string
  bought: string
  boughtCurrency: string
  feeCurrency: string
  moves: 'units' | 'cash'
  newUnits: string
  oldUnits: string
  costShare: string
  note: string
}

export type TransactionErrors = Partial<Record<keyof TransactionTexts, string>>

/** Where a new transaction starts: what happened and the holding, such as a buy of the holding whose page it opens from. */
export interface TransactionStart {
  readonly happened: Happening
  readonly instrument: RecordId | null
  readonly today: CivilDate
}

const DECIMAL_MARK = AMOUNT_SEPARATORS[language].decimal

/** A decimal as the field shows it, with the language's decimal mark. */
function decimalShown(value: Decimal | null): string {
  return value === null ? '' : decimalText(value).replace('.', DECIMAL_MARK)
}

/** A stored amount as a money field shows it, so the field and what `typedAmount` reads agree. */
function amountText(value: Decimal): string {
  return amountShown(decimalText(value))
}

/** A spin-off's cost share is typed in percent and stored as a fraction. */
const PERCENT = 100n
const PERCENT_DECIMAL = decimalOfText('100')!

/** The texts of a new transaction, or of the record the dialog changes. */
export function textsOf(entry: TransactionRecord | null, start: TransactionStart, book: InvestmentBook): TransactionTexts {
  const instrument = start.instrument === null ? null : (book.instruments.find((candidate) => candidate.id === start.instrument) ?? null)
  const blank: TransactionTexts = {
    happened: start.happened,
    account: book.accounts.length === 1 ? book.accounts[0]!.id : '',
    toAccount: '',
    instrument: instrument?.id ?? '',
    received: '',
    date: start.today,
    quantity: '',
    price: '',
    fees: '',
    rate: '',
    incomeKind: 'dividend',
    currency: instrument?.currency ?? EURO,
    amount: '',
    withheld: '',
    bought: '',
    boughtCurrency: 'USD',
    feeCurrency: EURO,
    moves: 'units',
    newUnits: '',
    oldUnits: '',
    costShare: '',
    note: '',
  }
  if (entry === null) return blank
  const base = { ...blank, happened: happeningOf(entry), date: entry.record.date, note: entry.record.note }
  switch (entry.kind) {
    case 'trade': {
      const trade = entry.record
      const fees = trade.fees === null ? '' : amountText(trade.fees)
      return { ...base, account: trade.account, instrument: trade.instrument, quantity: decimalShown(trade.quantity), price: decimalShown(trade.price), fees, rate: decimalShown(trade.rate) }
    }
    case 'income': {
      const payment = entry.record
      return {
        ...base,
        account: payment.account,
        instrument: payment.instrument ?? '',
        incomeKind: payment.kind,
        currency: payment.currency,
        amount: amountText(payment.gross),
        withheld: amountText(payment.withheld),
        rate: decimalShown(payment.rate),
      }
    }
    case 'cash-movement': {
      const movement = entry.record
      return { ...base, account: movement.account, currency: movement.currency, amount: amountText(movement.amount), rate: decimalShown(movement.rate) }
    }
    case 'exchange': {
      const exchange = entry.record
      return {
        ...base,
        account: exchange.account,
        amount: amountText(exchange.sold),
        currency: exchange.soldCurrency,
        bought: amountText(exchange.bought),
        boughtCurrency: exchange.boughtCurrency,
        fees: exchange.fees === null ? '' : amountText(exchange.fees.amount),
        feeCurrency: exchange.fees?.currency ?? EURO,
      }
    }
    case 'transfer': {
      const transfer = entry.record
      const { moved } = transfer
      return {
        ...base,
        account: transfer.from,
        toAccount: transfer.to,
        moves: moved.kind,
        ...(moved.kind === 'units' ? { instrument: moved.instrument, quantity: decimalShown(moved.quantity) } : { currency: moved.currency, amount: amountText(moved.amount) }),
      }
    }
    case 'split':
      return { ...base, instrument: entry.record.instrument, newUnits: String(entry.record.newUnits), oldUnits: String(entry.record.oldUnits) }
    case 'spin-off': {
      const spinOff = entry.record
      return {
        ...base,
        instrument: spinOff.instrument,
        received: spinOff.received,
        quantity: decimalShown(spinOff.quantity),
        costShare: decimalShown(timesDecimal(spinOff.costShare, PERCENT_DECIMAL)),
      }
    }
    case 'price':
      return { ...base, instrument: entry.record.instrument, price: decimalShown(entry.record.price) }
  }
}

/** The currency the record's rate is in, null for a kind without a rate or one in euros. */
export function rateCurrency(texts: TransactionTexts, book: InvestmentBook): CurrencyCode | null {
  const kind = KIND_OF[texts.happened]
  const currency =
    kind === 'trade'
      ? (book.instruments.find((instrument) => instrument.id === texts.instrument)?.currency ?? null)
      : kind === 'income' || kind === 'cash-movement'
        ? currencyCodeOf(texts.currency)
        : null
  return currency === null || currency === EURO ? null : currency
}

/** The ECB rate of the day or the last day before it, as the rate field shows it, or blank before the series has one. */
export function ecbRateText(rates: RateBook | null, currency: CurrencyCode | null, dateText: string): string {
  const day = parseCivilDate(dateText)
  const rate = rates === null || currency === null || day === null ? null : rates.unitsPerEuroOnOrBefore(currency, day)
  return decimalShown(rate)
}

/** The fields' errors and, when there are none, the record they make with the id given. */
export interface TransactionDraft {
  readonly errors: TransactionErrors
  readonly record: TransactionRecord | null
}

const EXAMPLE_DAY = civilDate(2026, 10, 12)

/** An amount typed into a money field as an exact decimal, null for anything that is not one. */
function amountOf(text: string): Decimal | null {
  const cents = typedAmount(text)
  return cents === null ? null : decimalOfMoney(cents)
}

function positiveAmount(text: string): Decimal | null {
  const amount = amountOf(text)
  return amount !== null && amount > DECIMAL_ZERO ? amount : null
}

function positiveDecimal(text: string): Decimal | null {
  const value = typedDecimal(text)
  return value !== null && value > DECIMAL_ZERO ? value : null
}

function wholeNumber(text: string): number | null {
  const trimmed = text.trim()
  return /^\d{1,6}$/.test(trimmed) && Number(trimmed) > 0 ? Number(trimmed) : null
}

/** Reads the texts of the happening into its record, keyed by `key`, or says what is wrong with each field. */
export function transactionDraft(texts: TransactionTexts, book: InvestmentBook, key: string): TransactionDraft {
  const errors: TransactionErrors = {}
  const fail = <T>(field: keyof TransactionTexts, message: string): T | null => {
    errors[field] = message
    return null
  }
  const date = parseCivilDate(texts.date) ?? fail<CivilDate>('date', words.errors.date(EXAMPLE_DAY))
  const accountOf = (field: 'account' | 'toAccount'): RecordId | null => book.accounts.find((account) => account.id === texts[field])?.id ?? fail<RecordId>(field, words.errors.account)
  const instrumentOf = (field: 'instrument' | 'received'): Instrument | null => book.instruments.find((instrument) => instrument.id === texts[field]) ?? fail<Instrument>(field, words.errors.holding)
  const currencyOf = (field: 'currency' | 'boughtCurrency' | 'feeCurrency'): CurrencyCode | null => currencyCodeOf(texts[field]) ?? fail<CurrencyCode>(field, words.errors.currency)
  const rateFor = (currency: CurrencyCode | null): Decimal | null => (currency === null || currency === EURO ? null : (positiveDecimal(texts.rate) ?? fail<Decimal>('rate', words.errors.rate)))
  const note = texts.note.trim()
  const done = (record: TransactionRecord): TransactionDraft => ({ errors, record: Object.keys(errors).length === 0 ? record : null })

  switch (texts.happened) {
    case 'buy':
    case 'sell': {
      const account = accountOf('account')
      const instrument = instrumentOf('instrument')
      const quantity = positiveDecimal(texts.quantity) ?? fail<Decimal>('quantity', words.errors.units)
      const price = typedDecimal(texts.price) ?? fail<Decimal>('price', words.errors.price)
      const fees = texts.fees.trim() === '' ? null : (amountOf(texts.fees) ?? fail<Decimal>('fees', words.errors.fees))
      const rate = rateFor(instrument?.currency ?? null)
      if (account === null || instrument === null || date === null || quantity === null || price === null) return { errors, record: null }
      return done({
        kind: 'trade',
        record: { id: recordIdOf(TRADE_RECORDS, key), account, instrument: instrument.id, side: texts.happened, date, quantity, price, fees, rate, accrued: null, importKey: null, note },
      })
    }
    case 'income': {
      const account = accountOf('account')
      const needsInstrument = texts.incomeKind === 'dividend' || texts.incomeKind === 'coupon'
      const instrument = needsInstrument || texts.instrument !== '' ? instrumentOf('instrument') : null
      const currency = currencyOf('currency')
      const gross = positiveAmount(texts.amount) ?? fail<Decimal>('amount', words.errors.amount)
      const withheldText = texts.withheld.trim() === '' ? '0' : texts.withheld
      const withheld = amountOf(withheldText)
      if (withheld === null || (gross !== null && withheld > gross)) fail('withheld', words.errors.withheld)
      const rate = rateFor(currency)
      if (account === null || date === null || currency === null || gross === null || withheld === null) return { errors, record: null }
      return done({
        kind: 'income',
        record: {
          id: recordIdOf(INCOME_RECORDS, key),
          account,
          kind: texts.incomeKind,
          instrument: instrument?.id ?? null,
          date,
          currency,
          gross,
          withheld,
          rate,
          importKey: null,
          note,
        },
      })
    }
    case 'deposit':
    case 'withdrawal':
    case 'fee':
    case 'fee-refund': {
      const account = accountOf('account')
      const currency = currencyOf('currency')
      const amount = positiveAmount(texts.amount) ?? fail<Decimal>('amount', words.errors.amount)
      const rate = rateFor(currency)
      if (account === null || date === null || currency === null || amount === null) return { errors, record: null }
      const kind: CashMovementKind = texts.happened
      return done({ kind: 'cash-movement', record: { id: recordIdOf(CASH_MOVEMENT_RECORDS, key), account, kind, date, currency, amount, rate, importKey: null, note } })
    }
    case 'exchange': {
      const account = accountOf('account')
      const soldCurrency = currencyOf('currency')
      const sold = positiveAmount(texts.amount) ?? fail<Decimal>('amount', words.errors.amount)
      const boughtCurrency = currencyOf('boughtCurrency')
      if (boughtCurrency !== null && boughtCurrency === soldCurrency) fail('boughtCurrency', words.errors.otherCurrency)
      const bought = positiveAmount(texts.bought) ?? fail<Decimal>('bought', words.errors.amount)
      const feeAmount = texts.fees.trim() === '' ? null : (amountOf(texts.fees) ?? fail<Decimal>('fees', words.errors.fees))
      const feeCurrency = feeAmount === null ? null : currencyOf('feeCurrency')
      if (account === null || date === null || soldCurrency === null || sold === null || boughtCurrency === null || bought === null) return { errors, record: null }
      return done({
        kind: 'exchange',
        record: {
          id: recordIdOf(EXCHANGE_RECORDS, key),
          account,
          date,
          sold,
          soldCurrency,
          bought,
          boughtCurrency,
          fees: feeAmount === null || feeCurrency === null ? null : { amount: feeAmount, currency: feeCurrency },
          importKey: null,
          note,
        },
      })
    }
    case 'transfer': {
      const from = accountOf('account')
      const to = accountOf('toAccount')
      if (from !== null && to === from) fail('toAccount', words.errors.otherAccount)
      const instrument = texts.moves === 'units' ? instrumentOf('instrument') : null
      const quantity = texts.moves === 'units' ? (positiveDecimal(texts.quantity) ?? fail<Decimal>('quantity', words.errors.units)) : null
      const currency = texts.moves === 'cash' ? currencyOf('currency') : null
      const amount = texts.moves === 'cash' ? (positiveAmount(texts.amount) ?? fail<Decimal>('amount', words.errors.amount)) : null
      if (from === null || to === null || date === null) return { errors, record: null }
      const moved =
        instrument !== null && quantity !== null
          ? { kind: 'units' as const, instrument: instrument.id, quantity }
          : currency !== null && amount !== null
            ? { kind: 'cash' as const, currency, amount }
            : null
      return moved === null ? { errors, record: null } : done({ kind: 'transfer', record: { id: recordIdOf(TRANSFER_RECORDS, key), from, to, date, moved, importKey: null, note } })
    }
    case 'split': {
      const instrument = instrumentOf('instrument')
      const newUnits = wholeNumber(texts.newUnits) ?? fail<number>('newUnits', words.errors.wholeNumber)
      const oldUnits = wholeNumber(texts.oldUnits) ?? fail<number>('oldUnits', words.errors.wholeNumber)
      if (newUnits !== null && newUnits === oldUnits) fail('oldUnits', words.errors.sameUnits)
      if (instrument === null || date === null || newUnits === null || oldUnits === null) return { errors, record: null }
      return done({ kind: 'split', record: { id: recordIdOf(SPLIT_RECORDS, key), instrument: instrument.id, date, newUnits, oldUnits, importKey: null, note } })
    }
    case 'spin-off': {
      const parent = instrumentOf('instrument')
      const received = instrumentOf('received')
      if (parent !== null && received !== null && received.id === parent.id) fail('received', words.errors.otherHolding)
      else if (parent !== null && received !== null && received.currency !== parent.currency) fail('received', words.errors.receivedCurrency(parent.currency))
      const quantity = positiveDecimal(texts.quantity) ?? fail<Decimal>('quantity', words.errors.units)
      const percent = typedDecimal(texts.costShare)
      const costShare = percent === null || percent > PERCENT_DECIMAL ? fail<Decimal>('costShare', words.errors.share) : scaledDecimal(percent, 1n, PERCENT)
      if (parent === null || received === null || date === null || quantity === null || costShare === null) return { errors, record: null }
      return done({ kind: 'spin-off', record: { id: recordIdOf(SPIN_OFF_RECORDS, key), instrument: parent.id, received: received.id, date, quantity, costShare, importKey: null, note } })
    }
    case 'price': {
      const instrument = instrumentOf('instrument')
      const price = positiveDecimal(texts.price) ?? fail<Decimal>('price', words.errors.handPrice)
      if (instrument === null || date === null || price === null) return { errors, record: null }
      return done({ kind: 'price', record: { id: recordIdOf(PRICE_RECORDS, key), instrument: instrument.id, date, price, note } })
    }
  }
}
