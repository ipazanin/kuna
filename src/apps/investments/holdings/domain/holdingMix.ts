import { exposureOf } from './exposure'
import type { ExposureMix } from './exposure'
import type { HoldingFigures } from './holding'
import { heldHoldings } from './holdingsList'
import type { PortfolioFigures } from './portfolioFigures'
import type { FactsBook } from '../../prices/domain/factsBook'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { Mix, MixGroup } from '../../workbook/domain/mixGroup'
import { DECIMAL_ZERO, moneyParts } from '../../../../shared/money/decimal'
import { ZERO, ratioOf, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { Share } from '../../../../shared/money/percent'

export type GroupOf<Of extends Mix> = Extract<MixGroup, { readonly mix: Of }>['group']

/** What one group of a mix holds, and its share of the whole the mix splits. */
export interface MixPart<Group extends string> {
  readonly group: Group
  readonly value: Money
  /** Null when the whole is zero. */
  readonly share: Share | null
}

export interface HoldingMix<Of extends Mix> {
  readonly mix: Of
  /** Largest first. A group whose value adds up to zero is left out. */
  readonly parts: readonly MixPart<GroupOf<Of>>[]
  /** What the shares are of: the holdings alone for sector and country, else the whole value with its cash. */
  readonly whole: Money
  /** The value of the holdings no source puts in a group yet. Zero for class, currency and account. */
  readonly unknown: Money
  /** The holdings held that no source puts in a group yet, largest first and those with no price last. */
  readonly missing: readonly HoldingFigures[]
}

interface Valued {
  readonly group: GroupOf<Mix>
  readonly value: Money
}

/**
 * The value split by sector, country or region, class, currency or account. Sector and country split the holdings
 * alone by `exposureOf`, a fund over the groups of its own mix or of the weights a vendor gave. Class and currency take each holding whole, by its
 * class and its trading currency, and the cash by its currency. A holding in several accounts splits by its units
 * there, the last account taking the rest. Holdings with no price and cash with no rate are left out, as the value
 * leaves them out.
 */
export function holdingMix<Of extends Mix>(figures: PortfolioFigures, book: InvestmentBook, facts: FactsBook, mix: Of): HoldingMix<Of> {
  const split = mix === 'sector' || mix === 'country' ? exposureSplit(figures, book, facts, mix) : wholeSplit(figures, mix)
  return { mix, ...split } as HoldingMix<Of>
}

/** Every mix of the value at once, by its kind. */
export type HoldingMixes = Readonly<Record<Mix, HoldingMix<Mix>>>

export function holdingMixes(figures: PortfolioFigures, book: InvestmentBook, facts: FactsBook): HoldingMixes {
  const of = (mix: Mix): HoldingMix<Mix> => holdingMix(figures, book, facts, mix)
  return { sector: of('sector'), currency: of('currency'), country: of('country'), class: of('class'), account: of('account') }
}

function exposureSplit(figures: PortfolioFigures, book: InvestmentBook, facts: FactsBook, mix: ExposureMix): Omit<HoldingMix<Mix>, 'mix'> {
  const placed = heldHoldings(figures).map((holding) => ({ holding, value: holding.valuation?.value ?? null, exposure: exposureOf(holding.instrument, mix, book, facts).lines }))
  const values = placed.flatMap(({ value, exposure }): Valued[] => {
    if (value === null) return []
    const parts = moneyParts(
      value,
      exposure.map((line) => line.percent),
    )
    return exposure.map((line, index) => ({ group: line.group, value: parts[index] ?? ZERO }))
  })
  const unknown = placed.filter(({ exposure }) => exposure.length === 0)
  const whole = sumMoney(placed.flatMap(({ value }) => (value === null ? [] : [value])))
  return {
    parts: partsOf(values, whole),
    whole,
    unknown: sumMoney(unknown.flatMap(({ value }) => (value === null ? [] : [value]))),
    missing: unknown.sort((first, second) => (second.value ?? -Infinity) - (first.value ?? -Infinity)).map(({ holding }) => holding),
  }
}

function wholeSplit(figures: PortfolioFigures, mix: Exclude<Mix, ExposureMix>): Omit<HoldingMix<Mix>, 'mix'> {
  const priced = figures.holdings.flatMap((holding) => (holding.valuation === null ? [] : [{ holding, value: holding.valuation.value }]))
  const cash = figures.cash.flatMap((balance) => (balance.value === null ? [] : [{ balance, value: balance.value }]))
  const values: Valued[] =
    mix === 'class'
      ? [...priced.map(({ holding, value }) => ({ group: holding.instrument.class, value })), ...cash.map(({ value }) => ({ group: 'cash' as const, value }))]
      : mix === 'currency'
        ? [...priced.map(({ holding, value }) => ({ group: holding.instrument.currency, value })), ...cash.map(({ balance, value }) => ({ group: balance.currency, value }))]
        : [...priced.flatMap(({ holding, value }) => byAccount(holding, value)), ...cash.map(({ balance, value }) => ({ group: balance.account, value }))]
  return { parts: partsOf(values, figures.value), whole: figures.value, unknown: ZERO, missing: [] }
}

/** A holding's value split over the accounts that hold its units, in the order they first held them. */
function byAccount(holding: HoldingFigures, value: Money): Valued[] {
  const accounts = [...holding.units].filter(([, units]) => units > DECIMAL_ZERO)
  const parts = moneyParts(
    value,
    accounts.map(([, units]) => units),
  )
  return accounts.map(([account], index) => ({ group: account, value: parts[index] ?? ZERO }))
}

function partsOf(values: readonly Valued[], whole: Money): MixPart<GroupOf<Mix>>[] {
  const totals = new Map<GroupOf<Mix>, Money>()
  for (const { group, value } of values) {
    totals.set(group, sumMoney([totals.get(group) ?? ZERO, value]))
  }
  return [...totals]
    .filter(([, value]) => value !== ZERO)
    .map(([group, value]) => ({ group, value, share: ratioOf(value, whole) }))
    .sort((first, second) => second.value - first.value || first.group.localeCompare(second.group))
}
