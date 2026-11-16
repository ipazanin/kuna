import { accountStanding } from '../../accounts/domain/accountStanding'
import { countedAccounts } from '../../rates/domain/euroRows'
import { waitsForRates } from '../../rates/presentation/waitsForRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import type { RatesState } from '../../../../shared/rates/domain/ratesState'
import { SPENDING_ACCOUNTS_ROUTE } from '../../overview/presentation/spendingLinks'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { CountedHubPart, HubFigures } from '../../../../shared/app/appContribution'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { plural } from '../../../../shared/text/translation'
import { words } from './words'

/** What Spending adds to Net worth: what its accounts hold in euros today, and what the overdrawn ones owe. A closed account counts while it still holds money. */
export function spendingHubFigures(book: Pick<SpendingBook, 'accounts' | 'transactions'>, rates: RatesState, day: CivilDate): HubFigures<CountedHubPart> | 'opening' | null {
  if (book.accounts.length === 0) return null
  const counted = countedAccounts(book, day, everydayRates(rates))
  const accounts = counted.map((shown) => shown.account)
  if (waitsForRates(accounts, rates)) return 'opening'
  const standing = accountStanding(counted)
  return {
    parts: [
      { label: words.bankAndCash, cents: standing.held, side: 'has', caption: plural(words.across(standing.heldAccounts), standing.heldAccounts), to: SPENDING_ACCOUNTS_ROUTE },
      ...(standing.owed === null ? [] : [{ label: words.overdrawn, cents: standing.owed, side: 'owes' as const, caption: null, to: SPENDING_ACCOUNTS_ROUTE }]),
    ],
    notes: standing.unconverted === 0 ? [] : [plural(words.notConvertedNote(standing.unconverted), standing.unconverted)],
  }
}
