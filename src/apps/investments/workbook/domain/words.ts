import { CASH_MOVEMENT_KINDS } from './cashMovement'
import type { CashMovementKind } from './cashMovement'
import { INCOME_KINDS } from './income'
import type { IncomeKind } from './income'
import { TRADE_SIDES } from './trade'
import type { TradeSide } from './trade'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { decimalOfText } from '../../../../shared/money/decimal'
import { formatQuantity } from '../../../../shared/money/moneyFormat'
import { dayText, labelWords, labelled } from '../../../../shared/storage/domain/recordCodec'
import { textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredField, StoredFields } from '../../../../shared/storage/domain/storedFields'
import { language } from '../../../../shared/text/language'
import type { Translation } from '../../../../shared/text/translation'

// Croatian addresses the reader as vi, written lowercase inside a sentence. Buttons take the short imperative: Spremi, Poništi, Obriši.
// A field keeps its name as the file stores it, such as source_symbol. English keeps the file's dates and decimals, and Croatian writes them its own way.

/** The most places a label writes a quantity or a price with, as many as the file keeps. */
const LABEL_PLACES = 12

/** A date field as the day Croatian writes, anything else as its text. */
function dayInWords(field: StoredField | undefined): string {
  const day = field?.date ?? null
  return day === null ? textOf(field) : dayLabel(day)
}

/** A decimal field as Croatian writes the number, anything else as its text. */
function decimalInWords(field: StoredField | undefined): string {
  const value = decimalOfText(textOf(field))
  return value === null ? textOf(field) : formatQuantity(value, LABEL_PLACES)
}

/** An amount with its currency, such as `250 USD`, or blank when the amount is blank. */
function amountIn(amount: string, currency: StoredField | undefined): string {
  return amount === '' ? '' : [amount, textOf(currency)].filter((part) => part !== '').join(' ')
}

function isSide(text: string): text is TradeSide {
  return (TRADE_SIDES as readonly string[]).includes(text)
}

function isIncomeKind(text: string): text is IncomeKind {
  return (INCOME_KINDS as readonly string[]).includes(text)
}

function isMovementKind(text: string): text is CashMovementKind {
  return (CASH_MOVEMENT_KINDS as readonly string[]).includes(text)
}

export const en = {
  sides: { buy: 'Buy', sell: 'Sell' },
  incomeKinds: { dividend: 'Dividend', coupon: 'Coupon', interest: 'Interest', other: 'Other income' },
  movementKinds: { deposit: 'Deposit', withdrawal: 'Withdrawal', fee: 'Fee', 'fee-refund': 'Fee refund' },
  /** The words that name a record of each kind, as its stored fields read. */
  labels: {
    trade: (fields: StoredFields) => labelWords([dayText(fields.date), textOf(fields.side), textOf(fields.quantity)]),
    income: (fields: StoredFields) => labelWords([dayText(fields.date), textOf(fields.kind), amountIn(textOf(fields.gross), fields.currency)]),
    cashMovement: (fields: StoredFields) => labelWords([dayText(fields.date), textOf(fields.kind), amountIn(textOf(fields.amount), fields.currency)]),
    exchange: (fields: StoredFields) =>
      labelWords([dayText(fields.date), amountIn(textOf(fields.sold), fields.sold_currency), labelled('into', amountIn(textOf(fields.bought), fields.bought_currency))]),
    transfer: (fields: StoredFields) => labelWords([dayText(fields.date), textOf(fields.quantity), amountIn(textOf(fields.amount), fields.currency)]),
    split: (fields: StoredFields) => labelWords([dayText(fields.date), textOf(fields.new) === '' && textOf(fields.old) === '' ? '' : `${textOf(fields.new)} for ${textOf(fields.old)}`]),
    spinOff: (fields: StoredFields) => labelWords([dayText(fields.date), textOf(fields.quantity)]),
    price: (fields: StoredFields) => labelWords([dayText(fields.date), textOf(fields.price)]),
  },
  notADecimal: (name: string, text: string) => `${name} "${text}" is not a decimal number with at most twelve decimals, such as 12.5`,
  belowZero: (name: string) => `${name} is below zero`,
  notACurrency: (name: string, text: string) => `${name} "${text}" is not a currency code such as USD`,
  rateForEuros: 'rate is filled, but the amount is in EUR',
  noRate: (currency: string) => `no rate, which an amount in ${currency} needs, in ${currency} per EUR`,
  notAnIsin: (text: string) => `isin "${text}" is not an ISIN such as US0378331005`,
  notAnExchange: (text: string) => `exchange "${text}" is not a market identifier code such as XETR`,
  bondFieldsWithout: 'coupon and maturity belong to a bond quoted in percent only',
  sourceSymbolByHand: 'source_symbol is filled, but the prices are entered by hand',
  notAFlag: (name: string, text: string) => `${name} "${text}" is not true or false`,
  withheldOverGross: 'withheld is more than gross',
  instrumentNeeded: (kind: string) => `a ${kind} names its instrument`,
  unitsOrCash: 'a transfer moves either instrument and quantity, or currency and amount',
  sameAccounts: 'from and to are the same account',
  sameCurrencies: 'sold_currency and bought_currency are the same',
  notAWholeNumber: (name: string, text: string) => `${name} "${text}" is not a whole number above zero`,
  noSplit: 'new and old are the same, so nothing splits',
  sameInstruments: 'instrument and received are the same instrument',
  costShareOutside: (text: string) => `cost_share "${text}" is not from 0 to 1`,
  noAccount: (field: string) => `${field} names no investment account in the file`,
  noInstrument: (field: string) => `${field} names no instrument in the file`,
  isinShared: (isin: string) => `another instrument has the ISIN ${isin} too`,
  rateForEuroInstrument: (instrument: string) => `rate is filled, but "${instrument}" is quoted in EUR`,
  noRateForInstrument: (instrument: string, currency: string) => `no rate, which a trade of "${instrument}" in ${currency} needs, in ${currency} per EUR`,
  accruedNotBond: (instrument: string) => `accrued is filled, but "${instrument}" is not a bond quoted in percent`,
  receivedInOtherCurrency: (received: string, currency: string, parentCurrency: string) => `"${received}" is quoted in ${currency}, and its parent in ${parentCurrency}`,
  priceSharesDay: (instrument: string, date: CivilDate) => `another price of "${instrument}" is for ${dayLabel(date)} too`,
}

export const hr: Translation<typeof en> = {
  sides: { buy: 'Kupnja', sell: 'Prodaja' },
  incomeKinds: { dividend: 'Dividenda', coupon: 'Kupon', interest: 'Kamata', other: 'Drugi prihod' },
  movementKinds: { deposit: 'Uplata', withdrawal: 'Isplata', fee: 'Naknada', 'fee-refund': 'Povrat naknade' },
  labels: {
    trade: (fields) => {
      const side = textOf(fields.side)
      return labelWords([dayInWords(fields.date), isSide(side) ? hr.sides[side].toLowerCase() : side, decimalInWords(fields.quantity)])
    },
    income: (fields) => {
      const kind = textOf(fields.kind)
      return labelWords([dayInWords(fields.date), isIncomeKind(kind) ? hr.incomeKinds[kind].toLowerCase() : kind, amountIn(decimalInWords(fields.gross), fields.currency)])
    },
    cashMovement: (fields) => {
      const kind = textOf(fields.kind)
      return labelWords([dayInWords(fields.date), isMovementKind(kind) ? hr.movementKinds[kind].toLowerCase() : kind, amountIn(decimalInWords(fields.amount), fields.currency)])
    },
    exchange: (fields) =>
      labelWords([dayInWords(fields.date), amountIn(decimalInWords(fields.sold), fields.sold_currency), labelled('u', amountIn(decimalInWords(fields.bought), fields.bought_currency))]),
    transfer: (fields) => labelWords([dayInWords(fields.date), decimalInWords(fields.quantity), amountIn(decimalInWords(fields.amount), fields.currency)]),
    split: (fields) => labelWords([dayInWords(fields.date), textOf(fields.new) === '' && textOf(fields.old) === '' ? '' : `${textOf(fields.new)} za ${textOf(fields.old)}`]),
    spinOff: (fields) => labelWords([dayInWords(fields.date), decimalInWords(fields.quantity)]),
    price: (fields) => labelWords([dayInWords(fields.date), decimalInWords(fields.price)]),
  },
  notADecimal: (name, text) => `${name} „${text}” nije decimalni broj s najviše dvanaest decimala, na primjer 12.5`,
  belowZero: (name) => `polje ${name} je manje od nule`,
  notACurrency: (name, text) => `${name} „${text}” nije oznaka valute, na primjer USD`,
  rateForEuros: 'polje rate je popunjeno, a iznos je u EUR',
  noRate: (currency) => `nema polja rate, koje treba iznos u ${currency}, u ${currency} za 1 EUR`,
  notAnIsin: (text) => `isin „${text}” nije ISIN, na primjer US0378331005`,
  notAnExchange: (text) => `exchange „${text}” nije oznaka tržišta (MIC), na primjer XETR`,
  bondFieldsWithout: 'coupon i maturity pripadaju samo obveznici koja kotira u postotku',
  sourceSymbolByHand: 'polje source_symbol je popunjeno, a cijene se unose ručno',
  notAFlag: (name, text) => `${name} „${text}” nije true ni false`,
  withheldOverGross: 'withheld je veći od gross',
  instrumentNeeded: (kind) => `${isIncomeKind(kind) ? hr.incomeKinds[kind] : kind} navodi svoj instrument`,
  unitsOrCash: 'prijenos prenosi ili instrument i quantity ili currency i amount',
  sameAccounts: 'from i to su isti račun',
  sameCurrencies: 'sold_currency i bought_currency su iste',
  notAWholeNumber: (name, text) => `${name} „${text}” nije cijeli broj veći od nule`,
  noSplit: 'new i old su isti, pa se ništa ne dijeli',
  sameInstruments: 'instrument i received su isti instrument',
  costShareOutside: (text) => `cost_share „${text}” nije između 0 i 1`,
  noAccount: (field) => `u datoteci nema investicijskog računa koji navodi polje ${field}`,
  noInstrument: (field) => `u datoteci nema instrumenta koji navodi polje ${field}`,
  isinShared: (isin) => `i drugi instrument ima ISIN ${isin}`,
  rateForEuroInstrument: (instrument) => `polje rate je popunjeno, a „${instrument}” kotira u EUR`,
  noRateForInstrument: (instrument, currency) => `nema polja rate, koje treba transakcija instrumenta „${instrument}” u ${currency}, u ${currency} za 1 EUR`,
  accruedNotBond: (instrument) => `polje accrued je popunjeno, a „${instrument}” nije obveznica koja kotira u postotku`,
  receivedInOtherCurrency: (received, currency, parentCurrency) => `„${received}” kotira u ${currency}, a matični instrument u ${parentCurrency}`,
  priceSharesDay: (instrument, date) => `i druga cijena instrumenta „${instrument}” je za ${dayLabel(date)}`,
}

export const words = language === 'hr' ? hr : en
