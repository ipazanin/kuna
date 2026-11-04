import type { RouteLocationRaw } from 'vue-router'

import { publishedBankLoans } from '../../../loans/facts'
import type { PublishedBankLoan } from '../../../loans/facts'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'

/** A bank loan as Assets shows it beside an asset: its bare UUID, its name, what you owe on it on the day, and its page in Loans. */
export interface AssetLoan {
  readonly key: string
  readonly name: string
  /** Null while Loans cannot work out its plan. */
  readonly owed: Money | null
  readonly to: RouteLocationRaw
}

/** The bank loans Loans publishes, as Assets reads them. */
export function assetLoansOf(published: readonly PublishedBankLoan[]): readonly AssetLoan[] {
  return published.map(({ key, name, owed, to }) => ({ key, name, owed, to }))
}

/** The bank loans of the Loans file on screen, a wait while it opens, a failure, or null while Loans is not set up. */
export function assetLoans(day: CivilDate): readonly AssetLoan[] | 'opening' | 'failed' | null {
  const published = publishedBankLoans(day)
  return published === null || typeof published === 'string' ? published : assetLoansOf(published)
}
