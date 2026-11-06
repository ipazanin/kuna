import type { CountedHubPart, HubFigures } from '../../../../shared/app/appContribution'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { sumMoney } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import { ASSETS_OVERVIEW_ROUTE } from '../../overview/presentation/assetLinks'
import type { HouseIndexState } from '../../houseIndex/presentation/useHouseIndex'
import { assetsTotal } from '../../values/presentation/assetsOnDay'
import type { AssetsTotal, LoansOnScreen } from '../../values/presentation/assetsOnDay'
import type { AssetBook } from '../../workbook/domain/readAssetBook'
import { words } from './words'

/** What is yours after the loans on the assets, naming the loan when there is one, or null when no loan is known. */
export function yoursCaption(yoursAfter: AssetsTotal['yoursAfter']): string | null {
  const [only, ...more] = yoursAfter
  if (only === undefined) return null
  return more.length === 0 ? words.yoursAfterLoan(formatMoney(only.yours), only.loan.name) : words.yoursAfterLoans(formatMoney(sumMoney(yoursAfter.map((entry) => entry.yours))))
}

/**
 * What the assets are worth on the day for Net worth, with what is yours after the loans on them under it, and the
 * assets it counts as nothing. It waits while the house price index loads for a home with a region, and a file with no
 * assets has nothing to show.
 */
export function assetsHubFigures(book: Pick<AssetBook, 'assets'>, day: CivilDate, index: HouseIndexState, loans: LoansOnScreen): HubFigures<CountedHubPart> | 'opening' | null {
  const total = assetsTotal(book, day, index, loans)
  if (total === null || total === 'opening') return total
  return {
    parts: [
      {
        label: words.value,
        cents: total.value,
        side: 'has',
        caption: yoursCaption(total.yoursAfter),
        to: ASSETS_OVERVIEW_ROUTE,
      },
    ],
    notes: [...(total.unvalued === 0 ? [] : [plural(words.withoutValueNote(total.unvalued), total.unvalued)]), ...(total.indexFailed ? [words.indexNote] : [])],
  }
}
