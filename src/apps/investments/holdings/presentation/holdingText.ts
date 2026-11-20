import type { HoldingFigures } from '../domain/holding'
import type { HoldingsGroup } from '../domain/holdingsList'
import type { LastDay } from '../domain/portfolioFigures'
import type { Instrument } from '../../workbook/domain/instrument'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dateFormat } from '../../../../shared/calendar/dateFormat'
import { dayLabel, shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { formatCurrencyAmount } from '../../../../shared/money/moneyFormat'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'
import { withFullStop } from '../../../../shared/text/withFullStop'

/** As many places as a broker books a fractional unit with. */
export const QUANTITY_PLACES = 6

/** The average cost to the cent, as every cost on a holding shows. */
export function averageCostText(holding: Pick<HoldingFigures, 'instrument' | 'averageCost'>): string | null {
  return holding.averageCost === null ? null : formatCurrencyAmount(holding.averageCost, holding.instrument.currency)
}

/** The symbol, the exchange and the quote currency, such as "ABC · XNAS · USD". */
export function listingLine(instrument: Instrument): string {
  return [instrument.symbol, instrument.exchange, instrument.currency].filter((part) => part !== null && part !== '').join(' · ')
}

/** How many holdings and cash balances a group lists, such as "2 holdings and 1 cash balance". */
export function groupCount(group: Pick<HoldingsGroup, 'holdings' | 'lines'>): string {
  const balances = group.lines.length - group.holdings
  return listInWords([...(group.holdings > 0 ? [plural(words.holdingCount(group.holdings), group.holdings)] : []), ...(balances > 0 ? [plural(words.balanceCount(balances), balances)] : [])])
}

/** Why a holding's price needs a look, with an icon so colour is never the only cue. Null for a fetched close that is not late. */
export interface PriceMark {
  readonly icon: string
  readonly text: string
  readonly late: boolean
}

/** `quotedDay` is the day Fetch today's quotes are of, so a holding still at an earlier close says which. */
export function priceMarkOf(holding: HoldingFigures, quotedDay: CivilDate | null = null): PriceMark | null {
  const close = holding.valuation?.close ?? null
  if (close === null) {
    return null
  }
  if (holding.late) {
    return { icon: 'i-lucide-clock-alert', text: words.late(dayLabel(close.date)), late: true }
  }
  if (close.byHand) {
    return { icon: 'i-lucide-hand', text: words.byHand(dayLabel(close.date)), late: false }
  }
  return quotedDay !== null && close.date < quotedDay ? { icon: 'i-lucide-clock', text: words.today.atClose(shortDayLabel(close.date)), late: false } : null
}

const QUOTE_TIME = dateFormat({ hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zagreb' })

/**
 * What a page header says once Fetch today brought quotes: live at the time of the newest trade, or today's close for a
 * market that has shut, with the rest at the close before. Null for a day of closes alone.
 */
export function todayLine(lastDay: LastDay | null): string | null {
  const quoted = lastDay?.quoted
  if (lastDay === null || quoted === undefined) {
    return null
  }
  const head =
    quoted.marketOpen && quoted.at !== null
      ? plural(words.today.live(QUOTE_TIME(Date.parse(quoted.at)), quoted.holdings), quoted.holdings)
      : plural(words.today.closed(quoted.holdings), quoted.holdings)
  return withFullStop(`${head}${quoted.atLastClose > 0 ? words.today.rest(shortDayLabel(lastDay.from)) : ''}`)
}
