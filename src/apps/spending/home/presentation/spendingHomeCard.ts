import { useRates } from '../../../../shared/rates/application/pageRates'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { AppHomeCard } from '../../../../shared/app/appContribution'
import { homeCardFigures } from '../../../../shared/app/homeCardFigures'
import { today } from '../../../../shared/calendar/civilDate'
import { spendingHomeFigures } from './spendingHomeFigures'
import { words } from './words'

const { state } = useSpendingBooks()
const rates = useRates()

/** The Spending card on the Kuna home, which leads with what the accounts hold. */
export const SPENDING_HOME_CARD: AppHomeCard = {
  icon: 'i-lucide-wallet',
  purpose: words.purpose,
  figures: () => homeCardFigures(state, (book) => spendingHomeFigures(book, rates.value, today())),
}
