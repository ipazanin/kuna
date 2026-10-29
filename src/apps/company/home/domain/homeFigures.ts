import type { Money } from '../../../../shared/money/money'
import { latestBalances } from '../../cash/domain/balances'
import { reviewCount } from '../../workbook/domain/needsReview'
import type { Transaction } from '../../workbook/domain/workbook'

/** What the company's card on the Kuna home shows. */
export interface CompanyHomeFigures {
  /** Every account at its latest balance, whatever the filters say. */
  readonly cashOnHand: Money
  /** The rows the Review queue holds, as the menu counts them. */
  readonly toReview: number
}

export function companyHomeFigures(transactions: readonly Transaction[]): CompanyHomeFigures {
  return { cashOnHand: latestBalances(transactions).cashOnHand.amount, toReview: reviewCount(transactions) }
}
