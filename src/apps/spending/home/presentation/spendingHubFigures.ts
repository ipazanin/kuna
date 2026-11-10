import { countedAccounts, unconvertedCount } from '../../rates/domain/euroRows'
import { waitsForRates } from '../../rates/presentation/waitsForRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import type { RatesState } from '../../../../shared/rates/domain/ratesState'
import { SPENDING_ACCOUNTS_ROUTE } from '../../overview/presentation/spendingLinks'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { CountedHubPart, HubFigures } from '../../../../shared/app/appContribution'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { negateMoney, sumMoney } from '../../../../shared/money/money'
import { plural } from '../../../../shared/text/translation'
import { words } from './words'

/** What Spending adds to Net worth: what its accounts hold in euros today, and what the overdrawn ones owe. A closed account counts while it still holds money. */
export function spendingHubFigures(book: Pick<SpendingBook, 'accounts' | 'transactions'>, rates: RatesState, day: CivilDate): HubFigures<CountedHubPart> | 'opening' | null {
  if (book.accounts.length === 0) return null
  const counted = countedAccounts(book, day, everydayRates(rates))
  const accounts = counted.map((shown) => shown.account)
  if (waitsForRates(accounts, rates)) return 'opening'
  const converted = counted.flatMap((shown) => (shown.euros === null ? [] : [shown.euros]))
  const held = converted.filter((amount) => amount >= 0)
  const owed = converted.filter((amount) => amount < 0)
  const unconverted = unconvertedCount(counted)
  return {
    parts: [
      { label: words.bankAndCash, cents: sumMoney(held), side: 'has', caption: plural(words.across(held.length), held.length), to: SPENDING_ACCOUNTS_ROUTE },
      ...(owed.length === 0 ? [] : [{ label: words.overdrawn, cents: negateMoney(sumMoney(owed)), side: 'owes' as const, caption: null, to: SPENDING_ACCOUNTS_ROUTE }]),
    ],
    notes: unconverted === 0 ? [] : [plural(words.notConvertedNote(unconverted), unconverted)],
  }
}
