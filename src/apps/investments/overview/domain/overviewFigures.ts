import type { HoldingFigures } from '../../holdings/domain/holding'
import type { HoldingGroup } from '../../holdings/domain/holdingsList'
import { investmentLots, receivedInEuros } from '../../holdings/domain/lots'
import type { CashFigures, PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { civilDate, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'
import { ZERO, negateMoney, ratioOf, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

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

/** The five places the total gain comes from, in the order the Overview lists them. */
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

/** What a class of instrument or a currency holds, and its share of the value. */
export interface AllocationPart<Group extends string> {
  readonly group: Group
  readonly value: Money
  /** Null when the value is zero. */
  readonly share: number | null
}

/** The value by class, cash apart, largest first. Holdings with no price and cash with no rate are left out, as the value leaves them out. */
export function valueByClass(figures: PortfolioFigures): AllocationPart<HoldingGroup>[] {
  return allocation(figures, [
    ...figures.holdings.flatMap((holding) => (holding.valuation === null ? [] : [{ group: holding.instrument.class, value: holding.valuation.value }])),
    ...figures.cash.flatMap((balance) => (balance.value === null ? [] : [{ group: 'cash' as const, value: balance.value }])),
  ])
}

/** The value by the currency each holding is quoted in and each balance is held in, largest first. */
export function valueByCurrency(figures: PortfolioFigures): AllocationPart<CurrencyCode>[] {
  return allocation(figures, [
    ...figures.holdings.flatMap((holding) => (holding.valuation === null ? [] : [{ group: holding.instrument.currency, value: holding.valuation.value }])),
    ...figures.cash.flatMap((balance) => (balance.value === null ? [] : [{ group: balance.currency, value: balance.value }])),
  ])
}

function allocation<Group extends string>(figures: PortfolioFigures, values: readonly { readonly group: Group; readonly value: Money }[]): AllocationPart<Group>[] {
  const totals = new Map<Group, Money>()
  for (const { group, value } of values) {
    totals.set(group, sumMoney([totals.get(group) ?? ZERO, value]))
  }
  return [...totals]
    .filter(([, value]) => value !== ZERO)
    .map(([group, value]): AllocationPart<Group> => ({ group, value, share: ratioOf(value, figures.value) }))
    .sort((first, second) => second.value - first.value || first.group.localeCompare(second.group))
}

export interface Movers {
  /** Largest rise first. */
  readonly up: readonly HoldingFigures[]
  /** Largest fall first. */
  readonly down: readonly HoldingFigures[]
}

/** The holdings that rose and fell most by share on the last day, up to `count` each. A holding that did not move is in neither. */
export function lastDayMovers(figures: PortfolioFigures, count: number): Movers {
  const moved = figures.holdings.filter((holding) => holding.lastDay !== null && holding.lastDay.share !== null && holding.lastDay.change !== ZERO)
  const shareOf = (holding: HoldingFigures): number => holding.lastDay?.share ?? 0
  return {
    up: moved
      .filter((holding) => shareOf(holding) > 0)
      .sort((first, second) => shareOf(second) - shareOf(first))
      .slice(0, count),
    down: moved
      .filter((holding) => shareOf(holding) < 0)
      .sort((first, second) => shareOf(first) - shareOf(second))
      .slice(0, count),
  }
}

/** Income received so far this year against the same part of last year. */
export interface IncomeAgainstLastYear {
  readonly year: number
  readonly thisYear: Money
  /** From 1 January of last year to the same day a year before the figures' day. */
  readonly sameMonthsLastYear: Money
  readonly change: Money
}

/** Each payment after its tax withheld, without the part of a coupon that paid back accrued interest bought with the bond. */
export function incomeAgainstLastYear(book: InvestmentBook, today: CivilDate): IncomeAgainstLastYear {
  const paidBack = new Map([...investmentLots(book).values()].flatMap((lots) => [...lots.paidBack]))
  const received = (from: CivilDate, to: CivilDate): Money => sumMoney(book.income.filter((payment) => payment.date >= from && payment.date <= to).map((payment) => receivedInEuros(payment, paidBack)))
  const year = yearOf(today)
  const thisYear = received(civilDate(year, 1, 1), today)
  const sameMonthsLastYear = received(civilDate(year - 1, 1, 1), dayMonthsLater(today, -12))
  return { year, thisYear, sameMonthsLastYear, change: subtractMoney(thisYear, sameMonthsLastYear) }
}
