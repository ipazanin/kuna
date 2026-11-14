import type { AppHomeCard } from '../../../../shared/app/appContribution'
import { homeCardFigures } from '../../../../shared/app/homeCardFigures'
import { today } from '../../../../shared/calendar/civilDate'
import { DIRECTION_LOOKS } from '../../directions/presentation/loanDirection'
import { netDirection, netOwed, owedOnDay } from '../../overview/domain/owedTotals'
import { words as overviewWords } from '../../overview/presentation/words'
import { useLoansBooks } from '../../workbook/application/loansStore'
import { words } from './words'

const { state } = useLoansBooks()

/** The Loans card on the Kuna home: what others owe you less what you owe, on the tint of the way it runs, with the two figures it comes from under it. */
export const LOANS_HOME_CARD: AppHomeCard = {
  icon: 'i-lucide-landmark',
  purpose: words.purpose,
  figures: () =>
    homeCardFigures(state, (book) => {
      const totals = owedOnDay(book, today())
      const net = netOwed(totals)
      const direction = netDirection(net)
      return {
        amounts: [
          { label: overviewWords.tiles.net, cents: net, sign: 'always', ...(direction === null ? {} : { tint: DIRECTION_LOOKS[direction].tint }) },
          { label: words.owed, cents: totals.owed },
          { label: words.owedToYou, cents: totals.owedToYou },
        ],
        waiting: null,
      }
    }),
}
