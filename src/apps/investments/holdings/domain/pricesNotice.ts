import type { HoldingFigures } from './holding'
import type { CashFigures, PortfolioFigures } from './portfolioFigures'
import type { Instrument } from '../../workbook/domain/instrument'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'

/** What the Overview's notice names, each list in the file's order. */
export interface PricesNotice {
  /** Held and valued at a close that is late by the figures' day, fetched or entered by hand. */
  readonly late: readonly HoldingFigures[]
  /** Held and valued at a price entered by hand that is not late. */
  readonly byHand: readonly HoldingFigures[]
  /** Held with no price or no rate, which the value leaves out. */
  readonly unpriced: readonly Instrument[]
  /** Cash in a currency below zero, which usually means a deposit or an exchange is missing. */
  readonly cashBelowZero: readonly CashFigures[]
}

export function pricesNotice(figures: PortfolioFigures): PricesNotice {
  const held = figures.holdings.filter((holding) => holding.quantity > DECIMAL_ZERO && holding.valuation !== null)
  return {
    late: held.filter((holding) => holding.late),
    byHand: held.filter((holding) => !holding.late && holding.valuation?.close.byHand === true),
    unpriced: figures.unpriced,
    cashBelowZero: figures.cash.filter((balance) => balance.balance < DECIMAL_ZERO),
  }
}

export function noticeIsEmpty(notice: PricesNotice): boolean {
  return notice.late.length === 0 && notice.byHand.length === 0 && notice.unpriced.length === 0 && notice.cashBelowZero.length === 0
}
