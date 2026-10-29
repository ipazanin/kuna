import type { AppHomeCard } from '../../../../shared/app/appContribution'
import { homeCardFigures } from '../../../../shared/app/homeCardFigures'
import { today } from '../../../../shared/calendar/civilDate'
import { bankLoanFigures } from '../../bankLoans/presentation/bankLoanView'
import { informalLoanFigures } from '../../informalLoans/presentation/informalLoanView'
import { owedTotals } from '../../overview/presentation/owedTotals'
import { useLoansBooks } from '../../workbook/application/loansStore'
import { words } from './words'

const { state } = useLoansBooks()

/** The Loans card on the Kuna home: what you owe in all, and what others owe you when they do. */
export const LOANS_HOME_CARD: AppHomeCard = {
  icon: 'i-lucide-landmark',
  purpose: words.purpose,
  figures: () =>
    homeCardFigures(state, (book) => {
      const day = today()
      const { owed, owedToYou } = owedTotals({
        bank: book.bankLoans.map((loan) => bankLoanFigures(loan, day)),
        informal: book.informalLoans.map((loan) => informalLoanFigures(loan, day)),
      })
      return { amounts: [{ label: words.owed, cents: owed }, ...(owedToYou > 0 ? [{ label: words.owedToYou, cents: owedToYou }] : [])], waiting: null }
    }),
}
