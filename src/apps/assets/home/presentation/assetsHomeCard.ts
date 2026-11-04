import type { AppHomeCard } from '../../../../shared/app/appContribution'
import { homeCardFigures } from '../../../../shared/app/homeCardFigures'
import { today } from '../../../../shared/calendar/civilDate'
import { plural } from '../../../../shared/text/translation'
import { useHouseIndex } from '../../houseIndex/presentation/useHouseIndex'
import { assetsTotal } from '../../values/presentation/assetsOnDay'
import { useAssetsBooks } from '../../workbook/application/assetsStore'
import { words } from './words'

const { state } = useAssetsBooks()
const index = useHouseIndex()

/** The Assets card on the Kuna home: what the assets are worth, and how many have no value yet. */
export const ASSETS_HOME_CARD: AppHomeCard = {
  icon: 'i-lucide-house',
  purpose: words.purpose,
  figures: () =>
    homeCardFigures(state, (book) => {
      const total = assetsTotal(book, today(), index.value, null)
      return total === null || total === 'opening'
        ? total
        : { amounts: [{ label: words.value, cents: total.value }], waiting: total.unvalued === 0 ? null : plural(words.withoutValue(total.unvalued), total.unvalued) }
    }),
}
