import { cityOfValue } from '../domain/citySurtax'
import type { CityOf2023 } from '../domain/citySurtax'
import type { SurtaxCity } from '../domain/surtaxRates2023'
import { words } from './words'
import { percentText } from '../../../../shared/money/percent'
import { naturalOrder } from '../../../../shared/text/naturalOrder'

/** One place in the 2023 city picker: the name it shows, whether it is a city or a municipality, and the table's own spelling a search also finds. */
export interface SurtaxCityChoice {
  readonly city: SurtaxCity
  readonly kind: 'city' | 'municipality'
  /** The table's name without Grad or Općina in front, as the table writes it. */
  readonly place: string
  /** The place with Sv. written out as Sveti, which the list shows and sorts by. */
  readonly spelled: string
}

const KIND_PREFIX = /^(Grad|Općina) /
const SAINT = /\bSv\.\s*/g
const SAINT_WRITTEN_OUT = /\bSvet[aio]\s+/g

/** A name from the table with Sv. written out as Sveti, as people type it. */
export function spelledOut(name: string): string {
  return name.replace(SAINT, 'Sveti ')
}

/** The table's places sorted by name, and two places of one name by their Porezna office. The table writes Grad before every city and mostly nothing before a municipality. */
export function surtaxCityChoices(cities: readonly SurtaxCity[]): SurtaxCityChoice[] {
  return cities
    .map((city): SurtaxCityChoice => {
      const place = city.name.replace(KIND_PREFIX, '')
      const kind = city.name.startsWith('Grad ') ? 'city' : 'municipality'
      return { city, kind, place, spelled: spelledOut(place) }
    })
    .sort((left, right) => naturalOrder(left.spelled, right.spelled) || naturalOrder(left.city.office, right.city.office))
}

/**
 * The ways a person writes the place, which a search of the chat finds it by: as the table writes it, without Grad or Općina and with
 * them, and with Sv. written out as Sveti or a written-out saint shortened to Sv.
 */
export function placeSpellings({ city, kind, place, spelled }: SurtaxCityChoice): readonly string[] {
  const kindWord = kind === 'city' ? 'Grad' : 'Općina'
  const names = [place, spelled, spelled.replace(SAINT_WRITTEN_OUT, 'Sv. ')]
  return [...new Set([city.name, ...names, ...names.map((name) => `${kindWord} ${name}`)])]
}

/** The place the card folds to, by its name and rate, or the place the table leaves out. */
export function chosenCityText(city: CityOf2023): string {
  const text = words.surtaxCity
  return city.kind === 'listed' ? text.summary(spelledOut(city.city.name), percentText(city.city.rate)) : text.unlisted
}

/** A stored value as the card names it, or null for no answer. */
export function storedCityText(value: string): string | null {
  const city = cityOfValue(value)
  return city === null ? null : chosenCityText(city)
}
