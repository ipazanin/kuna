import type { HomeFigures } from '../../../../shared/app/appContribution'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { netOwed, owedOnDay } from '../../overview/domain/owedTotals'
import { words as overviewWords } from '../../overview/presentation/words'
import type { LoanBook } from '../../workbook/domain/readLoanBook'
import { words } from './words'

/**
 * The Loans card on the Kuna home: what others owe you less what you owe, in full red while you owe more and full green while you are owed more,
 * then each of the two figures it comes from while it is above zero. Net worth keeps what you owe even at zero, so the two do not share this rule.
 */
export function loansHomeFigures(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>, day: CivilDate): HomeFigures {
  const totals = owedOnDay(book, day)
  return {
    amounts: [
      { label: overviewWords.tiles.net, cents: netOwed(totals), tone: 'outcome' },
      ...(totals.owed > 0 ? [{ label: words.owed, cents: totals.owed }] : []),
      ...(totals.owedToYou > 0 ? [{ label: words.owedToYou, cents: totals.owedToYou }] : []),
    ],
    waiting: null,
  }
}
