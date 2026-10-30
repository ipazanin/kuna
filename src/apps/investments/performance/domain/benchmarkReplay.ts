import type { ValuedDay } from './timeWeightedReturn'
import { valuationOn } from '../../holdings/domain/holding'
import type { PortfolioSources, Valuation } from '../../holdings/domain/holding'
import type { Instrument } from '../../workbook/domain/instrument'
import { DECIMAL_ZERO, addDecimal, decimalOfMoney, dividedDecimal, inEuros, timesDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, negateMoney, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { DatedFlow } from '../../../../shared/money/rateSolver'

export interface BenchmarkReplay {
  /** The benchmark's value at each day's close and the flow it actually made, which is less than asked when it ran out. */
  readonly days: readonly ValuedDay[]
  /** Withdrawals larger than the benchmark holding of their day, each with the part it could not pay after selling everything. */
  readonly unpaid: readonly DatedFlow[]
}

/**
 * The portfolio's deposits and withdrawals put into the benchmark instead, on the same days, at its close on or before
 * each day converted as a holding's is. The first day buys what the portfolio was worth that day. Units are counted after
 * every split the book knows, as the closes are. Null when a day has no close or no rate for the benchmark.
 */
export function benchmarkReplay(benchmark: Instrument, portfolioDays: readonly ValuedDay[], sources: PortfolioSources): BenchmarkReplay | null {
  const days: ValuedDay[] = []
  const unpaid: DatedFlow[] = []
  let units = DECIMAL_ZERO
  for (const [position, day] of portfolioDays.entries()) {
    const held = valuationOn(benchmark, units, sources, day.date)
    if (held === null) {
      return null
    }
    const asked = position === 0 ? (day.value > 0 ? day.value : ZERO) : day.flow
    const sellsEverything = asked < 0 && negateMoney(asked) >= held.value
    if (sellsEverything && negateMoney(asked) > held.value) {
      unpaid.push({ date: day.date, amount: subtractMoney(negateMoney(asked), held.value) })
    }
    units = sellsEverything ? DECIMAL_ZERO : addDecimal(units, unitsWorth(asked, held))
    days.push({ date: day.date, value: inEuros(timesDecimal(units, held.price), held.rate), flow: sellsEverything ? negateMoney(held.value) : asked })
  }
  return { days, unpaid }
}

/** The units an amount of euros buys at a valuation's close, below zero for an amount below zero. */
function unitsWorth(euros: Money, close: Valuation): Decimal {
  const inQuoteCurrency = close.rate === null ? decimalOfMoney(euros) : timesDecimal(decimalOfMoney(euros), close.rate)
  return dividedDecimal(inQuoteCurrency, close.price)
}
