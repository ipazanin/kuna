import type { SetUpLine } from '../../../../shared/app/appContribution'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'
import { plural } from '../../../../shared/text/translation'
import { heldHoldings } from '../../holdings/domain/holdingsList'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import { TAX_ROUTE } from '../../tax/presentation/taxLinks'
import { TRANSACTIONS_ROUTE } from '../../transactions/presentation/transactionLinks'
import { hasTransactions } from '../../workbook/domain/investmentBook'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { INVESTMENTS_SETTINGS_ROUTE } from './investmentLinks'
import { words } from './words'

/**
 * What an Investments file still lacks: its first transactions, then the deposit a buy without one leaves missing, since
 * the value adds the cash, then the word that the history is complete, then a price for each holding.
 */
export function investmentsSetUp(book: InvestmentBook, figures: PortfolioFigures | null, historyComplete: boolean): SetUpLine[] {
  if (!hasTransactions(book)) return [{ key: 'first-holdings', text: words.setUp.firstHoldings, whileEmpty: true }]
  const cashBelowZero = figures !== null && figures.cash.some((held) => held.balance < DECIMAL_ZERO)
  const unpriced = figures === null ? 0 : heldHoldings(figures).filter((holding) => holding.valuation === null).length
  return [
    ...(cashBelowZero ? [{ key: 'cash-below-zero', text: words.setUp.cashBelowZero, link: { label: words.setUp.transactionsLink, to: TRANSACTIONS_ROUTE } }] : []),
    ...(historyComplete ? [] : [{ key: 'history', text: words.setUp.history, link: { label: words.setUp.taxLink, to: TAX_ROUTE } }]),
    ...(unpriced > 0
      ? [{ key: 'prices', text: plural(words.setUp.prices(unpriced), unpriced), link: { label: words.setUp.pricesLink, to: { path: INVESTMENTS_SETTINGS_ROUTE, query: { tab: 'prices' } } } }]
      : []),
  ]
}
