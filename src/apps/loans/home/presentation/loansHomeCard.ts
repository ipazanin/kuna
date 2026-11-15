import type { AppHomeCard } from '../../../../shared/app/appContribution'
import { homeCardFigures } from '../../../../shared/app/homeCardFigures'
import { today } from '../../../../shared/calendar/civilDate'
import { useLoansBooks } from '../../workbook/application/loansStore'
import { loansHomeFigures } from './loansHomeFigures'
import { words } from './words'

const { state } = useLoansBooks()

/** The Loans card on the Kuna home, which leads with the net of what others owe you and what you owe, and leaves out a side that is zero. */
export const LOANS_HOME_CARD: AppHomeCard = {
  icon: 'i-lucide-landmark',
  purpose: words.purpose,
  figures: () => homeCardFigures(state, (book) => loansHomeFigures(book, today())),
}
