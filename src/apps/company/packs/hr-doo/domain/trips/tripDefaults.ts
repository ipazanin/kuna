import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { Money } from '../../../../../../shared/money/money'
import { nextYearlyNumber } from '../../../../documents/domain/yearlyNumber'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { HOME_COUNTRY } from './trip'
import type { PrivateCar, Transport, Trip } from './trip'

/** Travel orders are numbered by issue year, such as `3/2026`. */
export const TRIP_NUMBER_PATTERN = '{n}/{yyyy}'

/** The number after the highest of the issue year. A deleted order leaves its number as a gap. */
export function nextTripNumber(issued: CivilDate, trips: readonly Trip[]): string {
  return nextYearlyNumber(TRIP_NUMBER_PATTERN, issued, trips)
}

/** What a new order starts with: the traveller's last order, else a trip at home, with a private car paid at the tax-free cap. */
export interface TripDefaults {
  readonly role: string
  readonly country: string
  readonly transport: Transport
  readonly car: PrivateCar | null
  /** The tax-free rate per kilometre on the day, which a new private car is paid by. */
  readonly kmRateCap: Money | null
}

/** The tax-free rate per kilometre of a private car on the day. */
export function kmRateCapOn(day: CivilDate, rules: RuleSource): Money | null {
  return rules('hr.pit.nontaxable-caps', day).value.caps.rows.find((row) => row.payment.text === 'private-car-business-travel')?.cap?.cents ?? null
}

/** The fields a new order for this traveller starts with, from their most recently issued order. */
export function tripDefaults(traveller: string, issued: CivilDate, trips: readonly Trip[], rules: RuleSource): TripDefaults {
  const last = trips.filter((trip) => trip.traveller === traveller).reduce<Trip | null>((latest, trip) => (latest === null || trip.issued >= latest.issued ? trip : latest), null)
  return {
    role: last?.role ?? '',
    country: last?.country ?? HOME_COUNTRY,
    transport: last?.transport ?? 'private-car',
    car: last?.car ?? null,
    kmRateCap: kmRateCapOn(issued, rules),
  }
}
