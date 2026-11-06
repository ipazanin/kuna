import type { AppHomeCard } from '../../../../shared/app/appContribution'
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

/** The Investments card on the Kuna home: the value, the total gain with its sign under it, and the nearest tax date or else when the prices are late. A file with no transactions shows what the app keeps, and one with them waits for this browser's copy of its prices. */
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
        amounts: [
          { label: words.value, cents: figures.value },
          { label: words.totalGain, cents: figures.totalGain, sign: 'always', tone: 'outcome' },
        ],
        waiting: tax !== null ? reminderText(tax) : age?.late === true ? words.pricesFrom(shortDayLabel(age.newest)) : null,
      }
    }),
}
