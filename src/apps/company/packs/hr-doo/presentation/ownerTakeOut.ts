import { yearOf } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { formatMoney } from '../../../../../shared/money/moneyFormat'
import { percentText } from '../../../../../shared/money/percent'
import type { OwnerTakeOut } from '../../packContribution'
import { moneyFormatOf } from '../../../settings/domain/settings'
import { dividendCapacity } from '../domain/dividend/dividendCapacity'
import type { DividendCapacity, PayoutOption } from '../domain/dividend/dividendCapacity'
import type { HrDooWorkbook } from '../domain/hrDooPart'
import { forecastNeed, forecastYear } from '../domain/forecast/forecastYear'
import type { TracedFigure } from '../ruleset/tracedFigure'
import { figureLabel } from './tracedFigureView'
import { words } from './words'

/**
 * The kept profit paid out on the newest booking, as it reaches the owner's account after the dividend
 * tax and the owner's loan, or why there is none.
 */
export function ownerTakeOut(workbook: HrDooWorkbook, asOf: CivilDate): OwnerTakeOut {
  if (forecastNeed(workbook) !== null) return { kind: 'missing', reason: words.takeOut.noRegistration }
  const year = yearOf(asOf)
  let capacity: DividendCapacity
  try {
    capacity = dividendCapacity(year, forecastYear(workbook, year, asOf), workbook)
  } catch (failure) {
    if (failure instanceof RangeError) return { kind: 'missing', reason: words.takeOut.forecastFailed(year) }
    throw failure
  }
  const keptNow = capacity.options.find((option) => option.id === 'kept-now')!
  return {
    kind: 'figure',
    label: words.takeOut.label,
    cents: keptNow.paidToOwner.amount,
    caption: captionOf(capacity.keptProfit, keptNow, workbook),
    to: { path: '/company/year', query: { year: String(year), tab: 'pay', payout: 'kept-now' } },
  }
}

/** What the figure is after, or why it is nothing. */
function captionOf(keptProfit: TracedFigure | null, keptNow: PayoutOption, workbook: HrDooWorkbook): string {
  if (keptNow.earliestOn === null) return figureLabel(keptNow.gross)
  if (keptNow.gross.amount === 0) return keptProfit !== null && keptProfit.amount > 0 ? words.takeOut.noCashFree : words.takeOut.nothingKept
  if (keptNow.setOff.amount > 0) return words.takeOut.afterLoan(formatMoney(keptNow.setOff.amount, 'negative', moneyFormatOf(workbook.settings)))
  return words.takeOut.afterTax(percentText(keptNow.taxRate))
}
