import { surtaxCity2023 } from './surtaxRates2023'
import type { SurtaxCity } from './surtaxRates2023'
import type { CapitalTaxRules } from './taxRules'
import { SURTAX_CITY_2023_KEY } from '../../workbook/domain/investmentSettings'
import { words } from '../../workbook/domain/words'
import { sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { moneyAt, percentFromBasisPoints } from '../../../../shared/money/percent'
import type { Percent } from '../../../../shared/money/percent'
import { settingValue } from '../../../../shared/storage/domain/settingRows'
import type { SettingRow, SettingValueCheck } from '../../../../shared/storage/domain/settingRows'

/** The setting's value for a city or municipality that set no surtax, which Porezna's table leaves out. */
export const CITY_WITHOUT_SURTAX = 'none'

/** Where the owner lived in 2023: a place in Porezna's table, or one the table leaves out, which owes no surtax. */
export type CityOf2023 = { readonly kind: 'listed'; readonly city: SurtaxCity } | { readonly kind: 'unlisted' }

/** The city surtax of a year's tax: none in a year without surtax, unknown while the owner has not said where they lived, or due at the city's rate. */
export type YearSurtax = { readonly kind: 'none' } | { readonly kind: 'no-city' } | { readonly kind: 'due'; readonly city: CityOf2023; readonly rate: Percent; readonly amount: Money }

/** The place a stored value names: a code of the table or none, and null for a blank value or anything else. */
export function cityOfValue(value: string): CityOf2023 | null {
  if (value === CITY_WITHOUT_SURTAX) return { kind: 'unlisted' }
  const city = surtaxCity2023(value)
  return city === null ? null : { kind: 'listed', city }
}

/** A stored 2023 city counts only when it names a place. */
export const SURTAX_CITY_2023_CHECK: SettingValueCheck = (value) => (cityOfValue(value) === null ? [words.settingNotACity(SURTAX_CITY_2023_KEY, value)] : [])

/** The city the settings name for 2023, or null when they name none. */
export function cityOf2023(settings: readonly SettingRow[]): CityOf2023 | null {
  return cityOfValue(settingValue(settings, SURTAX_CITY_2023_KEY))
}

/** The surtax on the year's tax at the city's rate, rounded once to the cent. */
export function yearSurtax(rules: CapitalTaxRules, city: CityOf2023 | null, tax: Money): YearSurtax {
  if (!rules.surtax) return { kind: 'none' }
  if (city === null) return { kind: 'no-city' }
  const rate = city.kind === 'listed' ? city.city.rate : percentFromBasisPoints(0)
  return { kind: 'due', city, rate, amount: moneyAt(tax, rate) }
}

/** The city whose surtax the year's tax carries, and null when none is due: a year without surtax, no city yet, a place the table leaves out or a rate of zero. */
export function surtaxChargedBy(surtax: YearSurtax): SurtaxCity | null {
  return surtax.kind === 'due' && surtax.city.kind === 'listed' && surtax.rate > 0 ? surtax.city.city : null
}

/** What the year's JOPPD pays, fields 14.1 and 14.2: the tax, and the city's surtax on top once it is known. */
export function taxWithSurtax(tax: Money, surtax: YearSurtax): Money {
  return surtax.kind === 'due' ? sumMoney([tax, surtax.amount]) : tax
}
