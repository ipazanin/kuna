import type { Asset, AssetKind, HouseRegion } from '../../workbook/domain/asset'
import { words as assetsWords } from '../../words'
import { words } from './words'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { typedAmount } from '../../../../shared/money/typedAmount'

/** What the region select holds for no region, since a select's value cannot be empty. */
export const NO_REGION = 'none'

/** What the asset dialog's fields hold while they are typed. */
export interface AssetTexts {
  readonly name: string
  readonly kind: AssetKind
  readonly bought: string
  readonly price: string
  readonly region: HouseRegion | typeof NO_REGION
  readonly firstRegistration: string
}

/** What an asset keeps of the dialog's fields: everything but its id, its loan and its note. */
export type AssetTerms = Omit<Asset, 'id' | 'loan' | 'note'>

/** What each field says is wrong with it, null for a field that is fine. */
export type AssetErrors = {
  readonly name: string | null
  readonly bought: string | null
  readonly price: string | null
  readonly firstRegistration: string | null
}

/** A typed day, null for a blank field, or undefined for text that is no day. */
function typedDay(text: string): CivilDate | null | undefined {
  return text.trim() === '' ? null : (parseCivilDate(text) ?? undefined)
}

/**
 * The asset's terms the dialog's fields give, with what is wrong under each field, as the dialog checks them. The terms
 * are null while any field is wrong. A region is kept only for a home and a first registration only for a car.
 */
export function typedAssetTerms(texts: AssetTexts): { readonly errors: AssetErrors; readonly terms: AssetTerms | null } {
  const bought = typedDay(texts.bought)
  const registered = typedDay(texts.firstRegistration)
  const blankPrice = texts.price.trim() === ''
  const price = blankPrice ? null : typedAmount(texts.price)
  const errors: AssetErrors = {
    name: texts.name.trim() === '' ? words.assetDialog.nameError : null,
    bought: bought === undefined ? assetsWords.form.aDate(civilDate(2025, 3, 15)) : null,
    price: (!blankPrice && price === null) || (price !== null && price <= 0) ? words.assetDialog.anAmount : price !== null && bought === null ? words.assetDialog.priceNeedsBought : null,
    firstRegistration: texts.kind === 'car' && registered === undefined ? assetsWords.form.aDate(civilDate(2024, 1, 15)) : null,
  }
  if (Object.values(errors).some((error) => error !== null) || bought === undefined) return { errors, terms: null }
  return {
    errors,
    terms: {
      name: texts.name,
      kind: texts.kind,
      bought,
      price,
      region: texts.kind === 'home' && texts.region !== NO_REGION ? texts.region : null,
      firstRegistration: texts.kind === 'car' ? (registered ?? null) : null,
    },
  }
}
