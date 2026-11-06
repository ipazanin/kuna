import type { HouseRegion } from '../../workbook/domain/asset'
import type { HouseIndex, Quarter, RegionIndex } from '../domain/houseIndex'
import { stepsOfNumber } from '../../../../shared/money/numberRounding'

/** Tabela 1.4 of the DZS, Indeksi cijena stambenih objekata, po tromjesečjima. */
const TABLE_URL = 'https://web.dzs.hr/PXWeb/api/v1/hr/Cijene/Indeksi%20cijena%20stambenih%20objekata/ME_PS14.px'

const REGION_CATEGORIES: Readonly<Record<HouseRegion, string>> = { zagreb: '3', adriatic: '4', rest: '5' }

/** The indicator "indeksi (2025. = 100)". */
const INDEX_INDICATOR = '3'

const QUERY = {
  query: [
    { code: 'Indikatori', selection: { filter: 'item', values: [INDEX_INDICATOR] } },
    { code: 'Kategorije', selection: { filter: 'item', values: Object.values(REGION_CATEGORIES) } },
  ],
  response: { format: 'json-stat2' },
}

/** Asks the DZS for the index of the three regions in every quarter it has. The question holds only the table's query. */
export async function dzsHouseIndex(): Promise<HouseIndex> {
  const response = await window.fetch(TABLE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(QUERY), signal: AbortSignal.timeout(10_000) })
  if (!response.ok) {
    throw new Error(`The DZS answered ${response.status}.`)
  }
  return houseIndexOfAnswer(await response.json())
}

interface JsonStatDimension {
  readonly category: { readonly index: Readonly<Record<string, number>> | readonly string[] }
}

interface JsonStat {
  readonly id: readonly string[]
  readonly size: readonly number[]
  readonly dimension: Readonly<Record<string, JsonStatDimension>>
  readonly value: readonly (number | null)[]
}

const QUARTER = /^\d{4}Q[1-4]$/

function isJsonStat(answer: unknown): answer is JsonStat {
  const candidate = answer as Partial<JsonStat> | null
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    Array.isArray(candidate.id) &&
    Array.isArray(candidate.size) &&
    candidate.id.length === candidate.size.length &&
    typeof candidate.dimension === 'object' &&
    candidate.dimension !== null &&
    candidate.id.every((id) => typeof candidate.dimension?.[id]?.category?.index === 'object') &&
    Array.isArray(candidate.value)
  )
}

/** The codes of a dimension in the order of its place in the cube. */
function codesOf(dimension: JsonStatDimension): readonly string[] {
  const { index } = dimension.category
  return Array.isArray(index)
    ? index
    : Object.entries(index)
        .sort(([, first], [, second]) => first - second)
        .map(([code]) => code)
}

function notTheTable(): Error {
  return new Error('The DZS answer is not the house price index table.')
}

/**
 * Reads the table's JSON-stat answer by its dimension ids and their sizes, so the order the DZS lists them in does not
 * matter. Values are read as whole hundredths, and a quarter with no value is left out. Throws on an answer that is
 * not the table.
 */
export function houseIndexOfAnswer(answer: unknown): HouseIndex {
  if (!isJsonStat(answer)) throw notTheTable()
  const dimensions = answer.id.map((name, place) => {
    const dimension = answer.dimension[name]
    if (dimension === undefined) throw notTheTable()
    return { name, codes: codesOf(dimension), stride: answer.size.slice(place + 1).reduce((product, size) => product * size, 1) }
  })
  /** The value at these codes. A dimension the codes do not name holds one category, which is taken. */
  const valueAt = (codes: Readonly<Record<string, string>>): number | null => {
    let offset = 0
    for (const { name, codes: held, stride } of dimensions) {
      const code = codes[name]
      const place = code === undefined ? (held.length === 1 ? 0 : -1) : held.indexOf(code)
      if (place < 0) throw notTheTable()
      offset += place * stride
    }
    const value = answer.value[offset]
    return typeof value === 'number' ? value : null
  }
  const quarterCodes = dimensions.find((dimension) => dimension.name === 'Tromjesečje')?.codes
  if (quarterCodes === undefined) throw notTheTable()
  const quarters = quarterCodes.filter((code): code is Quarter => QUARTER.test(code))
  const regionIndex = (category: string): RegionIndex =>
    new Map(
      quarters.flatMap((quarter) => {
        const value = valueAt({ Kategorije: category, Indikatori: INDEX_INDICATOR, Tromjesečje: quarter })
        const hundredths = value === null ? null : stepsOfNumber(value, 2)
        return hundredths === null ? [] : [[quarter, Number(hundredths)] as const]
      }),
    )
  return { zagreb: regionIndex(REGION_CATEGORIES.zagreb), adriatic: regionIndex(REGION_CATEGORIES.adriatic), rest: regionIndex(REGION_CATEGORIES.rest) }
}
