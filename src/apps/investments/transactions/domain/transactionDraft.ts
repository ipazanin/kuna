import type { TransactionKind, TransactionRecord } from './listedTransactions'
import { accountSources, landingRecordOf, landsAnew, mailOwned } from '../../imports/domain/accountIntake'
import { bookedWorth, brokerWorthFarOff, brokerWorthKept } from '../../holdings/domain/lots'
import type { RateBook } from '../../../../shared/money/rateBook'
import type { CashMovementKind } from '../../workbook/domain/cashMovement'
import type { IncomeKind } from '../../workbook/domain/income'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { CASH_MOVEMENT_RECORDS, EXCHANGE_RECORDS, INCOME_RECORDS, PRICE_RECORDS, SPIN_OFF_RECORDS, SPLIT_RECORDS, TRADE_RECORDS, TRANSFER_RECORDS } from '../../workbook/domain/investmentKinds'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO, currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, decimalOfMoney, decimalOfText, decimalShown, decimalText, magnitude, negateDecimal, scaledDecimal, timesDecimal, typedDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { amountShown } from '../../../../shared/money/amountTyping'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'

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

/** The import keys of the record changed, none for a new one or a hand price, which has none. */
export function importKeysOf(entry: TransactionRecord | null): readonly string[] {
  return entry === null || entry.kind === 'price' ? [] : entry.record.importKeys
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
  /** What the broker booked for a trade's units at its price, blank when it booked units × price to the cent. */
  brokerWorth: string
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
  /** An income that reverses an earlier payment, whose amounts are shown above zero and stored below. */
  reverses: boolean
}

/** What can be wrong with a field on its own, named for the sentence the dialog shows under it. */
type PlainFault =
  | 'holding'
  | 'account'
  | 'otherAccount'
  | 'date'
  | 'units'
  | 'price'
  | 'brokerWorth'
  | 'handPrice'
  | 'amount'
  | 'fees'
  | 'withheld'
  | 'reversalNote'
  | 'rate'
  | 'currency'
  | 'otherCurrency'
  | 'wholeNumber'
  | 'sameUnits'
  | 'share'
  | 'otherHolding'

/** What is wrong with one field. A spin-off's received holding quoted in another currency names the parent's currency, and a day the mail fills names the account and its start day. */
export type TransactionFault = { readonly kind: PlainFault } | { readonly kind: 'receivedCurrency'; readonly currency: CurrencyCode } | { readonly kind: 'mailOwns'; readonly account: string }

export type TransactionFaults = Partial<Record<keyof TransactionTexts, TransactionFault>>

/** Where a new transaction starts: what happened and the holding, such as a buy of the holding whose page it opens from. */
export interface TransactionStart {
  readonly happened: Happening
  readonly instrument: RecordId | null
  readonly today: CivilDate
  /** Fields a row of a report fills, such as the units and price of a trade it asked about. */
  readonly texts?: Partial<TransactionTexts>
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
    brokerWorth: '',
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
    reverses: false,
  }
  if (entry === null) return { ...blank, ...start.texts }
  const base = { ...blank, happened: happeningOf(entry), date: entry.record.date, note: entry.record.note }
  switch (entry.kind) {
    case 'trade': {
      const trade = entry.record
      const fees = trade.fees === null ? '' : amountText(trade.fees)
      const brokerWorth = decimalShown(trade.brokerWorth ?? null)
      return {
        ...base,
        account: trade.account,
        instrument: trade.instrument,
        quantity: decimalShown(trade.quantity),
        price: decimalShown(trade.price),
        brokerWorth,
        fees,
        rate: decimalShown(trade.rate),
      }
    }
    case 'income': {
      const payment = entry.record
      return {
        ...base,
        account: payment.account,
        instrument: payment.instrument ?? '',
        incomeKind: payment.kind,
        currency: payment.currency,
        amount: amountText(magnitude(payment.gross)),
        withheld: amountText(magnitude(payment.withheld)),
        rate: decimalShown(payment.rate),
        reverses: payment.gross < DECIMAL_ZERO,
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

/** What the trade dialog says beside the broker's worth. */
export interface BrokerWorthCheck {
  /** The worth Kuna books from units × price to the cent, null while the holding, units or price cannot be read. */
  readonly booked: Decimal | null
  /** Whether the worth typed is more than a cent per unit away from units × price. */
  readonly farOff: boolean
}

export function brokerWorthCheck(texts: TransactionTexts, book: InvestmentBook): BrokerWorthCheck {
  const instrument = book.instruments.find((candidate) => candidate.id === texts.instrument)
  const quantity = positiveDecimal(texts.quantity)
  const price = typedDecimal(texts.price)
  if (instrument === undefined || quantity === null || price === null) return { booked: null, farOff: false }
  const worth = positiveDecimal(texts.brokerWorth)
  return { booked: bookedWorth(instrument.quoted, quantity, price), farOff: worth !== null && brokerWorthFarOff(instrument.quoted, quantity, price, worth) }
}

/** What is wrong with each field and, when nothing is, the record the fields make with the id given. */
export interface TransactionDraft {
  readonly faults: TransactionFaults
  readonly record: TransactionRecord | null
}

/**
 * An amount in a money field as an exact decimal, null for anything that is not one. An amount finer than a cent, such
 * as a broker's commission, which the field shows at its stored scale, is kept as it is.
 */
function amountOf(text: string): Decimal | null {
  const cents = typedAmount(text)
  return cents !== null ? decimalOfMoney(cents) : typedDecimal(text)
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

/**
 * The account the record by hand would land on anew, added or moved there, on a day it takes from another source, or null. A fix that keeps the
 * record's account and day is allowed, and a record of a report keeps its key, so it stays the mail's own.
 */
function mailOwnedFault(record: TransactionRecord, book: InvestmentBook, importKeys: readonly string[]): TransactionFault | null {
  if (record.kind === 'split' || record.kind === 'spin-off' || record.kind === 'price') return null
  const before = landingRecordOf(book, record.record.id)
  const landing = { id: record.record.id, accounts: record.kind === 'transfer' ? [record.record.from, record.record.to] : [record.record.account], date: record.record.date, importKeys }
  const owned = landsAnew(before, landing) ? mailOwned(accountSources(book), landing) : null
  return owned === null ? null : { kind: 'mailOwns', account: book.accounts.find((account) => account.id === owned)?.name ?? '' }
}

/**
 * Reads the texts of the happening into its record, keyed by `key`, or says what is wrong with each field. `importKeys`
 * are the keys of the record changed, or of the question of a report a new record books, which the record keeps.
 */
export function transactionDraft(texts: TransactionTexts, book: InvestmentBook, key: string, importKeys: readonly string[] = []): TransactionDraft {
  const faults: TransactionFaults = {}
  const fail = <T>(field: keyof TransactionTexts, fault: PlainFault | TransactionFault): T | null => {
    faults[field] = typeof fault === 'string' ? { kind: fault } : fault
    return null
  }
  const date = parseCivilDate(texts.date) ?? fail<CivilDate>('date', 'date')
  const accountOf = (field: 'account' | 'toAccount'): RecordId | null => book.accounts.find((account) => account.id === texts[field])?.id ?? fail<RecordId>(field, 'account')
  const instrumentOf = (field: 'instrument' | 'received'): Instrument | null => book.instruments.find((instrument) => instrument.id === texts[field]) ?? fail<Instrument>(field, 'holding')
  const currencyOf = (field: 'currency' | 'boughtCurrency' | 'feeCurrency'): CurrencyCode | null => currencyCodeOf(texts[field]) ?? fail<CurrencyCode>(field, 'currency')
  const rateFor = (currency: CurrencyCode | null): Decimal | null => (currency === null || currency === EURO ? null : (positiveDecimal(texts.rate) ?? fail<Decimal>('rate', 'rate')))
  const note = texts.note.trim()
  const done = (drafted: TransactionRecord): TransactionDraft => {
    // A record keeps the keys it is drafted with, such as a booked question's, so the question it answers goes.
    const record = drafted.kind === 'price' ? drafted : ({ kind: drafted.kind, record: { ...drafted.record, importKeys } } as TransactionRecord)
    const owned = mailOwnedFault(record, book, importKeys)
    if (owned !== null) faults.account = owned
    return { faults, record: Object.keys(faults).length === 0 ? record : null }
  }

  switch (texts.happened) {
    case 'buy':
    case 'sell': {
      const account = accountOf('account')
      const instrument = instrumentOf('instrument')
      const quantity = positiveDecimal(texts.quantity) ?? fail<Decimal>('quantity', 'units')
      const price = typedDecimal(texts.price) ?? fail<Decimal>('price', 'price')
      const typedWorth = texts.brokerWorth.trim() === '' ? null : (positiveDecimal(texts.brokerWorth) ?? fail<Decimal>('brokerWorth', 'brokerWorth'))
      const fees = texts.fees.trim() === '' ? null : (amountOf(texts.fees) ?? fail<Decimal>('fees', 'fees'))
      const rate = rateFor(instrument?.currency ?? null)
      if (account === null || instrument === null || date === null || quantity === null || price === null) return { faults, record: null }
      const brokerWorth = brokerWorthKept(instrument.quoted, quantity, price, typedWorth)
      return done({
        kind: 'trade',
        record: {
          id: recordIdOf(TRADE_RECORDS, key),
          account,
          instrument: instrument.id,
          side: texts.happened,
          date,
          quantity,
          price,
          ...(brokerWorth === undefined ? {} : { brokerWorth }),
          fees,
          rate,
          accrued: null,
          importKeys: [],
          note,
        },
      })
    }
    case 'income': {
      const account = accountOf('account')
      const needsInstrument = texts.incomeKind === 'dividend' || texts.incomeKind === 'coupon'
      const instrument = needsInstrument || texts.instrument !== '' ? instrumentOf('instrument') : null
      const currency = currencyOf('currency')
      const gross = positiveAmount(texts.amount) ?? fail<Decimal>('amount', 'amount')
      const withheldText = texts.withheld.trim() === '' ? '0' : texts.withheld
      const withheld = amountOf(withheldText)
      if (withheld === null || (gross !== null && withheld > gross)) fail('withheld', 'withheld')
      if (texts.reverses && note === '') fail('note', 'reversalNote')
      const rate = rateFor(currency)
      if (account === null || date === null || currency === null || gross === null || withheld === null) return { faults, record: null }
      return done({
        kind: 'income',
        record: {
          id: recordIdOf(INCOME_RECORDS, key),
          account,
          kind: texts.incomeKind,
          instrument: instrument?.id ?? null,
          date,
          currency,
          gross: texts.reverses ? negateDecimal(gross) : gross,
          withheld: texts.reverses ? negateDecimal(withheld) : withheld,
          rate,
          importKeys: [],
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
      const amount = positiveAmount(texts.amount) ?? fail<Decimal>('amount', 'amount')
      const rate = rateFor(currency)
      if (account === null || date === null || currency === null || amount === null) return { faults, record: null }
      const kind: CashMovementKind = texts.happened
      return done({ kind: 'cash-movement', record: { id: recordIdOf(CASH_MOVEMENT_RECORDS, key), account, kind, date, currency, amount, rate, importKeys: [], note } })
    }
    case 'exchange': {
      const account = accountOf('account')
      const soldCurrency = currencyOf('currency')
      const sold = positiveAmount(texts.amount) ?? fail<Decimal>('amount', 'amount')
      const boughtCurrency = currencyOf('boughtCurrency')
      if (boughtCurrency !== null && boughtCurrency === soldCurrency) fail('boughtCurrency', 'otherCurrency')
      const bought = positiveAmount(texts.bought) ?? fail<Decimal>('bought', 'amount')
      const feeAmount = texts.fees.trim() === '' ? null : (amountOf(texts.fees) ?? fail<Decimal>('fees', 'fees'))
      const feeCurrency = feeAmount === null ? null : currencyOf('feeCurrency')
      if (account === null || date === null || soldCurrency === null || sold === null || boughtCurrency === null || bought === null) return { faults, record: null }
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
          importKeys: [],
          note,
        },
      })
    }
    case 'transfer': {
      const from = accountOf('account')
      const to = accountOf('toAccount')
      if (from !== null && to === from) fail('toAccount', 'otherAccount')
      const instrument = texts.moves === 'units' ? instrumentOf('instrument') : null
      const quantity = texts.moves === 'units' ? (positiveDecimal(texts.quantity) ?? fail<Decimal>('quantity', 'units')) : null
      const currency = texts.moves === 'cash' ? currencyOf('currency') : null
      const amount = texts.moves === 'cash' ? (positiveAmount(texts.amount) ?? fail<Decimal>('amount', 'amount')) : null
      if (from === null || to === null || date === null) return { faults, record: null }
      const moved =
        instrument !== null && quantity !== null
          ? { kind: 'units' as const, instrument: instrument.id, quantity }
          : currency !== null && amount !== null
            ? { kind: 'cash' as const, currency, amount }
            : null
      return moved === null ? { faults, record: null } : done({ kind: 'transfer', record: { id: recordIdOf(TRANSFER_RECORDS, key), from, to, date, moved, importKeys: [], note } })
    }
    case 'split': {
      const instrument = instrumentOf('instrument')
      const newUnits = wholeNumber(texts.newUnits) ?? fail<number>('newUnits', 'wholeNumber')
      const oldUnits = wholeNumber(texts.oldUnits) ?? fail<number>('oldUnits', 'wholeNumber')
      if (newUnits !== null && newUnits === oldUnits) fail('oldUnits', 'sameUnits')
      if (instrument === null || date === null || newUnits === null || oldUnits === null) return { faults, record: null }
      return done({ kind: 'split', record: { id: recordIdOf(SPLIT_RECORDS, key), instrument: instrument.id, date, newUnits, oldUnits, importKeys: [], note } })
    }
    case 'spin-off': {
      const parent = instrumentOf('instrument')
      const received = instrumentOf('received')
      if (parent !== null && received !== null && received.id === parent.id) fail('received', 'otherHolding')
      else if (parent !== null && received !== null && received.currency !== parent.currency) fail('received', { kind: 'receivedCurrency', currency: parent.currency })
      const quantity = positiveDecimal(texts.quantity) ?? fail<Decimal>('quantity', 'units')
      const percent = typedDecimal(texts.costShare)
      const costShare = percent === null || percent > PERCENT_DECIMAL ? fail<Decimal>('costShare', 'share') : scaledDecimal(percent, 1n, PERCENT)
      if (parent === null || received === null || date === null || quantity === null || costShare === null) return { faults, record: null }
      return done({ kind: 'spin-off', record: { id: recordIdOf(SPIN_OFF_RECORDS, key), instrument: parent.id, received: received.id, date, quantity, costShare, importKeys: [], note } })
    }
    case 'price': {
      const instrument = instrumentOf('instrument')
      const price = positiveDecimal(texts.price) ?? fail<Decimal>('price', 'handPrice')
      if (instrument === null || date === null || price === null) return { faults, record: null }
      return done({ kind: 'price', record: { id: recordIdOf(PRICE_RECORDS, key), instrument: instrument.id, date, price, note } })
    }
  }
}
