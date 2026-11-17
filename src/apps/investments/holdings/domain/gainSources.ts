import type { PortfolioFigures } from './portfolioFigures'
import { negateMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** The five places the total gain comes from, in the order Holdings lists them. */
export const GAIN_SOURCES = ['held', 'realised', 'income', 'account-fees', 'currency-on-cash'] as const

export type GainSource = (typeof GAIN_SOURCES)[number]

export interface GainPart {
  readonly source: GainSource
  /** Signed as it moves the total gain, so account fees are below zero. */
  readonly amount: Money
}

export interface GainSources {
  readonly parts: readonly GainPart[]
  readonly total: Money
  /** False while a holding has no price or cash no rate, which the total gain counts at nothing and its parts leave out. */
  readonly addsUp: boolean
  /** Trading and exchange fees, which are inside the parts already. */
  readonly tradingFees: Money
}

/** The total gain as the gain on what is held, realised on sales, income, account fees and currency on cash. */
export function gainSources(figures: PortfolioFigures): GainSources {
  const amounts: Readonly<Record<GainSource, Money>> = {
    held: figures.unrealised,
    realised: figures.realised,
    income: figures.income.received,
    'account-fees': negateMoney(figures.accountFees),
    'currency-on-cash': figures.currencyOnCash,
  }
  const parts = GAIN_SOURCES.map((source): GainPart => ({ source, amount: amounts[source] }))
  return { parts, total: figures.totalGain, addsUp: sumMoney(parts.map((part) => part.amount)) === figures.totalGain, tradingFees: figures.feesPaid }
}
