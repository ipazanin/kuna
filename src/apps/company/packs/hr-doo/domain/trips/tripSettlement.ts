import { addDays } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { CurrencyCode } from '../../../../../../shared/money/currencyCode'
import { ZERO, addMoney, moneyFromCents, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { NO_RATES } from '../../../../../../shared/money/rateBook'
import type { RateBook } from '../../../../../../shared/money/rateBook'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { perDiemCurrency, perDiemsOf, waitsForRate } from './perDiems'
import type { PerDiemLine } from './perDiems'
import { HOME_COUNTRY, legKilometres } from './trip'
import type { Trip, TripCost } from './trip'
import type { TripFile } from './tripReading'

/** What a settlement still needs before Kuna can work it out. */
export type SettlementGap = 'times' | 'borders' | 'odometer' | 'rate'

/** The kilometres of a trip by private car, paid at the order's rate. */
export interface KilometresPaid {
  readonly km: number
  readonly rate: Money
  readonly amount: Money
}

/** A trip's settlement, the obračun: what the traveller is owed, less the advance. */
export interface WorkedSettlement {
  readonly kind: 'worked'
  readonly perDiemLines: readonly PerDiemLine[]
  readonly perDiems: Money
  /** Null for a trip not by private car. */
  readonly kilometres: KilometresPaid | null
  /** Costs the traveller paid, which the company pays back. */
  readonly travellerCosts: Money
  /** Costs the company paid itself, listed beside the settlement and never paid out. */
  readonly companyCosts: Money
  /** Per diems, kilometres and the traveller's costs. */
  readonly owed: Money
  /** Zero for an order without one. */
  readonly advance: Money
  /** What the company pays the traveller, or below zero what the traveller pays back. */
  readonly payout: Money
}

export type TripSettlement = WorkedSettlement | { readonly kind: 'waiting'; readonly gaps: readonly SettlementGap[] }

/** What a trip's settlement still needs: both times, the border times of a trip abroad, the odometer of a private car and the ECB rate of a per diem in dollars. */
export function settlementGaps(file: TripFile, rules: RuleSource, rates: RateBook): SettlementGap[] {
  const { trip } = file
  return [
    ...(trip.left === null || trip.returned === null ? (['times'] as const) : []),
    ...(trip.country !== HOME_COUNTRY && trip.abroad === null ? (['borders'] as const) : []),
    ...(trip.transport === 'private-car' && trip.odometer === null ? (['odometer'] as const) : []),
    ...(waitsForRate(trip, rules, rates) ? (['rate'] as const) : []),
  ]
}

/** The costs the payer paid. */
export function costsPaidBy(costs: readonly TripCost[], payer: TripCost['paidBy']): readonly TripCost[] {
  return costs.filter((cost) => cost.paidBy === payer)
}

/** The settlement of a trip whose reader kept it, or what it still needs. */
export function tripSettlement(file: TripFile, rules: RuleSource, rates: RateBook = NO_RATES): TripSettlement {
  const gaps = settlementGaps(file, rules, rates)
  const worked = gaps.length === 0 ? perDiemsOf(file.trip, rules, rates) : null
  if (worked === null) return { kind: 'waiting', gaps: gaps.length === 0 ? ['times'] : gaps }
  const { trip, legs, costs } = file
  const km = legKilometres(legs)
  const kilometres = trip.car === null ? null : { km, rate: trip.car.kmRate, amount: moneyFromCents(trip.car.kmRate * km) }
  const travellerCosts = sumMoney(costsPaidBy(costs, 'traveller').map((cost) => cost.amount))
  const companyCosts = sumMoney(costsPaidBy(costs, 'company').map((cost) => cost.amount))
  const owed = addMoney(addMoney(worked.total, kilometres?.amount ?? ZERO), travellerCosts)
  const advance = trip.advance ?? ZERO
  return { kind: 'worked', perDiemLines: worked.lines, perDiems: worked.total, kilometres, travellerCosts, companyCosts, owed, advance, payout: subtractMoney(owed, advance) }
}

/** A trip waits for its settlement once the traveller is back, or once its approved days are over on the day, until it is settled. */
export function waitsForSettlement(trip: Trip, asOf: CivilDate): boolean {
  return trip.settledOn === null && (trip.returned !== null || addDays(trip.departs, trip.days) <= asOf)
}

/** The ECB rates the trips' foreign per diems need: each currency other than the euro, from the earliest day a traveller left or departs for it. */
export function tripRatesDemand(trips: readonly Trip[], rules: RuleSource): ReadonlyMap<CurrencyCode, CivilDate> {
  const demand = new Map<CurrencyCode, CivilDate>()
  for (const trip of trips) {
    const currency = perDiemCurrency(trip, rules)
    const day = trip.left?.day ?? trip.departs
    const known = currency === null ? undefined : demand.get(currency)
    if (currency !== null && (known === undefined || day < known)) demand.set(currency, day)
  }
  return demand
}
