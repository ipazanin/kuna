import type { AppHomeCard } from '../../../../shared/app/appContribution'
import { homeCardFigures } from '../../../../shared/app/homeCardFigures'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { words } from './words'

const { state } = useInvestmentsBooks()

/** The Investments card on the Kuna home, which says what the app keeps until it has figures to show. */
export const INVESTMENTS_HOME_CARD: AppHomeCard = {
  icon: 'i-lucide-trending-up',
  purpose: words.purpose,
  figures: () => homeCardFigures(state, () => null),
}
