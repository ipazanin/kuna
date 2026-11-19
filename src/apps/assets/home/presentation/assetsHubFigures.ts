import type { CountedHubPart, HubFigures } from '../../../../shared/app/appContribution'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import { assetsNetWorthParts, yoursAfterLoans } from '../domain/assetsNetWorthParts'
import type { HouseIndexState } from '../../houseIndex/domain/houseIndex'
import type { AssetLoan, LoansOnScreen } from '../../loans/application/assetLoans'
import { ASSETS_OVERVIEW_ROUTE } from '../../overview/presentation/assetLinks'
import { assetsTotal } from '../../values/domain/assetsOnDay'
import type { AssetsTotal } from '../../values/domain/assetsOnDay'
import type { AssetBook } from '../../workbook/domain/readAssetBook'
import { words } from './words'

/** What is yours after the loans on the assets, naming the loan when there is one, or null when no loan is known. */
export function yoursCaption(yoursAfter: AssetsTotal<AssetLoan>['yoursAfter']): string | null {
  const [only, ...more] = yoursAfter
  if (only === undefined) return null
  return more.length === 0 ? words.yoursAfterLoan(formatMoney(only.yours), only.loan.name) : words.yoursAfterLoans(formatMoney(yoursAfterLoans(yoursAfter)))
}

/** The line under Assets value on Net worth: that it includes estimates when it does, then what is yours after the loans. */
function hubCaption(total: AssetsTotal<AssetLoan>): string | null {
  const yours = yoursCaption(total.yoursAfter)
  return total.estimated ? words.includesEstimates(yours) : yours
}

/**
 * What the assets are worth on the day for Net worth, with whether it includes estimates and what is yours after the loans on them under it, and the
 * assets it counts as nothing. It waits while the house price index loads for a home with a region, and a file with no
 * assets has nothing to show.
 */
export function assetsHubFigures(book: Pick<AssetBook, 'assets'>, day: CivilDate, index: HouseIndexState, loans: LoansOnScreen): HubFigures<CountedHubPart> | 'opening' | null {
  const total = assetsTotal(book, day, index, loans)
  if (total === null || total === 'opening') return total
  return {
    parts: assetsNetWorthParts(total).map((part) => ({ ...part, key: 'assets value', label: words.value, caption: hubCaption(total), to: ASSETS_OVERVIEW_ROUTE })),
    notes: [...(total.unvalued === 0 ? [] : [plural(words.withoutValueNote(total.unvalued), total.unvalued)]), ...(total.indexFailed ? [words.indexNote] : [])],
  }
}
