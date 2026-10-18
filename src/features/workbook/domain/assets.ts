import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { Money } from '../../../shared/money/money'

/** The depreciation groups of the `group` column. */
export const ASSET_GROUPS = ['computers', 'equipment', 'car', 'building', 'other'] as const

export type AssetGroup = (typeof ASSET_GROUPS)[number]

/** One row of the `assets` tab: a purchase kept as a fixed asset and depreciated. */
export interface Asset {
  /** As written, such as `Laptop 14"`. Each name once on the tab, case ignored. */
  readonly name: string
  readonly bought: CivilDate
  /** When it was put in use, the day it was bought when the tab leaves it blank. Never before `bought`. */
  readonly inUse: CivilDate
  /** The cost without the VAT that was deducted. Always positive. */
  readonly costNet: Money
  readonly group: AssetGroup
  /** True when the accountant doubles the group's depreciation rate for this asset. */
  readonly doubledRate: boolean
  /** Null while the asset is still held. Never before `inUse`. */
  readonly disposed: CivilDate | null
  /** The grant that paid for it, by the `grant` name on the grants tab. Blank when none did. */
  readonly fundedBy: string
  /** Text that finds the purchase on the ledger, such as its bank reference. */
  readonly ledgerReference: string
  readonly note: string
  readonly sheetRow: number
}
