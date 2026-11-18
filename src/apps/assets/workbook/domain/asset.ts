import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import type { Percent } from '../../../../shared/money/percent'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A flat or house, which the house price index can carry, a car, which the customs table can estimate, or anything else, valued only as typed. */
export const ASSET_KINDS = ['home', 'car', 'other'] as const

export type AssetKind = (typeof ASSET_KINDS)[number]

/** The regions the DZS house price index is kept for: the City of Zagreb, the Adriatic and the rest of Croatia. */
export const HOUSE_REGIONS = ['zagreb', 'adriatic', 'rest'] as const

export type HouseRegion = (typeof HOUSE_REGIONS)[number]

/** Something you own, with what you paid for it and the bank loan on it, in euros. */
export interface Asset {
  readonly id: RecordId
  readonly name: string
  readonly kind: AssetKind
  readonly bought: CivilDate | null
  /** Above zero, and only with `bought`. */
  readonly price: Money | null
  /** A home's region for the house price index. */
  readonly region: HouseRegion | null
  /** A car's first registration, from which the customs table counts its months. */
  readonly firstRegistration: CivilDate | null
  /** The bare UUID of the bank loan on it, as Loans keeps it. Whether Loans still has it is known only on screen. */
  readonly loan: string | null
  /** Your part of it from the day it was bought, when you own it with others. Absent when it is all yours. Later changes are share changes. */
  readonly share?: Percent
  readonly note: string
}
