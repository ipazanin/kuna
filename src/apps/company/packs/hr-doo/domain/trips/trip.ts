import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { CurrencyCode } from '../../../../../../shared/money/currencyCode'
import type { Decimal } from '../../../../../../shared/money/decimal'
import type { Money } from '../../../../../../shared/money/money'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import type { TripMoment } from './tripMoment'

/** How the traveller goes. Only a private car is paid by the kilometre, and it needs its make, plate and odometer. */
export const TRANSPORTS = ['private-car', 'company-car', 'plane', 'train', 'bus', 'other'] as const

export type Transport = (typeof TRANSPORTS)[number]

/** What a cost of a trip was for. */
export const TRIP_COST_KINDS = ['ticket', 'lodging', 'fuel', 'toll', 'parking', 'other'] as const

export type TripCostKind = (typeof TRIP_COST_KINDS)[number]

/** Who paid a cost: the traveller is paid back in the settlement, and a company payment is only listed beside it. */
export const TRIP_COST_PAYERS = ['traveller', 'company'] as const

export type TripCostPayer = (typeof TRIP_COST_PAYERS)[number]

/** The country code of a trip that stays in Croatia. */
export const HOME_COUNTRY = 'HR'

/** The key of the foreign per-diem row for every country the table does not list. */
export const OTHER_COUNTRIES = 'other'

/** The traveller's own car on the order: its make and plate, and the rate it is paid per kilometre. */
export interface PrivateCar {
  readonly make: string
  readonly plate: string
  readonly kmRate: Money
}

/** The odometer at the start and the end of a trip by private car. */
export interface Odometer {
  readonly start: number
  readonly end: number
}

/** A trip abroad as it crossed the border, or by air from take-off to landing. */
export interface Abroad {
  readonly out: TripMoment
  readonly back: TripMoment
}

/**
 * One travel order with its settlement, the putni nalog. The order is what was approved before the
 * trip, and the settlement fields fill in once the traveller is back.
 */
export interface Trip {
  readonly id: RecordId
  /** Such as `3/2026`, which the company proposes by issue year and the owner may change. */
  readonly number: string
  readonly issued: CivilDate
  /** The employee's short name on the employees tab. */
  readonly traveller: string
  /** The traveller's job, as the order names it. */
  readonly role: string
  readonly destination: string
  /** ISO 3166-1 alpha-2, `HR` for a trip at home. One foreign country per trip. */
  readonly country: string
  readonly task: string
  readonly departs: CivilDate
  /** The days the order approves, from 1 to the longest trip the law allows. */
  readonly days: number
  readonly transport: Transport
  /** Null unless the transport is a private car. */
  readonly car: PrivateCar | null
  readonly advance: Money | null
  readonly settleBy: CivilDate | null
  readonly left: TripMoment | null
  readonly returned: TripMoment | null
  /** Null for a trip at home, or one abroad whose times are not filled yet. */
  readonly abroad: Abroad | null
  readonly odometer: Odometer | null
  /** Meals the company or a host paid, one count per line of the per-diem table, from 0 to 2. */
  readonly meals: readonly number[]
  /** The traveller's report on the trip, which a settled trip needs. */
  readonly report: string
  readonly settledOn: CivilDate | null
  readonly note: string
  /** The items of the payment that paid the advance, as a person linked them or the settlement filed them. */
  readonly advanceItems: readonly RecordId[]
  /** The items of the payment that paid out the settlement, as a person linked them or the settlement filed them. */
  readonly payoutItems: readonly RecordId[]
  /** Items of payments Kuna offered for a link that a person said are not this trip's. */
  readonly dismissedItems: readonly RecordId[]
  /** In books from before items: the row id of the ledger row that paid the advance, every item of which the link names. */
  readonly advanceRow: string | null
  /** In books from before items: the row id of the ledger row that paid out the settlement, every item of which the link names. */
  readonly payoutRow: string | null
  /** In books from before items: row ids of payments a person set aside, every item of which the trip sets aside. */
  readonly dismissedRows: readonly string[]
  /** The day a person marked the trip's JOPPD code 17 line as reported, or null while it is not. */
  readonly reportedOn: CivilDate | null
}

/** One drive or ride of a trip, which a private car is paid by. */
export interface TripLeg {
  readonly id: RecordId
  readonly trip: RecordId
  readonly date: CivilDate
  readonly from: string
  readonly to: string
  /** Whole kilometres. */
  readonly km: number
}

/** The kilometres the legs add up to. */
export function legKilometres(legs: readonly TripLeg[]): number {
  return legs.reduce((sum, leg) => sum + leg.km, 0)
}

/** A foreign amount as the receipt states it, beside the euros the cost counts in. */
export interface ForeignAmount {
  readonly amount: Decimal
  readonly currency: CurrencyCode
}

/** A ticket, a night or another cost of a trip, with who paid it. */
export interface TripCost {
  readonly id: RecordId
  readonly trip: RecordId
  readonly date: CivilDate
  readonly kind: TripCostKind
  readonly description: string
  /** In euros, from the card statement or at the ECB rate of the payment day. */
  readonly amount: Money
  readonly foreign: ForeignAmount | null
  readonly paidBy: TripCostPayer
}
