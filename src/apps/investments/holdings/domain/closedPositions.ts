import type { HoldingFigures } from './holding'
import type { PortfolioFigures } from './portfolioFigures'
import type { Instrument } from '../../workbook/domain/instrument'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { DECIMAL_ZERO, sumDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ratioOf, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { naturalOrder } from '../../../../shared/text/naturalOrder'
import type { Share } from '../../../../shared/money/percent'

/** An instrument nothing is held of any more, from its first units to its last sale. The money figures are in euros. */
export interface ClosedPosition {
  readonly instrument: Instrument
  /**
   * The units its sales closed. Every unit it got, by a buy or in a spin-off, was sold, so they are also the units bought
   * once any split is counted in.
   */
  readonly units: Decimal
  /** What the sold units cost, fees included. */
  readonly cost: Money
  /** What the sales brought in after their fees. */
  readonly proceeds: Money
  readonly realised: Money
  /** The realised gain over the cost, null for a cost of zero. */
  readonly realisedShare: Share | null
  /** Received after the tax withheld while it was held. */
  readonly income: Money
  readonly firstBought: CivilDate
  readonly lastSold: CivilDate
  /** The days from each lot's buy to its sale, weighted by its units and rounded to a whole day. */
  readonly daysHeld: number
}

export const CLOSED_COLUMNS = ['name', 'cost', 'proceeds', 'realised', 'income', 'held', 'last-sold'] as const

export type ClosedColumn = (typeof CLOSED_COLUMNS)[number]

export interface ClosedSort {
  readonly column: ClosedColumn
  readonly descending: boolean
}

/** One row per instrument with nothing held and a sale, the latest sold first. */
export function closedPositions(figures: PortfolioFigures): ClosedPosition[] {
  return figures.holdings
    .flatMap((holding) => (holding.quantity === DECIMAL_ZERO && holding.sales.length > 0 && holding.firstAcquired !== null ? [closedPosition(holding, holding.firstAcquired.date)] : []))
    .sort((first, second) => second.lastSold.localeCompare(first.lastSold) || naturalOrder(first.instrument.name, second.instrument.name))
}

function closedPosition(holding: HoldingFigures, firstBought: CivilDate): ClosedPosition {
  const lines = holding.sales.flatMap((sale) => sale.lines)
  const units = sumDecimal(lines.map((line) => line.quantity))
  const cost = sumMoney(lines.map((line) => line.cost))
  const realised = sumMoney(lines.map((line) => line.gain))
  const lastSold = holding.sales.map((sale) => sale.trade.date).reduce((latest, date) => (date > latest ? date : latest))
  const weightedDays = lines.reduce((sum, line) => sum + line.quantity * BigInt(line.daysHeld), 0n)
  return {
    instrument: holding.instrument,
    units,
    cost,
    proceeds: sumMoney(lines.map((line) => subtractMoney(line.proceeds, line.fees))),
    realised,
    realisedShare: ratioOf(realised, cost),
    income: holding.income,
    firstBought,
    lastSold,
    daysHeld: units === DECIMAL_ZERO ? 0 : Number((weightedDays * 2n + units) / (units * 2n)),
  }
}

/** The rows in a column's order, or as they come for no sort. A tie keeps the rows' own order. */
export function sortedPositions(positions: readonly ClosedPosition[], sort: ClosedSort | null): ClosedPosition[] {
  if (sort === null) {
    return [...positions]
  }
  const { column, descending } = sort
  const direction = descending ? -1 : 1
  return positions
    .map((position, place) => ({ position, place }))
    .sort((first, second) => direction * compared(first.position, second.position, column) || first.place - second.place)
    .map(({ position }) => position)
}

function compared(first: ClosedPosition, second: ClosedPosition, column: ClosedColumn): number {
  switch (column) {
    case 'name':
      return naturalOrder(first.instrument.name, second.instrument.name)
    case 'cost':
      return first.cost - second.cost
    case 'proceeds':
      return first.proceeds - second.proceeds
    case 'realised':
      return first.realised - second.realised
    case 'income':
      return first.income - second.income
    case 'held':
      return first.daysHeld - second.daysHeld
    case 'last-sold':
      return first.lastSold.localeCompare(second.lastSold)
  }
}
