import type { HoldingFigures } from '../../holdings/domain/holding'
import { lotIsTaxFree, taxFreeFrom } from '../../holdings/domain/lots'
import type { Lot } from '../../holdings/domain/lots'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { moneyParts } from '../../../../shared/money/decimal'
import { subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

export interface TaxFreeLot {
  readonly holding: HoldingFigures
  readonly lot: Lot
  /** Where the lot stands in the holding's lots, as two lots can open on one day. */
  readonly place: number
  /** The lot's share of the holding's value by its units, null while the holding has no price. */
  readonly value: Money | null
  readonly gain: Money | null
}

export interface TaxFreeMonth {
  readonly month: MonthKey
  readonly lots: readonly TaxFreeLot[]
}

/** The open lots not yet tax-free on the day, up to one bought that day, by the month they turn tax-free, soonest first. */
export function taxFreeCalendar(figures: PortfolioFigures, today: CivilDate): TaxFreeMonth[] {
  const until = taxFreeFrom(today)
  const lots = figures.holdings
    .flatMap((holding) => {
      const values =
        holding.valuation === null
          ? null
          : moneyParts(
              holding.valuation.value,
              holding.lots.map((lot) => lot.quantity),
            )
      return holding.lots.map((lot, place): TaxFreeLot => {
        const value = values?.[place] ?? null
        return { holding, lot, place, value, gain: value === null ? null : subtractMoney(value, lot.cost) }
      })
    })
    .filter(({ lot }) => !lotIsTaxFree(lot, today) && lot.taxFreeFrom <= until)
    .sort((first, second) => first.lot.taxFreeFrom.localeCompare(second.lot.taxFreeFrom) || first.holding.instrument.name.localeCompare(second.holding.instrument.name))
  const months = new Map<MonthKey, TaxFreeLot[]>()
  for (const entry of lots) {
    const month = monthOf(entry.lot.taxFreeFrom)
    months.set(month, [...(months.get(month) ?? []), entry])
  }
  return [...months].map(([month, monthLots]) => ({ month, lots: monthLots }))
}

export function isAtALoss(entry: TaxFreeLot): boolean {
  return entry.gain !== null && entry.gain < 0
}
