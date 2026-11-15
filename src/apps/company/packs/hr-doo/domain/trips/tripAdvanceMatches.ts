import { addDays } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { OwnerAdvance } from '../../../../workbook/domain/workbook'
import type { Employee } from '../employees/employees'
import type { Trip, TripCost } from './trip'
import type { TripFile } from './tripReading'

/** A cost the director paid on a trip that the owner-advances tab also holds as a cost the owner paid, so the company would pay it back twice. */
export interface TripCostPaidAsAdvance {
  readonly trip: Trip
  readonly cost: TripCost
  readonly advance: OwnerAdvance
}

/** How many days before the departure and after the return an owner advance still counts as near the trip, so a toll paid the day before or a receipt booked late still matches. */
const NEAR_TRIP_DAYS = 3

/** The trip's days: from the departure to the return, or to the order's last day while the traveller is not back. */
function tripDays(trip: Trip): { readonly from: CivilDate; readonly to: CivilDate } {
  return { from: trip.departs, to: trip.returned?.day ?? addDays(trip.departs, trip.days - 1) }
}

/** Each cost the director paid on their own trip beside an owner advance of the same amount, to the cent, whose day is near the trip. An advance may match more than one cost. */
export function tripCostsPaidAsAdvances(files: readonly TripFile[], advances: readonly OwnerAdvance[], director: Employee | null): TripCostPaidAsAdvance[] {
  if (director === null) return []
  const wholeAdvances = advances.filter((advance) => advance.ownerPart === undefined)
  return files
    .filter((file) => file.trip.traveller === director.slug)
    .flatMap((file) => {
      const { from, to } = tripDays(file.trip)
      const near = wholeAdvances.filter((advance) => addDays(from, -NEAR_TRIP_DAYS) <= advance.date && advance.date <= addDays(to, NEAR_TRIP_DAYS))
      return file.costs.filter((cost) => cost.paidBy === 'traveller').flatMap((cost) => near.filter((advance) => advance.amount === cost.amount).map((advance) => ({ trip: file.trip, cost, advance })))
    })
}
