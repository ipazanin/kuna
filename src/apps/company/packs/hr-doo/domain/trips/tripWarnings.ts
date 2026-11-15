import type { Money } from '../../../../../../shared/money/money'
import type { OwnerAdvance } from '../../../../workbook/domain/workbook'
import type { Employee } from '../employees/employees'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { kmRateCapOn } from './tripDefaults'
import type { TripCost } from './trip'
import { tripCostsPaidAsAdvances } from './tripAdvanceMatches'
import type { TripFile } from './tripReading'

/** Something on a trip worth a second look that the law does not forbid outright, so the trip still counts. */
export type TripWarning =
  /** The part of the rate over the tax-free cap is taxed as salary. */
  | { readonly kind: 'km-rate-over-cap'; readonly rate: Money; readonly cap: Money }
  /** A business trip goes at least the law's distance from where the traveller lives. */
  | { readonly kind: 'first-leg-short'; readonly km: number; readonly shortest: number }
  /** The traveller is not employed on the trip's first day, such as a board member who is not employed, which the law's caps may not cover. */
  | { readonly kind: 'not-employed' }
  /** A cost the director paid that the owner-advances tab also holds, so the company would pay it back twice. */
  | { readonly kind: 'paid-as-owner-advance'; readonly cost: TripCost; readonly advance: OwnerAdvance }
  /** Fuel on a trip by private car, whose kilometres already pay for the car (PravPDoh Art. 7(29)), so the fuel is not tax-free beside them. */
  | { readonly kind: 'fuel-with-kilometres'; readonly cost: TripCost }

/** The warnings of one trip, with the traveller as the employees tab holds them, and the owner advances and the director a cost the owner paid privately is matched against. */
export function tripWarnings(file: TripFile, traveller: Employee | null, rules: RuleSource, advances: readonly OwnerAdvance[], director: Employee | null): TripWarning[] {
  const { trip } = file
  const day = trip.left?.day ?? trip.departs
  const warnings: TripWarning[] = []
  const cap = kmRateCapOn(day, rules)
  if (trip.car !== null && cap !== null && trip.car.kmRate > cap) warnings.push({ kind: 'km-rate-over-cap', rate: trip.car.kmRate, cap })
  const shortest = rules('hr.pit.business-trip', day).value.shortestDistanceKm.count
  const first = file.legs[0]
  if (first !== undefined && first.km < shortest) warnings.push({ kind: 'first-leg-short', km: first.km, shortest })
  if (traveller !== null && (day < traveller.from || (traveller.to !== null && day > traveller.to))) warnings.push({ kind: 'not-employed' })
  if (trip.transport === 'private-car') warnings.push(...file.costs.filter((cost) => cost.kind === 'fuel').map((cost): TripWarning => ({ kind: 'fuel-with-kilometres', cost })))
  warnings.push(...tripCostsPaidAsAdvances([file], advances, director).map(({ cost, advance }): TripWarning => ({ kind: 'paid-as-owner-advance', cost, advance })))
  return warnings
}
