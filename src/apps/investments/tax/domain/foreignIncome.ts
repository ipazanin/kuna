import { dayRate, inEurosAt, isEstimate } from './hnbRate'
import type { DayRate } from './hnbRate'
import { inoDohDue, inoIzjavaDue, thirtyDaysDue } from './taxDeadlines'
import type { InoDohDue } from './taxDeadlines'
import { JOPPD_CODES, percentOf, rulesOf } from './taxRules'
import type { YearRules } from './taxRules'
import { en as importEnglish, hr as importCroatian } from '../../imports/domain/words'
import type { RateBook } from '../../prices/domain/rateBook'
import type { Income, IncomeKind } from '../../workbook/domain/income'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { DECIMAL_ZERO, subtractDecimal } from '../../../../shared/money/decimal'
import { subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/**
 * How a payment's tax is settled. Tax withheld abroad goes on the year's INO-DOH. Nothing withheld means a JOPPD
 * within 30 days. A referral credit is other income that owes pension contributions and tax at the city's rate, so
 * it has a date and its codes and no figure. A dividend booked net waits for its tax withheld to be typed, and other
 * income such as a refund of tax has no tax of its own.
 */
export type IncomeRoute = 'ino-doh' | 'joppd' | 'referral' | 'booked-net' | 'none'

/** The codes a 30-day JOPPD gives the recipient and the receipt. */
export interface JoppdCodes {
  readonly recipient: string
  readonly receipt: string
}

/** The figures of one payment, or a sum of them, in euros at HNB's rate of each payment's day. */
export interface IncomeTax {
  readonly gross: Money
  readonly withheld: Money
  /** The year's rate of the gross. */
  readonly croatian: Money
  /** The tax withheld abroad up to the Croatian tax, never more. */
  readonly credit: Money
  readonly leftToPay: Money
  /** Tax withheld abroad beyond the credit, which nothing gives back here. */
  readonly lost: Money
}

export interface ForeignPayment {
  readonly payment: Income
  /** The stored kind, or for other income an earlier import noted as stock lending or a referral credit, that kind. */
  readonly kind: IncomeKind
  readonly account: InvestmentAccount | null
  readonly instrument: Instrument | null
  /** The first two letters of the payer's ISIN, null for income with no ISIN, such as interest on cash. */
  readonly country: string | null
  readonly rate: DayRate
  readonly route: IncomeRoute
  /** Null while the day has no rate, and for a route with no tax figure. */
  readonly tax: IncomeTax | null
  /** The last day of a payment's 30 days. Null for the INO-DOH and for a reversal. */
  readonly due: CivilDate | null
  /** Null outside the 30-day JOPPD, a referral credit's among them. */
  readonly codes: JoppdCodes | null
}

export interface CountryIncome {
  readonly country: string | null
  readonly payments: readonly ForeignPayment[]
  readonly total: IncomeTax
}

export interface ForeignIncomeYear {
  readonly year: number
  /** By day, oldest first. */
  readonly payments: readonly ForeignPayment[]
  /** Largest gross first, the income with no ISIN last. */
  readonly countries: readonly CountryIncome[]
  /** What goes on the INO-DOH. */
  readonly inoDoh: IncomeTax
  readonly inoDohDue: InoDohDue
  /** True when a payment had tax withheld abroad, a dividend booked net among them, so the year has an INO-DOH. */
  readonly filesInoDoh: boolean
  /** Eight days after the year's first payment with tax withheld abroad, null without one. */
  readonly inoIzjavaDue: CivilDate | null
  /** What the 30-day JOPPDs pay. */
  readonly joppd: IncomeTax
  /** Coupons of the year, left out since bond interest is not taxed. */
  readonly couponsLeftOut: number
  /** Payments of a Croatian ISIN, left out since they are not income from abroad. */
  readonly croatianLeftOut: number
  /** Taxed payments with no HNB rate for their day, left out of every figure. */
  readonly leftOut: number
  readonly estimated: boolean
  readonly rules: YearRules
}

const IMPORT_LABELS = [importEnglish, importCroatian]

/** Labels an earlier import wrote into the note of stock lending or a referral credit it stored as other income. */
const NOTED_KINDS: readonly (readonly [string, IncomeKind])[] = IMPORT_LABELS.flatMap((labels) => [[labels.stockYieldIncome, 'lending'] as const, [labels.referralCredit, 'referral'] as const])

const BOOKED_NET_LABELS: readonly string[] = IMPORT_LABELS.map((labels) => labels.bookedNet)

function noteParts(payment: Income): readonly string[] {
  return payment.note.split('. ')
}

function taxKindOf(payment: Income): IncomeKind {
  if (payment.kind !== 'other') {
    return payment.kind
  }
  const parts = noteParts(payment)
  return NOTED_KINDS.find(([label]) => parts.includes(label))?.[1] ?? 'other'
}

function isBookedNet(payment: Income): boolean {
  const parts = noteParts(payment)
  return payment.kind === 'dividend' && payment.withheld === DECIMAL_ZERO && BOOKED_NET_LABELS.some((label) => parts.includes(label))
}

function routeOf(payment: Income, kind: IncomeKind): IncomeRoute {
  if (kind === 'referral') {
    return 'referral'
  }
  if (kind === 'other') {
    return 'none'
  }
  if (isBookedNet(payment)) {
    return 'booked-net'
  }
  return payment.withheld === DECIMAL_ZERO ? 'joppd' : 'ino-doh'
}

/**
 * Dividends take 1003 and 1001. Interest, stock lending among it, takes 1103 and 1005, other capital income, since
 * broker cash is no savings deposit. A referral credit takes 4002, other income that owes contributions, and 4025,
 * other income received straight from abroad.
 */
function codesOf(kind: IncomeKind, route: IncomeRoute): JoppdCodes | null {
  switch (route) {
    case 'joppd':
      return kind === 'dividend' ? JOPPD_CODES.dividend : JOPPD_CODES.interest
    case 'referral':
      return JOPPD_CODES.referral
    default:
      return null
  }
}

/** The one nearer zero, so a reversal's negative credit is never larger than its negative tax. */
function nearerZero(first: Money, second: Money): Money {
  return Math.abs(first) <= Math.abs(second) ? first : second
}

/** Gross and withheld at the day's rate, withheld as the gross less what was paid after it, so both add up to the cent. */
function taxOf(payment: Income, rate: DayRate, incomeRate: number): IncomeTax | null {
  const gross = inEurosAt(payment.gross, rate)
  const paid = inEurosAt(subtractDecimal(payment.gross, payment.withheld), rate)
  if (gross === null || paid === null) {
    return null
  }
  const withheld = subtractMoney(gross, paid)
  const croatian = percentOf(gross, incomeRate)
  const credit = nearerZero(withheld, croatian)
  return { gross, withheld, croatian, credit, leftToPay: subtractMoney(croatian, credit), lost: subtractMoney(withheld, credit) }
}

function sumTax(taxes: readonly IncomeTax[]): IncomeTax {
  const sum = (pick: (tax: IncomeTax) => Money): Money => sumMoney(taxes.map(pick))
  return {
    gross: sum((tax) => tax.gross),
    withheld: sum((tax) => tax.withheld),
    croatian: sum((tax) => tax.croatian),
    credit: sum((tax) => tax.credit),
    leftToPay: sum((tax) => tax.leftToPay),
    lost: sum((tax) => tax.lost),
  }
}

function totalOf(payments: readonly ForeignPayment[]): IncomeTax {
  return sumTax(payments.flatMap((entry) => (entry.tax === null ? [] : [entry.tax])))
}

function countryOf(instrument: Instrument | null): string | null {
  const isin = instrument?.isin ?? null
  return isin === null || isin.length < 2 ? null : isin.slice(0, 2).toUpperCase()
}

/** Tax withheld abroad, or a dividend booked net whose tax was withheld abroad but not typed. */
function isWithheldAbroad(entry: ForeignPayment): boolean {
  return (entry.route === 'ino-doh' || entry.route === 'booked-net') && entry.payment.gross > DECIMAL_ZERO
}

/**
 * The year's dividends, interest, stock lending and referral credits, each in euros at HNB's rate of its day, never
 * at the rate the record stores, with the Croatian tax, the credit for tax withheld abroad and the route that settles
 * it. A reversal lowers the figures of its payer and its route. Coupons and payments of a Croatian ISIN are left out.
 */
export function foreignIncomeYear(book: InvestmentBook, rates: RateBook, year: number): ForeignIncomeYear {
  const rules = rulesOf(year)
  const instruments = new Map(book.instruments.map((instrument) => [instrument.id, instrument]))
  const accounts = new Map(book.accounts.map((account) => [account.id, account]))
  const ofYear = book.income.filter((payment) => yearOf(payment.date) === year)
  const withInstrument = ofYear
    .filter((payment) => payment.kind !== 'coupon')
    .map((payment) => ({ payment, instrument: payment.instrument === null ? null : (instruments.get(payment.instrument) ?? null) }))
  const payments = withInstrument
    .filter(({ instrument }) => countryOf(instrument) !== 'HR')
    .map(({ payment, instrument }): ForeignPayment => {
      const kind = taxKindOf(payment)
      const rate = dayRate(rates, payment.currency, payment.date)
      const route = routeOf(payment, kind)
      const taxed = route === 'ino-doh' || route === 'joppd'
      const reversal = payment.gross < DECIMAL_ZERO
      return {
        payment,
        kind,
        account: accounts.get(payment.account) ?? null,
        instrument,
        country: countryOf(instrument),
        rate,
        route,
        tax: taxed ? taxOf(payment, rate, rules.rules.incomeRate) : null,
        due: (route === 'joppd' || route === 'referral') && !reversal ? thirtyDaysDue(payment.date) : null,
        codes: codesOf(kind, route),
      }
    })
    .sort((first, second) => first.payment.date.localeCompare(second.payment.date))
  const byCountry = new Map<string | null, ForeignPayment[]>()
  for (const entry of payments) {
    byCountry.set(entry.country, [...(byCountry.get(entry.country) ?? []), entry])
  }
  const countries = [...byCountry]
    .map(([country, countryPayments]): CountryIncome => ({ country, payments: countryPayments, total: totalOf(countryPayments) }))
    .sort((first, second) => Number(first.country === null) - Number(second.country === null) || second.total.gross - first.total.gross || (first.country ?? '').localeCompare(second.country ?? ''))
  const firstWithheld = payments.find(isWithheldAbroad)
  return {
    year,
    payments,
    countries,
    inoDoh: totalOf(payments.filter((entry) => entry.route === 'ino-doh')),
    inoDohDue: inoDohDue(year),
    filesInoDoh: firstWithheld !== undefined,
    inoIzjavaDue: firstWithheld === undefined ? null : inoIzjavaDue(firstWithheld.payment.date),
    joppd: totalOf(payments.filter((entry) => entry.route === 'joppd')),
    couponsLeftOut: ofYear.length - withInstrument.length,
    croatianLeftOut: withInstrument.length - payments.length,
    leftOut: payments.filter((entry) => (entry.route === 'ino-doh' || entry.route === 'joppd') && entry.tax === null).length,
    estimated: payments.some((entry) => isEstimate(entry.rate)),
    rules,
  }
}
