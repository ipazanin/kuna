import { quantityInTodaysUnits } from '../../holdings/domain/holding'
import type { PortfolioSources } from '../../holdings/domain/holding'
import { investmentLots } from '../../holdings/domain/lots'
import { recordsOn } from '../../performance/domain/portfolioPerformance'
import { eurosAtEcbRate } from '../../prices/domain/rateBook'
import type { Income } from '../../workbook/domain/income'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMonths, dayMonthsLater, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { DECIMAL_ZERO, scaledDecimal, subtractDecimal, sumDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** How many months the forecast shows, this month first. */
const FORECAST_MONTHS = 12

/** A payment of the last twelve months copied a year on, scaled to the units held now. */
export interface CopiedPayment {
  readonly instrument: Instrument
  /** The payment it copies. */
  readonly copied: Income
  readonly date: CivilDate
  readonly currency: CurrencyCode
  readonly gross: Decimal
  readonly withheld: Decimal
  /** Gross less withheld at the latest ECB rate on or before the figures' day, null while there is none. */
  readonly received: Money | null
}

export interface ForecastMonth {
  readonly month: MonthKey
  /** The copies that have a rate. */
  readonly received: Money
  readonly payments: readonly CopiedPayment[]
}

export interface IncomeForecast {
  /** This month and the eleven after it, each also when nothing is expected. */
  readonly months: readonly ForecastMonth[]
  readonly received: Money
}

/**
 * Each payment of the last twelve months by a holding still held, a year on, scaled by the units held now over the
 * units held on its day, both counted in today's units after any split. What is still to come this month counts, and
 * a bond's coupon past its maturity does not.
 */
export function incomeForecast(sources: PortfolioSources): IncomeForecast {
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
    return [{ instrument, copied: payment, date, currency: payment.currency, gross, withheld, received: eurosAtEcbRate(subtractDecimal(gross, withheld), payment.currency, today, rates) }]
  })
  copies.sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.instrument.name.localeCompare(later.instrument.name))

  const months = monthsFrom(firstMonth, lastMonth).map((month): ForecastMonth => {
    const payments = copies.filter((copy) => monthOf(copy.date) === month)
    return { month, received: sumMoney(payments.map((copy) => copy.received ?? ZERO)), payments }
  })
  return { months, received: sumMoney(months.map((month) => month.received)) }
}

/** The units of every instrument held at the day's close, across every account. */
function unitsHeldOn(book: InvestmentBook, day: CivilDate): ReadonlyMap<RecordId, Decimal> {
  return new Map([...investmentLots(recordsOn(book, day))].map(([instrument, lots]) => [instrument, sumDecimal(lots.open.map((lot) => lot.quantity))]))
}
