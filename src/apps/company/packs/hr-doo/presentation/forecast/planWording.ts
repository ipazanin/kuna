import { monthName, shortMonthName } from '../../../../../../shared/calendar/monthLabel'
import type { AssetGroup } from '../../domain/assets/assets'
import { monthKey } from '../../../../../../shared/calendar/monthKey'
import { negateMoney } from '../../../../../../shared/money/money'
import { amountForTyping } from '../../../../../../shared/money/typedAmount'
import type { Money } from '../../../../../../shared/money/money'
import { words } from './words'

export const GROUP_WORDS: Readonly<Record<AssetGroup, string>> = words.groups

/** January to December of a year, by number, as a field or a choice names them. */
export function monthsOf(year: number): readonly { readonly number: number; readonly name: string; readonly short: string }[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = monthKey(year, index + 1)
    return { number: index + 1, name: monthName(month), short: shortMonthName(month) }
  })
}

/** An amount as a field shows it, such as 1250.00, read positive. */
export function fieldAmount(money: Money): string {
  return amountForTyping(money < 0 ? negateMoney(money) : money)
}
