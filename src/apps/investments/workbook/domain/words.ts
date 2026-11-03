import { CASH_MOVEMENT_KINDS } from './cashMovement'
import type { CashMovementKind } from './cashMovement'
import { INCOME_KINDS } from './income'
import type { IncomeKind } from './income'
import { MIXES } from './mixGroup'
import type { Mix } from './mixGroup'
import { TRADE_SIDES } from './trade'
import type { TradeSide } from './trade'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { decimalOfText, decimalText } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
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

/** A percent field with its sign, or blank when the field is blank. */
function percentIn(percent: string, sign: string): string {
  return percent === '' ? '' : `${percent}${sign}`
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

function isMix(text: string): text is Mix {
  return (MIXES as readonly string[]).includes(text)
}

/** The group of a share's label. An account's is its bare UUID, which says nothing to a reader, so it is left out. */
function groupInLabel(fields: StoredFields): string {
  return textOf(fields.mix) === 'account' ? '' : textOf(fields.group)
}

export const en = {
  sides: { buy: 'Buy', sell: 'Sell' },
  incomeKinds: { dividend: 'Dividend', coupon: 'Coupon', interest: 'Interest', other: 'Other income' },
  movementKinds: { deposit: 'Deposit', withdrawal: 'Withdrawal', fee: 'Fee', 'fee-refund': 'Fee refund' },
  mixes: { sector: 'sector', currency: 'currency', country: 'country', class: 'class', account: 'account' } satisfies Record<Mix, string>,
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
    /** A line of a fund's mix or a target, by its mix, its group and its percent. */
    share: (fields: StoredFields) => labelWords([textOf(fields.mix), groupInLabel(fields), percentIn(textOf(fields.percent), '%')]),
  },
  notADecimal: (name: string, text: string) => `${name} "${text}" is not a decimal number with at most twelve decimals, such as 12.5`,
  belowZero: (name: string) => `${name} is below zero`,
  notACurrency: (name: string, text: string) => `${name} "${text}" is not a currency code such as USD`,
  rateForEuros: 'rate is filled, but the amount is in EUR',
  noRate: (currency: string) => `no rate, which an amount in ${currency} needs, in ${currency} per EUR`,
  notAnIsin: (text: string) => `isin "${text}" is not an ISIN such as US0378331005`,
  notAnExchange: (text: string) => `exchange "${text}" is not a market identifier code such as XETR`,
  bondFieldsWithout: 'coupon and maturity belong to a bond quoted in percent only',
  typeOfOtherClass: (type: string, instrumentClass: string) => `type ${type} holds class ${instrumentClass} only`,
  quotingOfOtherType: (quoted: string, type: string) => `quoted ${quoted} belongs to type ${type} only`,
  distributionOfFundOnly: 'distribution belongs to type fund only',
  sourceSymbolByHand: 'source_symbol is filled, but the prices are entered by hand',
  notAFlag: (name: string, text: string) => `${name} "${text}" is not true or false`,
  withheldOverGross: 'withheld is more than gross',
  reversalWithoutNote: 'gross is below zero, which only a reversal with a note saying so may be',
  withheldAgainstGross: 'withheld is above zero while gross is below',
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
  overHundred: (name: string) => `${name} is more than 100`,
  notACountry: (name: string, text: string) => `${name} "${text}" is not a country code such as US, or a region: world, europe, north-america, asia-pacific, emerging-markets`,
  fundMixNotWhole: (instrument: string, mix: string, sum: Decimal) => `the lines of "${instrument}" by ${mix} add up to ${decimalText(sum)}%, not 100%`,
  fundMixGroupShared: (instrument: string, group: string) => `another line of "${instrument}" is for ${group} too`,
  targetsNotWhole: (mix: string, sum: Decimal) => `the targets by ${mix} add up to ${decimalText(sum)}%, not 100%`,
  targetGroupShared: (group: string) => `another target is for ${group} too`,
  checkShared: (check: string) => `another record changes the ${check} check too`,
  checkChangesNothing: 'threshold is blank or the default, and off is not true, so it changes nothing',
}

export const hr: Translation<typeof en> = {
  sides: { buy: 'Kupnja', sell: 'Prodaja' },
  incomeKinds: { dividend: 'Dividenda', coupon: 'Kupon', interest: 'Kamata', other: 'Drugi prihod' },
  movementKinds: { deposit: 'Uplata', withdrawal: 'Isplata', fee: 'Naknada', 'fee-refund': 'Povrat naknade' },
  mixes: { sector: 'sektor', currency: 'valuta', country: 'država', class: 'klasa', account: 'račun' },
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
    share: (fields) => {
      const mix = textOf(fields.mix)
      return labelWords([isMix(mix) ? hr.mixes[mix] : mix, groupInLabel(fields), percentIn(decimalInWords(fields.percent), '\u00a0%')])
    },
  },
  notADecimal: (name, text) => `${name} „${text}” nije decimalni broj s najviše dvanaest decimala, na primjer 12.5`,
  belowZero: (name) => `polje ${name} je manje od nule`,
  notACurrency: (name, text) => `${name} „${text}” nije oznaka valute, na primjer USD`,
  rateForEuros: 'polje rate je popunjeno, a iznos je u EUR',
  noRate: (currency) => `nema polja rate, koje treba iznos u ${currency}, u ${currency} za 1 EUR`,
  notAnIsin: (text) => `isin „${text}” nije ISIN, na primjer US0378331005`,
  notAnExchange: (text) => `exchange „${text}” nije oznaka tržišta (MIC), na primjer XETR`,
  bondFieldsWithout: 'coupon i maturity pripadaju samo obveznici koja kotira u postotku',
  typeOfOtherClass: (type, instrumentClass) => `type ${type} drži samo class ${instrumentClass}`,
  quotingOfOtherType: (quoted, type) => `quoted ${quoted} pripada samo type ${type}`,
  distributionOfFundOnly: 'distribution pripada samo type fund',
  sourceSymbolByHand: 'polje source_symbol je popunjeno, a cijene se unose ručno',
  notAFlag: (name, text) => `${name} „${text}” nije true ni false`,
  withheldOverGross: 'withheld je veći od gross',
  reversalWithoutNote: 'gross je manji od nule, a to smije biti samo storniranje s napomenom koja to kaže',
  withheldAgainstGross: 'withheld je veći od nule, a gross manji',
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
  overHundred: (name) => `polje ${name} je veće od 100`,
  notACountry: (name, text) => `${name} „${text}” nije oznaka države, na primjer US, ni regija: world, europe, north-america, asia-pacific, emerging-markets`,
  fundMixNotWhole: (instrument, mix, sum) => `retci instrumenta „${instrument}” za ${mix} zbrajaju se na ${formatQuantity(sum, LABEL_PLACES)} %, a ne na 100 %`,
  fundMixGroupShared: (instrument, group) => `i drugi redak instrumenta „${instrument}” je za ${group}`,
  targetsNotWhole: (mix, sum) => `ciljevi za ${mix} zbrajaju se na ${formatQuantity(sum, LABEL_PLACES)} %, a ne na 100 %`,
  targetGroupShared: (group) => `i drugi cilj je za ${group}`,
  checkShared: (check) => `i drugi zapis mijenja provjeru ${check}`,
  checkChangesNothing: 'polje threshold je prazno ili jednako zadanom, a off nije true, pa zapis ništa ne mijenja',
}

export const words = language === 'hr' ? hr : en
