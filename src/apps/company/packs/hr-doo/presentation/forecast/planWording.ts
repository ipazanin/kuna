import type { AssetGroup } from '../../domain/assets/assets'
import { monthKey } from '../../../../../../shared/calendar/monthKey'
import { amountOf } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'

export const GROUP_WORDS: Readonly<Record<AssetGroup, string>> = {
  computers: 'Computers and phones',
  equipment: 'Other equipment',
  car: 'A car',
  building: 'A building',
  other: 'Anything else',
}

const MONTH_NAME = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' })
const SHORT_NAME = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' })

/** January to December of a year, by number, as a field or a choice names them. */
export function monthsOf(year: number): readonly { readonly number: number; readonly name: string; readonly short: string }[] {
  return Array.from({ length: 12 }, (_, index) => {
    const day = new Date(`${monthKey(year, index + 1)}-01T00:00:00Z`)
    return { number: index + 1, name: MONTH_NAME.format(day), short: SHORT_NAME.format(day) }
  })
}

/** An amount as a field shows it, such as 1250.00, read positive. */
export function fieldAmount(money: Money): string {
  return Math.abs(amountOf(money)).toFixed(2)
}
