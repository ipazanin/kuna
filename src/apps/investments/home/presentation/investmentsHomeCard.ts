import type { AppHomeCard } from '../../../../shared/app/appContribution'
import { homeCardFigures } from '../../../../shared/app/homeCardFigures'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { pricesAge } from '../../prices/domain/priceBook'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { hasTransactions } from '../../workbook/domain/investmentBook'
import { words } from './words'

const { state } = useInvestmentsBooks()
const { sources, figures } = usePortfolio()

/** The Investments card on the Kuna home: the value, the total gain with its sign under it, and when the prices are late. A file with no transactions shows what the app keeps, and one with them waits for this browser's copy of its prices. */
export const INVESTMENTS_HOME_CARD: AppHomeCard = {
  icon: 'i-lucide-trending-up',
  purpose: words.purpose,
  figures: () => {
    if (state.workbook !== null && hasTransactions(state.workbook.book) && (sources.value === null || figures.value === null)) {
      return 'opening'
    }
    return homeCardFigures(state, (workbook) => {
      if (sources.value === null || figures.value === null || !hasTransactions(workbook.book)) {
        return null
      }
      const age = pricesAge(
        figures.value.holdings.flatMap((holding) => holding.valuation?.close ?? []),
        sources.value.today,
      )
      return {
        amounts: [
          { label: words.value, cents: figures.value.value },
          { label: words.totalGain, cents: figures.value.totalGain, sign: 'always', tone: 'outcome' },
        ],
        waiting: age?.late === true ? words.pricesFrom(shortDayLabel(age.newest)) : null,
      }
    })
  },
}
