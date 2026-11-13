import { carriedForward } from '../../houseIndex/domain/houseIndex'
import type { HouseIndex, Quarter } from '../../houseIndex/domain/houseIndex'
import { customsEstimate } from '../../carValue/domain/customsTable'
import type { TableShare } from '../../carValue/domain/customsTable'
import type { Asset, HouseRegion } from '../../workbook/domain/asset'
import type { AssetBook } from '../../workbook/domain/readAssetBook'
import type { Valuation } from '../../workbook/domain/valuation'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'

/**
 * Where a value came from: a valuation you typed or the price you paid, either carried by the house price index, kept
 * because the index has no figure for its quarter yet or starts after it, or the customs table's estimate.
 */
export type ValueBasis =
  | { readonly kind: 'valuation' | 'price'; readonly date: CivilDate }
  | { readonly kind: 'index-not-out'; readonly base: 'valuation' | 'price'; readonly date: CivilDate; readonly quarter: Quarter }
  | { readonly kind: 'index-not-reached'; readonly base: 'valuation' | 'price'; readonly date: CivilDate; readonly first: Quarter }
  | { readonly kind: 'house-index'; readonly base: Money; readonly date: CivilDate; readonly quarter: Quarter; readonly region: HouseRegion }
  | { readonly kind: 'customs'; readonly onDay: TableShare; readonly whenBought: TableShare | null }

export interface AssetValue {
  readonly cents: Money
  readonly basis: ValueBasis
}

/** Whether the value is Kuna's estimate, carried by the house price index or read from the customs table, rather than a valuation or a price you typed. */
export function isEstimate(basis: ValueBasis): boolean {
  return basis.kind === 'house-index' || basis.kind === 'customs'
}

/** Whether the house price index carries the asset's value: a flat or house with its region. */
export function carriedByIndex(asset: Asset): asset is Asset & { readonly region: HouseRegion } {
  return asset.kind === 'home' && asset.region !== null
}

/** Whether a home of the book has a region, so its value waits for the index. */
export function needsHouseIndex(book: Pick<AssetBook, 'assets'>): boolean {
  return book.assets.some(({ asset }) => carriedByIndex(asset))
}

/**
 * What an asset is worth on the day. The base is the newest valuation on or before the day, or else the price paid
 * once it was bought. A home with a region carries the base by the house price index while the index is in hand. A
 * car with no valuation, a price and a first registration is estimated by the customs table. Anything else keeps the
 * base. Null without a base.
 */
export function assetValueOn(asset: Asset, valuations: readonly Valuation[], day: CivilDate, index: HouseIndex | null): AssetValue | null {
  const valuation = valuations.filter((entry) => entry.date <= day).at(-1)
  const base =
    valuation !== undefined
      ? { cents: valuation.value, kind: 'valuation' as const, date: valuation.date }
      : asset.price !== null && asset.bought !== null && asset.bought <= day
        ? { cents: asset.price, kind: 'price' as const, date: asset.bought }
        : null
  if (base === null) return null
  const { date } = base
  if (carriedByIndex(asset) && index !== null) {
    const carried = carriedForward(base.cents, date, index[asset.region], day)
    if (carried?.kind === 'not-out') return { cents: base.cents, basis: { kind: 'index-not-out', base: base.kind, date, quarter: carried.quarter } }
    if (carried?.kind === 'not-reached') return { cents: base.cents, basis: { kind: 'index-not-reached', base: base.kind, date, first: carried.first } }
    if (carried?.kind === 'carried') return { cents: carried.cents, basis: { kind: 'house-index', base: base.cents, date, quarter: carried.quarter, region: asset.region } }
  }
  if (asset.kind === 'car' && base.kind === 'price' && asset.firstRegistration !== null) {
    const estimate = customsEstimate(base.cents, date, asset.firstRegistration, day)
    return { cents: estimate.cents, basis: { kind: 'customs', onDay: estimate.onDay, whenBought: estimate.whenBought } }
  }
  return { cents: base.cents, basis: { kind: base.kind, date } }
}
