import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { countryName } from '../../../../../../shared/text/countryName'
import { foreignPerDiemRow, perDiemLineCount } from './perDiems'
import { HOME_COUNTRY, legKilometres } from './trip'
import type { Trip, TripLeg } from './trip'
import { MINUTES_IN_DAY, minutesBetween } from './tripMoment'

/** Why the trips reader leaves a trip, a leg or a cost out, as a fact the screens and the chat word. */
export type TripProblem =
  | { readonly kind: 'number-twice'; readonly number: string }
  | { readonly kind: 'no-traveller'; readonly traveller: string }
  | { readonly kind: 'unknown-country'; readonly country: string }
  | { readonly kind: 'returned-without-left' }
  | { readonly kind: 'returned-before-left' }
  | { readonly kind: 'abroad-needs-borders' }
  | { readonly kind: 'borders-at-home' }
  | { readonly kind: 'borders-out-of-order' }
  | { readonly kind: 'borders-outside-trip' }
  | { readonly kind: 'too-many-days'; readonly days: number; readonly longest: number }
  | { readonly kind: 'lasted-too-long'; readonly longest: number }
  | { readonly kind: 'car-without-private-car' }
  | { readonly kind: 'private-car-needs-car' }
  | { readonly kind: 'private-car-needs-odometer' }
  | { readonly kind: 'legs-beyond-odometer'; readonly legs: number; readonly driven: number }
  | { readonly kind: 'meals-without-times' }
  | { readonly kind: 'too-many-meals'; readonly meals: number; readonly lines: number }
  | { readonly kind: 'settled-without-times' }
  | { readonly kind: 'settled-without-report' }
  | { readonly kind: 'no-trip' }

/** The traveller is on the employees tab. */
export function travellerProblem(trip: Trip, employees: ReadonlySet<string>): TripProblem | null {
  return employees.has(trip.traveller) ? null : { kind: 'no-traveller', traveller: trip.traveller }
}

/** A trip abroad goes to a country by its two-letter code, which the per-diem table lists or pays as every other country. */
export function countryProblem(trip: Trip, rules: RuleSource): TripProblem | null {
  if (trip.country === HOME_COUNTRY) return null
  const known = /^[A-Z]{2}$/.test(trip.country) && countryName(trip.country) !== trip.country
  return known && foreignPerDiemRow(trip.country, trip.left?.day ?? trip.departs, rules) !== null ? null : { kind: 'unknown-country', country: trip.country }
}

/** The traveller comes back after leaving. */
export function orderOfTimesProblem(trip: Trip): TripProblem | null {
  if (trip.returned !== null && trip.left === null) return { kind: 'returned-without-left' }
  return trip.left !== null && trip.returned !== null && minutesBetween(trip.left, trip.returned) <= 0 ? { kind: 'returned-before-left' } : null
}

/** Border times belong to a trip abroad, in order, inside the trip, and a settled trip abroad has them. */
export function abroadProblem(trip: Trip): TripProblem | null {
  const { abroad, left, returned } = trip
  if (abroad === null) return trip.country !== HOME_COUNTRY && trip.settledOn !== null ? { kind: 'abroad-needs-borders' } : null
  if (trip.country === HOME_COUNTRY) return { kind: 'borders-at-home' }
  if (minutesBetween(abroad.out, abroad.back) <= 0) return { kind: 'borders-out-of-order' }
  if (left === null || returned === null) return null
  return minutesBetween(left, abroad.out) < 0 || minutesBetween(abroad.back, returned) < 0 ? { kind: 'borders-outside-trip' } : null
}

/** An order approves, and a trip lasts, no more days in a row than the law allows. */
export function lengthProblem(trip: Trip, rules: RuleSource): TripProblem | null {
  const longest = rules('hr.pit.business-trip', trip.left?.day ?? trip.departs).value.longestTripDays.count
  if (trip.days > longest) return { kind: 'too-many-days', days: trip.days, longest }
  const lasted = trip.left === null || trip.returned === null ? 0 : minutesBetween(trip.left, trip.returned)
  return lasted > longest * MINUTES_IN_DAY ? { kind: 'lasted-too-long', longest } : null
}

/** A private car has its make, plate and rate, a settled trip by private car its odometer, and no other transport any of them. */
export function carProblem(trip: Trip): TripProblem | null {
  if (trip.transport !== 'private-car') return trip.car === null && trip.odometer === null ? null : { kind: 'car-without-private-car' }
  if (trip.car === null || trip.car.make === '' || trip.car.plate === '') return { kind: 'private-car-needs-car' }
  return trip.settledOn !== null && trip.odometer === null ? { kind: 'private-car-needs-odometer' } : null
}

/** The legs of a trip by private car add up to no more than its odometer shows. */
export function odometerProblem(trip: Trip, legs: readonly TripLeg[]): TripProblem | null {
  if (trip.odometer === null) return null
  const driven = trip.odometer.end - trip.odometer.start
  const legsKm = legKilometres(legs)
  return legsKm > driven ? { kind: 'legs-beyond-odometer', legs: legsKm, driven } : null
}

/** The meals list has no more entries than the per-diem table has lines. */
export function mealsProblem(trip: Trip, rules: RuleSource): TripProblem | null {
  if (trip.meals.length === 0) return null
  const lines = perDiemLineCount(trip, rules)
  if (lines === null) return { kind: 'meals-without-times' }
  return trip.meals.length > lines ? { kind: 'too-many-meals', meals: trip.meals.length, lines } : null
}

/** A settled trip has both times and the traveller's report. */
export function reportProblem(trip: Trip): TripProblem | null {
  if (trip.settledOn === null) return null
  if (trip.left === null || trip.returned === null) return { kind: 'settled-without-times' }
  return trip.report.trim() === '' ? { kind: 'settled-without-report' } : null
}

/** A leg or a cost names a trip that counts. */
export function tripOfChildProblem(child: { readonly trip: RecordId }, trips: ReadonlySet<RecordId>): TripProblem | null {
  return trips.has(child.trip) ? null : { kind: 'no-trip' }
}
