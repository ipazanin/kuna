import { computed } from 'vue'

import type { AppHomeCard, HomeAmount, HomeCardAction } from '../../../../shared/app/appContribution'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import { pricesDay } from '../../prices/application/pricesUpdate'
import { useFetchToday } from '../../prices/presentation/useFetchToday'
import type { FetchToday } from '../../prices/presentation/useFetchToday'
import { usePrices } from '../../prices/presentation/usePrices'
import { words as pricesWords } from '../../prices/presentation/words'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { pricesAge } from '../../prices/domain/priceBook'
import { taxReminder } from '../../tax/domain/taxReminders'
import { useTaxShown } from '../../tax/presentation/useTaxShown'
import type { TaxReminder } from '../../tax/domain/taxReminders'
import { plural } from '../../../../shared/text/translation'
import { shownPortfolio } from './shownPortfolio'
import { words } from './words'

function reminderText(reminder: TaxReminder): string {
  const day = shortDayLabel(reminder.due)
  switch (reminder.kind) {
    case 'ino-doh':
      return words.inoDohBy(day)
    case 'joppd':
      return words.joppdBy(day)
    case 'payments':
      return plural(words.taxOnPayments(reminder.count, day), reminder.count)
  }
}

const taxShown = useTaxShown()
const prices = usePrices()

/**
 * Value and Total gain, with the day's change between them once a Fetch today click has run today. It reads Today while
 * a quote counts and Last day when the click brought nothing newer than the closes. Without a click the card stays as it was.
 */
export function homeAmounts(figures: PortfolioFigures, clickedToday: boolean): HomeAmount[] {
  const day: HomeAmount[] =
    clickedToday && figures.lastDay !== null ? [{ label: figures.lastDay.quoted === undefined ? words.lastDay : words.today, cents: figures.lastDay.change, tone: 'outcome' }] : []
  return [{ label: words.value, cents: figures.value }, ...day, { label: words.totalGain, cents: figures.totalGain, tone: 'outcome' }]
}

/** The card's Fetch today button with what its last click left to say, hidden while a click would ask no vendor. */
export function fetchTodayAction(fetchToday: FetchToday): HomeCardAction | null {
  if (fetchToday.blocked.value !== null && !fetchToday.busy.value) {
    return null
  }
  return { label: pricesWords.today.fetch, icon: 'i-lucide-refresh-cw', busy: fetchToday.busy.value, note: fetchToday.outcome.value, run: () => fetchToday.run() }
}

/**
 * The Investments card on the Kuna home: the value, the day's change once Fetch today ran, the total gain with its sign,
 * and the nearest tax date or else when the prices are late. Fetch today shows while a click would ask a vendor. A file
 * with no transactions shows what the app keeps, and one with them waits for this browser's copy of its prices.
 */
export const INVESTMENTS_HOME_CARD: AppHomeCard = {
  icon: 'i-lucide-trending-up',
  purpose: words.purpose,
  figures: () =>
    shownPortfolio(({ book, sources, figures }) => {
      const age = pricesAge(
        figures.holdings.flatMap((holding) => holding.valuation?.close ?? []),
        sources.today,
      )
      const tax = taxReminder(book, sources.rates, sources.today, taxShown.value)
      return {
        // The click's day is the Zagreb day, so it is held against the Zagreb day now, not this device's.
        amounts: homeAmounts(figures, prices.state.quoted?.day === pricesDay(new Date().toISOString())),
        waiting: tax !== null ? reminderText(tax) : age?.late === true ? words.pricesFrom(shortDayLabel(age.newest)) : null,
      }
    }),
  useAction() {
    const fetchToday = useFetchToday()
    return computed(() => fetchTodayAction(fetchToday))
  },
}
