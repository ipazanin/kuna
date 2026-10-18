import { fold } from '../../../shared/text/fold'
import { LOCAL_RATE_TABLES } from './rules/generatedLocalRates'
import type { LocalUnitType } from './rules/generatedLocalRates'

/** A Croatian city or municipality, the unit whose decision sets the owner's local income tax rates. */
export interface LocalUnit {
  /** The official name, such as `Grad Zagreb` or `Općina Bale – Valle`. */
  readonly unit: string
  readonly county: string
  readonly unitType: LocalUnitType
  /** The official name, followed by the county when another unit has the same name. */
  readonly label: string
}

export type LocalUnitMatch = { readonly unit: LocalUnit; readonly problem: null } | { readonly unit: null; readonly problem: string }

const latestTable = LOCAL_RATE_TABLES.at(-1)
if (latestTable === undefined) {
  throw new RangeError('The ruleset holds no table of local income tax rates.')
}

const sharedNames = new Set(
  latestTable.rows.map((row) => row.unit).filter((unit, index, units) => units.indexOf(unit) !== index),
)

/** Every unit, in the order of the Porezna uprava tables. The import script checks that every table lists the same units. */
export const LOCAL_UNITS: readonly LocalUnit[] = latestTable.rows.map((row) => ({
  unit: row.unit,
  county: row.county,
  unitType: row.unitType,
  label: sharedNames.has(row.unit) ? `${row.unit} (${row.county})` : row.unit,
}))

const KIND_PREFIX = /^(GRAD|OPCINA) /

/** Folded, with any dash written as a plain hyphen, so `Pula – Pola`, `pula-pola` and `PULA - POLA` agree. */
function nameKey(name: string): string {
  return fold(name).replace(/\s*[-–]\s*/g, '-')
}

/** The name without `Grad` or `Općina`, and for a bilingual name such as `Pula – Pola` each of its two names too. */
function namesOf(unit: LocalUnit): readonly string[] {
  const bare = unit.unit.replace(/^(Grad|Općina) /, '')
  const parts = bare.includes(' – ') ? bare.split(' – ') : []
  return [bare, ...parts].map(nameKey)
}

/**
 * The unit a person names, ignoring case and diacritics, with or without `Grad` or `Općina`, and with
 * an optional county in brackets: `Privlaka (Zadarska)`. A name that fits no unit, or more than one, is refused.
 */
export function findLocalUnit(typed: string): LocalUnitMatch {
  const written = typed.trim()
  if (written === '') {
    return { unit: null, problem: 'name the city or municipality' }
  }
  const bracketed = /^(.*?)\s*\(([^)]*)\)$/.exec(written)
  const name = nameKey(bracketed?.[1] ?? written)
  const county = bracketed === null ? null : fold(bracketed[2] ?? '').replace(/ ZUPANIJA$/, '')
  const kind = KIND_PREFIX.exec(name)?.[1] ?? null
  const bareName = name.replace(KIND_PREFIX, '')
  const matches = LOCAL_UNITS.filter(
    (unit) =>
      namesOf(unit).includes(bareName) &&
      (kind === null || (kind === 'OPCINA') === (unit.unitType === 'municipality')) &&
      (county === null || fold(unit.county).startsWith(county)),
  )
  const [match] = matches
  if (match === undefined) {
    return { unit: null, problem: `"${written}" is not a Croatian city or municipality` }
  }
  if (matches.length > 1) {
    const choices = matches.map((unit) => (sharedNames.has(unit.unit) ? unit.label : `${unit.label} (${unit.county})`))
    return { unit: null, problem: `"${written}" could be ${choices.slice(0, -1).join(', ')} or ${choices.at(-1)}, so choose one` }
  }
  return { unit: match, problem: null }
}
