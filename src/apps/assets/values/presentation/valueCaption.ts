import type { TableShare } from '../../carValue/domain/customsTable'
import type { Quarter } from '../../houseIndex/domain/houseIndex'
import type { AssetValue } from '../domain/assetValue'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatCostShare, formatMoney } from '../../../../shared/money/moneyFormat'
import { shareOfPercent } from '../../../../shared/money/percent'
import { plural } from '../../../../shared/text/translation'
import { words } from './words'

export function quarterLabel(quarter: Quarter): string {
  return words.quarter(Number(quarter.slice(0, -2)), Number(quarter.slice(-1)))
}

function monthsText(months: number): string {
  return plural(words.months(months), months)
}

function shareText(share: TableShare): string {
  return formatCostShare(shareOfPercent(share.share))
}

/** How the value was reached, as its figure's caption says. */
export function valueCaption(value: AssetValue): string {
  const { basis } = value
  switch (basis.kind) {
    case 'valuation':
      return words.valuation(dayLabel(basis.date))
    case 'price':
      return words.price(dayLabel(basis.date))
    case 'index-not-out':
      return words.indexNotOut(quarterLabel(basis.quarter), basis.base, dayLabel(basis.date))
    case 'index-not-reached':
      return words.indexNotReached(quarterLabel(basis.first), basis.base, dayLabel(basis.date))
    case 'house-index':
      return words.carried(formatMoney(basis.base), dayLabel(basis.date), quarterLabel(basis.quarter), words.regions[basis.region])
    case 'customs': {
      const { onDay, whenBought } = basis
      return whenBought === null
        ? words.customsNew(shareText(onDay), monthsText(onDay.months))
        : words.customsUsed(shareText(onDay), monthsText(onDay.months), shareText(whenBought), monthsText(whenBought.months))
    }
  }
}
