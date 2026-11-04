import { HUNDRED_PERCENT } from '../../workbook/domain/investmentFields'
import { countryOf } from '../../workbook/domain/mixGroup'
import type { Country, Region } from '../../workbook/domain/mixGroup'
import { DECIMAL_ZERO, decimalOfText } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { countryCodeOfName, foldedName } from '../../../../shared/text/countryName'

/** One line of a country table pasted from a factsheet. The group or the percent is null when the line does not give one Kuna can read. */
export interface FactsheetCountryLine {
  readonly text: string
  readonly group: Country | null
  readonly percent: Decimal | null
}

/** The English and Croatian names a factsheet gives each region, as the screens name them and as factsheets also write them. */
const REGION_NAMES: Readonly<Record<Region, readonly string[]>> = {
  world: ['World', 'Svijet'],
  europe: ['Europe', 'Europa'],
  'north-america': ['North America', 'Sjeverna Amerika'],
  'asia-pacific': ['Asia Pacific', 'Asia and Pacific', 'Azija i Pacifik'],
  'emerging-markets': ['Emerging Markets', 'Tržišta u razvoju', 'Tržišta u nastajanju'],
}

const REGIONS_BY_NAME: ReadonlyMap<string, Country> = new Map(Object.entries(REGION_NAMES).flatMap(([region, names]) => names.map((name) => [foldedName(name), region as Country] as const)))

/** A number with a minus, a dot or a comma in it, and the percent sign after it if there is one. */
const NUMBER = /(-?)(\d[\d.,]*\d|\d)\s*(%?)/gu

const PERCENT_TEXT = /^\d+(?:[.,]\d+)?$/

/** What a table puts around a name: spaces, quotes, bullets and separators. */
const AROUND_NAME = /^[\s"'“”„‘’«»•·▪●◦*–—\-;:|,=%()]+|[\s"'“”„‘’«»•·▪●◦*–—\-;:|,=%()]+$/gu

/**
 * Each line of a pasted country table that is not blank, with the country or region its name gives and the percent it
 * gives, in the order pasted. A line may put the percent before or after the name and write it with a dot or a comma.
 */
export function readFactsheetCountries(text: string): FactsheetCountryLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const numbers = [...line.matchAll(NUMBER)]
      const percentNumber = numbers.find((number) => number[3] === '%') ?? numbers[0]
      const name = line.replace(NUMBER, ' ').replace(AROUND_NAME, '')
      return { text: line, group: groupOfName(name), percent: percentNumber === undefined ? null : percentOf(percentNumber[1] === '-', percentNumber[2]!) }
    })
}

function groupOfName(name: string): Country | null {
  const region = REGIONS_BY_NAME.get(foldedName(name))
  if (region !== undefined) {
    return region
  }
  const code = countryCodeOfName(name)
  return countryOf(name) ?? (code === null ? null : countryOf(code))
}

/** A share above zero and at most a hundred, or null for any other figure. */
function percentOf(negative: boolean, digits: string): Decimal | null {
  if (negative || !PERCENT_TEXT.test(digits)) {
    return null
  }
  const percent = decimalOfText(digits.replace(',', '.'))
  return percent !== null && percent > DECIMAL_ZERO && percent <= HUNDRED_PERCENT ? percent : null
}
