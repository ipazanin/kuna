import type { SurtaxCity } from '../domain/surtaxRates2023'
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
