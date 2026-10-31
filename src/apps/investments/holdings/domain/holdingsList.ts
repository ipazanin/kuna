import { dayChange } from './holding'
import type { DayChange, HoldingFigures } from './holding'
import type { CashFigures, PortfolioFigures } from './portfolioFigures'
import type { InstrumentClass } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'
import { ZERO, ratioOf, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { fold } from '../../../../shared/text/fold'
import { naturalOrder } from '../../../../shared/text/naturalOrder'

/** A class of instrument, or the cash of every account. */
export type HoldingGroup = InstrumentClass | 'cash'

export const HOLDINGS_GROUPINGS = ['class', 'currency', 'none'] as const

export type HoldingsGrouping = (typeof HOLDINGS_GROUPINGS)[number]

export const HOLDINGS_COLUMNS = ['name', 'cost', 'value', 'gain', 'weight', 'last-day'] as const

export type HoldingsColumn = (typeof HOLDINGS_COLUMNS)[number]

export interface HoldingsSort {
  readonly column: HoldingsColumn
  readonly descending: boolean
}

/** How the Holdings screen lists them: grouped or not, narrowed by a search, with or without what was sold, in a column's order. */
export interface HoldingsView {
  readonly grouping: HoldingsGrouping
  /** Matches a holding's name, symbol or ISIN, and a balance's account or currency, whatever the case and accents. */
  readonly find: string
  readonly sold: boolean
  /** Null for the list's own order: holdings by value, largest first, then the cash as the accounts come. */
  readonly sort: HoldingsSort | null
}

export type HoldingsLine =
  | {
      readonly kind: 'holding'
      readonly holding: HoldingFigures
      /** The gain on what is held over its cost. */
      readonly gainShare: number | null
    }
  | {
      readonly kind: 'cash'
      readonly balance: CashFigures
      readonly account: string
      readonly weight: number | null
    }
  /** Nothing is held of it any more. Its gain is what its sales realised. */
  | { readonly kind: 'sold'; readonly holding: HoldingFigures }

/** The sums over some lines. Cash has a value but no cost or gain, and a sold holding a realised gain only. */
export interface HoldingsTotals {
  readonly value: Money
  readonly cost: Money
  /** The holdings' gain on what is held, or for sold holdings what they realised. Null when no line has one. */
  readonly gain: Money | null
  /** The gain over the cost of the lines that have one. Null for sold holdings. */
  readonly gainShare: number | null
  readonly weight: number | null
  readonly lastDay: DayChange | null
}

export interface HoldingsGroup extends HoldingsTotals {
  /** A class of instrument, `cash`, a currency, `sold`, or `all` when nothing is grouped. */
  readonly key: HoldingGroup | CurrencyCode | 'sold' | 'all'
  /** How many of its lines are holdings rather than cash. */
  readonly holdings: number
  readonly lines: readonly HoldingsLine[]
}

export interface HoldingsList {
  readonly groups: readonly HoldingsGroup[]
  /** Over every group but the sold holdings. */
  readonly total: HoldingsTotals
}

/** The holdings held now, which the Holdings menu item counts. */
export function heldHoldings(figures: PortfolioFigures): HoldingFigures[] {
  return figures.holdings.filter((holding) => holding.quantity > DECIMAL_ZERO)
}

/**
 * Every holding held and each account's cash per currency, grouped by class with the cash apart, by currency with the
 * cash of each currency in it, or not at all. Groups come largest first, with the cash last when grouped by class and
 * the sold holdings after everything.
 */
export function holdingsList(figures: PortfolioFigures, book: InvestmentBook, view: HoldingsView): HoldingsList {
  const accountName = new Map(book.accounts.map((account) => [account.id, account.name]))
  const held: HoldingsLine[] = heldHoldings(figures).map((holding) => ({ kind: 'holding', holding, gainShare: holding.unrealised === null ? null : ratioOf(holding.unrealised, holding.cost) }))
  const cash: HoldingsLine[] = figures.cash
    .filter((balance) => balance.balance !== DECIMAL_ZERO)
    .map((balance) => ({ kind: 'cash', balance, account: accountName.get(balance.account) ?? '', weight: balance.value === null ? null : ratioOf(balance.value, figures.value) }))
  const sold: HoldingsLine[] = view.sold ? figures.holdings.filter((holding) => holding.quantity === DECIMAL_ZERO && holding.firstAcquired !== null).map((holding) => ({ kind: 'sold', holding })) : []
  const found = (line: HoldingsLine): boolean => matches(line, fold(view.find))
  const grouped = groupsOf(view.grouping, held.filter(found), cash.filter(found))
  const groups = [...grouped.map(([key, lines]) => groupOf(key, lines, figures)), ...(sold.some(found) ? [groupOf('sold', sold.filter(found), figures)] : [])]
    .filter((group) => group.lines.length > 0)
    .map((group) => ({ ...group, lines: ordered(group.lines, view.sort) }))
  return {
    groups,
    total: totalsOf(
      groups.filter((group) => group.key !== 'sold').flatMap((group) => group.lines),
      figures,
    ),
  }
}

function groupsOf(grouping: HoldingsGrouping, held: readonly HoldingsLine[], cash: readonly HoldingsLine[]): [HoldingsGroup['key'], HoldingsLine[]][] {
  if (grouping === 'none') {
    return [['all', [...held, ...cash]]]
  }
  const byKey = new Map<HoldingsGroup['key'], HoldingsLine[]>()
  const add = (key: HoldingsGroup['key'], line: HoldingsLine): void => {
    byKey.set(key, [...(byKey.get(key) ?? []), line])
  }
  for (const line of held) {
    if (line.kind === 'holding') add(grouping === 'class' ? line.holding.instrument.class : line.holding.instrument.currency, line)
  }
  for (const line of cash) {
    if (line.kind === 'cash') add(grouping === 'class' ? 'cash' : line.balance.currency, line)
  }
  const valueOf = (lines: readonly HoldingsLine[]): Money => sumMoney(lines.map(lineValue).filter((value) => value !== null))
  return [...byKey]
    .filter(([key]) => key !== 'cash')
    .sort(([firstKey, first], [secondKey, second]) => valueOf(second) - valueOf(first) || firstKey.localeCompare(secondKey))
    .concat([...byKey].filter(([key]) => key === 'cash'))
}

function groupOf(key: HoldingsGroup['key'], lines: readonly HoldingsLine[], figures: PortfolioFigures): HoldingsGroup {
  return { key, holdings: lines.filter((line) => line.kind !== 'cash').length, lines, ...totalsOf(lines, figures) }
}

function totalsOf(lines: readonly HoldingsLine[], figures: PortfolioFigures): HoldingsTotals {
  const value = sumMoney(lines.map(lineValue).filter((amount) => amount !== null))
  const holdings = lines.flatMap((line) => (line.kind === 'holding' ? [line.holding] : []))
  const gained = holdings.filter((holding) => holding.unrealised !== null)
  const realised = lines.flatMap((line) => (line.kind === 'sold' ? [line.holding.realised] : []))
  const gain = gained.length > 0 ? sumMoney(gained.map((holding) => holding.unrealised ?? ZERO)) : realised.length > 0 ? sumMoney(realised) : null
  const changes = lines.map(lineLastDay).filter((change) => change !== null)
  return {
    value,
    cost: sumMoney(holdings.map((holding) => holding.cost)),
    gain,
    gainShare: gained.length === 0 || gain === null ? null : ratioOf(gain, sumMoney(gained.map((holding) => holding.cost))),
    weight: realised.length === lines.length ? null : ratioOf(value, figures.value),
    lastDay: changes.length === 0 ? null : dayChange(sumMoney(changes.map((change) => change.earlier)), sumMoney(changes.map((change) => change.later))),
  }
}

function matches(line: HoldingsLine, query: string): boolean {
  if (query === '') {
    return true
  }
  const texts = line.kind === 'cash' ? [line.account, line.balance.currency] : [line.holding.instrument.name, line.holding.instrument.symbol, line.holding.instrument.isin ?? '']
  return texts.some((text) => fold(text).includes(query))
}

function lineValue(line: HoldingsLine): Money | null {
  return line.kind === 'holding' ? (line.holding.valuation?.value ?? null) : line.kind === 'cash' ? line.balance.value : null
}

function lineLastDay(line: HoldingsLine): DayChange | null {
  return line.kind === 'holding' ? line.holding.lastDay : line.kind === 'cash' ? line.balance.lastDay : null
}

function lineName(line: HoldingsLine): string {
  return line.kind === 'cash' ? line.account : line.holding.instrument.name
}

/** What a column orders a line by. Null sorts last whichever the direction. */
function sortKey(line: HoldingsLine, column: Exclude<HoldingsColumn, 'name'>): number | null {
  switch (column) {
    case 'cost':
      return line.kind === 'holding' ? line.holding.cost : null
    case 'value':
      return lineValue(line)
    case 'gain':
      return line.kind === 'holding' ? line.holding.unrealised : line.kind === 'sold' ? line.holding.realised : null
    case 'weight':
      return line.kind === 'holding' ? line.holding.weight : line.kind === 'cash' ? line.weight : null
    case 'last-day':
      return lineLastDay(line)?.share ?? null
  }
}

function ordered(lines: readonly HoldingsLine[], sort: HoldingsSort | null): HoldingsLine[] {
  const placed = lines.map((line, place) => ({ line, place }))
  if (sort === null) {
    const rank = (line: HoldingsLine): number => (line.kind === 'cash' ? 1 : 0)
    return placed
      .sort((first, second) => rank(first.line) - rank(second.line) || byKey(sortKey(first.line, 'value'), sortKey(second.line, 'value'), true) || first.place - second.place)
      .map(({ line }) => line)
  }
  const { column, descending } = sort
  return placed
    .sort((first, second) => {
      const order = column === 'name' ? naturalOrder(lineName(first.line), lineName(second.line)) * (descending ? -1 : 1) : byKey(sortKey(first.line, column), sortKey(second.line, column), descending)
      return order || first.place - second.place
    })
    .map(({ line }) => line)
}

function byKey(first: number | null, second: number | null, descending: boolean): number {
  if (first === null || second === null) {
    return first === second ? 0 : first === null ? 1 : -1
  }
  return descending ? second - first : first - second
}
