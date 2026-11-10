import { quantityInTodaysUnits } from '../../holdings/domain/holding'
import type { PortfolioSources } from '../../holdings/domain/holding'
import { investmentLots } from '../../holdings/domain/lots'
import { recordsOn } from '../../performance/domain/portfolioPerformance'
import type { FactsBook } from '../../prices/domain/factsBook'
import { eurosAtRate } from '../../../../shared/money/rateBook'
import type { Income } from '../../workbook/domain/income'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { addDays, daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMonths, dayMonthsLater, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { DECIMAL_ZERO, dividedDecimal, scaledDecimal, subtractDecimal, sumDecimal, timesDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** How many months the forecast shows, this month first. */
const FORECAST_MONTHS = 12

/** An announced payment replaces the copy of the same holding whose day is at most this many days from its own. */
const SAME_PAYMENT_DAYS = 20

interface ExpectedPayment {
  readonly instrument: Instrument
  readonly date: CivilDate
  readonly currency: CurrencyCode
  readonly gross: Decimal
  readonly withheld: Decimal
  /** Gross less withheld at the latest ECB rate on or before the figures' day, null while there is none. */
  readonly received: Money | null
}

/** A payment of the last twelve months copied a year on, scaled to the units held now. */
export interface CopiedPayment extends ExpectedPayment {
  readonly kind: 'copied'
  /** The payment it copies. */
  readonly copied: Income
}

/** A dividend a vendor announced, in the holding's quote currency. */
export interface AnnouncedPayment extends ExpectedPayment {
  readonly kind: 'announced'
}

export type ForecastPayment = CopiedPayment | AnnouncedPayment

export interface ForecastMonth {
  readonly month: MonthKey
  /** The payments that have a rate. */
  readonly received: Money
  readonly payments: readonly ForecastPayment[]
}

export interface IncomeForecast {
  /** This month and the eleven after it, each also when nothing is expected. */
  readonly months: readonly ForecastMonth[]
  readonly received: Money
}

/**
 * Each payment of the last twelve months by a holding still held, a year on, scaled by the units held now over the
 * units held on its day, both counted in today's units after any split. What is still to come this month counts, and
 * a bond's coupon past its maturity does not. A dividend a vendor announced counts for the units held now, or once its
 * ex day has passed for the units held the day before it, with the share of the holding's last payment that was
 * withheld. It takes the place of the copy of the same holding nearest its day within 20 days.
 */
export function incomeForecast(sources: PortfolioSources, facts: FactsBook): IncomeForecast {
  const { book, rates, today } = sources
  const firstMonth = monthOf(today)
  const lastMonth = addMonths(firstMonth, FORECAST_MONTHS - 1)
  const yearBefore = dayMonthsLater(today, -12)
  const instruments = new Map(book.instruments.map((instrument) => [instrument.id, instrument]))
  const recordedByToday = recordsOn(book, today)
  const heldNow = unitsHeldOn(book, today)

  const copies = book.income.flatMap((payment): CopiedPayment[] => {
    const instrument = payment.instrument === null ? undefined : instruments.get(payment.instrument)
    const date = dayMonthsLater(payment.date, 12)
    if (instrument === undefined || payment.date <= yearBefore || payment.date > today || monthOf(date) > lastMonth) {
      return []
    }
    if (instrument.quoted.kind === 'percent' && date > instrument.quoted.maturity) {
      return []
    }
    const now = heldNow.get(instrument.id) ?? DECIMAL_ZERO
    const then = quantityInTodaysUnits(recordedByToday, instrument, payment.date, unitsHeldOn(book, payment.date).get(instrument.id) ?? DECIMAL_ZERO)
    if (now <= DECIMAL_ZERO || then <= DECIMAL_ZERO) {
      return []
    }
    const gross = scaledDecimal(payment.gross, now, then)
    const withheld = scaledDecimal(payment.withheld, now, then)
    return [{ kind: 'copied', instrument, copied: payment, date, currency: payment.currency, gross, withheld, received: eurosAtRate(subtractDecimal(gross, withheld), payment.currency, today, rates) }]
  })

  /** The units a dividend pays on: those held now while its ex day is to come, else those held the day before it, in today's units. */
  const unitsPaid = (instrument: Instrument, exDay: CivilDate): Decimal => {
    if (exDay > today) {
      return heldNow.get(instrument.id) ?? DECIMAL_ZERO
    }
    const dayBefore = addDays(exDay, -1)
    return quantityInTodaysUnits(recordedByToday, instrument, dayBefore, unitsHeldOn(book, dayBefore).get(instrument.id) ?? DECIMAL_ZERO)
  }
  const announced = book.instruments.flatMap((instrument): AnnouncedPayment[] => {
    const share = withheldShare(lastPaymentOf(book, instrument, today))
    return facts
      .announcedOf(instrument)
      .filter((dividend) => dividend.paymentDay > today && monthOf(dividend.paymentDay) <= lastMonth)
      .flatMap((dividend): AnnouncedPayment[] => {
        const units = unitsPaid(instrument, dividend.exDay)
        if (units <= DECIMAL_ZERO) {
          return []
        }
        const gross = timesDecimal(dividend.amount, units)
        const withheld = share === null ? DECIMAL_ZERO : timesDecimal(gross, share)
        const received = eurosAtRate(subtractDecimal(gross, withheld), instrument.currency, today, rates)
        return [{ kind: 'announced', instrument, date: dividend.paymentDay, currency: instrument.currency, gross, withheld, received }]
      })
  })
  const replaced = new Set<CopiedPayment>()
  for (const payment of announced) {
    const nearest = copies
      .filter((copy) => copy.instrument.id === payment.instrument.id && !replaced.has(copy) && Math.abs(daysBetween(copy.date, payment.date)) <= SAME_PAYMENT_DAYS)
      .sort((first, second) => Math.abs(daysBetween(first.date, payment.date)) - Math.abs(daysBetween(second.date, payment.date)))[0]
    if (nearest !== undefined) replaced.add(nearest)
  }
  const expected: ForecastPayment[] = [...copies.filter((copy) => !replaced.has(copy)), ...announced]
  expected.sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.instrument.name.localeCompare(later.instrument.name))

  const months = monthsFrom(firstMonth, lastMonth).map((month): ForecastMonth => {
    const payments = expected.filter((payment) => monthOf(payment.date) === month)
    return { month, received: sumMoney(payments.map((payment) => payment.received ?? ZERO)), payments }
  })
  return { months, received: sumMoney(months.map((month) => month.received)) }
}

/** The holding's latest payment on or before the day, or null before its first. */
function lastPaymentOf(book: InvestmentBook, instrument: Instrument, day: CivilDate): Income | null {
  return book.income
    .filter((payment) => payment.instrument === instrument.id && payment.date <= day)
    .reduce<Income | null>((latest, payment) => (latest === null || payment.date > latest.date ? payment : latest), null)
}

/** The part of a payment's gross that was withheld, or null for none or a payment of nothing. */
function withheldShare(payment: Income | null): Decimal | null {
  return payment === null || payment.gross <= DECIMAL_ZERO ? null : dividedDecimal(payment.withheld, payment.gross)
}

/** The units of every instrument held at the day's close, across every account. */
function unitsHeldOn(book: InvestmentBook, day: CivilDate): ReadonlyMap<RecordId, Decimal> {
  return new Map([...investmentLots(recordsOn(book, day))].map(([instrument, lots]) => [instrument, sumDecimal(lots.open.map((lot) => lot.quantity))]))
}
