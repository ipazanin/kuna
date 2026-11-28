import { bookBefore } from './importQuestions'
import type { SpinOffQuestion } from './importQuestions'
import { investmentLots } from '../../holdings/domain/lots'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { CloseRow } from '../../prices/domain/pricesFile'
import { addDays, parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { DECIMAL_ONE, DECIMAL_ZERO, addDecimal, decimalOfText, dividedDecimal, sumDecimal, timesDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * The fraction of a parent's cost that a spin-off's units carry: their worth at the row's price over the cost of the
 * parent's lots open the day before, in the parent's currency. Null when the parent had no cost then, or when the
 * fraction is not above zero and below one.
 */
export function proposedCostShare(planned: InvestmentBook, parent: RecordId, question: SpinOffQuestion): Decimal | null {
  const lots = investmentLots(bookBefore(planned, question.date)).get(parent)
  const cost = sumDecimal((lots?.open ?? []).map((lot) => lot.costInCurrency))
  if (cost <= DECIMAL_ZERO) {
    return null
  }
  const share = dividedDecimal(question.worth, cost)
  return share > DECIMAL_ZERO && share < DECIMAL_ONE ? share : null
}

/** A spin-off's cost share by market value, and the day of the two closes it comes from. */
export interface MarketCostShare {
  readonly share: Decimal
  readonly day: CivilDate
}

/** Days after a spin-off its first trading day may fall, past a weekend and a holiday. */
const FIRST_TRADING_DAYS = 7

/**
 * The fraction of a parent's cost that a spin-off's units carry by market value, as companies set it: the units
 * received at their close over that and the parent's units held at the parent's close, on the first day on or after
 * the spin-off that both closed. Null when either has no close that week, or the parent held no units.
 */
export function costShareFromCloses(
  planned: InvestmentBook,
  parent: RecordId,
  question: SpinOffQuestion,
  parentCloses: readonly CloseRow[],
  receivedCloses: readonly CloseRow[],
): MarketCostShare | null {
  const lots = investmentLots(bookBefore(planned, question.date)).get(parent)
  const parentUnits = sumDecimal((lots?.open ?? []).map((lot) => lot.quantity))
  if (parentUnits <= DECIMAL_ZERO) {
    return null
  }
  const lastDay = addDays(question.date, FIRST_TRADING_DAYS)
  const parentCloseOn = new Map(parentCloses)
  const received = receivedCloses.find(([day]) => day >= question.date && day <= lastDay && parentCloseOn.has(day))
  if (received === undefined) {
    return null
  }
  const receivedWorth = timesDecimal(question.quantity, decimalOfText(received[1])!)
  const total = addDecimal(receivedWorth, timesDecimal(parentUnits, decimalOfText(parentCloseOn.get(received[0])!)!))
  const share = total <= DECIMAL_ZERO ? DECIMAL_ZERO : dividedDecimal(receivedWorth, total)
  return share > DECIMAL_ZERO && share < DECIMAL_ONE ? { share, day: parseCivilDate(received[0])! } : null
}
