import type { AppHomeCard } from '../../../../shared/app/appContribution'
import { homeCardFigures } from '../../../../shared/app/homeCardFigures'
import { plural } from '../../../../shared/text/translation'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { companyHomeFigures } from '../domain/homeFigures'
import { words } from './words'

const { state } = useWorkbook()

/** The company's card on the Kuna home: the cash on hand, and the rows Review holds when any wait. */
export const COMPANY_HOME_CARD: AppHomeCard = {
  icon: 'i-lucide-building-2',
  purpose: words.purpose,
  figures: () =>
    homeCardFigures(state, (workbook) => {
      const { cashOnHand, toReview } = companyHomeFigures(workbook.transactions)
      return { amounts: [{ label: words.cashOnHand, cents: cashOnHand }], waiting: toReview === 0 ? null : plural(words.toReview(toReview), toReview) }
    }),
}
