/**
 * Writes the local income tax rates of every Croatian city and municipality into the ruleset, from
 * the tables Porezna uprava publishes and the 2021 census list of units.
 *
 *   npm run import:local-rates -- --table 2025-01-01=<xlsx> --table 2025-03-01=<xlsx> --table 2026-01-01=<xlsx> --census <xlsx> [--out <ts>]
 *
 * Each `--table` names the day a Porezna uprava table ("Tablica poreznih stopa godišnjeg poreza na
 * dohodak") takes effect. A table holds until the day before the next one starts, and the last one
 * until the end of its year. `--census` is the statistics office workbook "Popis 2021. – stanovništvo
 * po gradovima/općinama", whose table 1 gives each unit's county, whether it is a town or a
 * municipality, and its population.
 *
 * The rate tables name a unit only in capitals and without its county, so three names are shared.
 * Those are told apart by the tax office's unit code, as the units' own decisions in the Narodne
 * novine show. The script refuses a table whose units or rates do not line up with the others.
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import * as XLSX from 'xlsx'

const DEFAULT_OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/packs/hr-doo/ruleset/rules/generatedLocalRates.ts')

/** Zakon o lokalnoj i područnoj (regionalnoj) samoupravi, Art. 19.a(1): a large town has more than 35,000 inhabitants. */
const LARGE_TOWN_POPULATION = 35_000

/** The seat of each county, from Zakon o područjima županija, gradova i općina, NN 86/06, Art. 3. Zagreb County's seat is Grad Zagreb. */
const COUNTY_SEATS = new Map([
  ['Krapinsko-zagorska', 'Krapina'],
  ['Sisačko-moslavačka', 'Sisak'],
  ['Karlovačka', 'Karlovac'],
  ['Varaždinska', 'Varaždin'],
  ['Koprivničko-križevačka', 'Koprivnica'],
  ['Bjelovarsko-bilogorska', 'Bjelovar'],
  ['Primorsko-goranska', 'Rijeka'],
  ['Ličko-senjska', 'Gospić'],
  ['Virovitičko-podravska', 'Virovitica'],
  ['Požeško-slavonska', 'Požega'],
  ['Brodsko-posavska', 'Slavonski Brod'],
  ['Zadarska', 'Zadar'],
  ['Osječko-baranjska', 'Osijek'],
  ['Šibensko-kninska', 'Šibenik'],
  ['Vukovarsko-srijemska', 'Vukovar'],
  ['Splitsko-dalmatinska', 'Split'],
  ['Istarska', 'Pazin'],
  ['Dubrovačko-neretvanska', 'Dubrovnik'],
  ['Međimurska', 'Čakovec'],
])

/**
 * The county of each unit code whose name another unit shares. Code 3140 cites NN 148/25, a decision
 * of Općina Otok. Code 4367 cites NN 150/23, a decision of Grad Sveta Nedelja. Code 5746 cites
 * NN 108/24, a decision of Općina Privlaka whose statute is in the Zadar County gazette.
 */
const COUNTY_BY_SHARED_NAME_CODE = new Map([
  [3140, 'Splitsko-dalmatinska'],
  [5355, 'Vukovarsko-srijemska'],
  [4367, 'Zagrebačka'],
  [4324, 'Istarska'],
  [5746, 'Zadarska'],
  [5835, 'Vukovarsko-srijemska'],
])

const NN_ISSUE = /^\d{1,3}\/\d{2}$/

const { values: options } = parseArgs({
  options: {
    table: { type: 'string', multiple: true, default: [] },
    census: { type: 'string' },
    out: { type: 'string', default: DEFAULT_OUT },
  },
})

function fail(message) {
  console.error(message)
  process.exit(1)
}

/** Unit names compared across the two sources: capitals, any dash as a hyphen, no footnote mark. */
function nameKey(name) {
  return name
    .toLocaleUpperCase('hr')
    .replace(/\*/g, '')
    .replace(/\s*[-–]\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function isoDay(written, where) {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/.exec(String(written).trim())
  if (match === null) {
    fail(`${where}: "${written}" is not a date written as d.m.yyyy.`)
  }
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

function dayBefore(day) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function basisPointsOf(share, where) {
  const points = Math.round(share * 10_000)
  if (typeof share !== 'number' || Math.abs(points - share * 10_000) > 1e-6 || points <= 0) {
    fail(`${where}: ${share} is not a rate in whole basis points.`)
  }
  return points
}

function readBook(path) {
  return XLSX.read(readFileSync(path), { type: 'buffer' })
}

function sheetRows(book, sheetName) {
  return XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, raw: true, blankrows: false, defval: null })
}

function columnOf(header, title, path) {
  const index = header.findIndex((cell) => String(cell ?? '').trim().startsWith(title))
  if (index < 0) {
    fail(`${path}: no "${title}" column.`)
  }
  return index
}

/** A unit's type as the income tax act's ranges name it. */
function unitTypeOf(county, kind, name, population) {
  if (county === 'Grad Zagreb') return 'zagreb'
  if (kind === 'Općina') return 'municipality'
  return COUNTY_SEATS.get(county) === name || population > LARGE_TOWN_POPULATION ? 'large-town-or-county-seat' : 'town'
}

function readCensus(path) {
  const rows = sheetRows(readBook(path), '1.')
  const header = rows.find((row) => row[0] === 'Županija')
  if (header === undefined) {
    fail(`${path}: table 1 has no header row.`)
  }
  const kindColumn = columnOf(header, 'Jedinica lokalne samouprave', path)
  const nameColumn = columnOf(header, 'Grad/općina', path)
  const totalColumn = columnOf(header, 'Ukupno', path)
  const units = rows
    .filter((row) => row[kindColumn] === 'Grad' || row[kindColumn] === 'Općina' || (row[0] === 'Grad Zagreb' && row[kindColumn] === null))
    .map((row) => {
      const county = String(row[0])
      const kind = row[0] === 'Grad Zagreb' ? 'Grad' : row[kindColumn]
      const name = row[0] === 'Grad Zagreb' ? 'Zagreb' : String(row[nameColumn]).trim()
      return { county, name, unit: `${kind} ${name}`, unitType: unitTypeOf(county, kind, name, Number(row[totalColumn])) }
    })
  const seatsFound = [...COUNTY_SEATS].filter(([county, seat]) => units.some((unit) => unit.county === county && unit.name === seat && unit.unit.startsWith('Grad')))
  if (seatsFound.length !== COUNTY_SEATS.size) {
    fail(`${path}: only ${seatsFound.length} of the ${COUNTY_SEATS.size} county seats are towns in the census.`)
  }
  return units
}

function readRateTable(path) {
  const book = readBook(path)
  const rows = sheetRows(book, book.SheetNames[0])
  const headerIndex = rows.findIndex((row) => row.some((cell) => String(cell ?? '').startsWith('Šifra grada/općine')))
  if (headerIndex < 0) {
    fail(`${path}: no header row with "Šifra grada/općine".`)
  }
  const header = rows[headerIndex]
  const columns = {
    code: columnOf(header, 'Šifra grada/općine', path),
    name: columnOf(header, 'Ime grada/općine', path),
    decision: columnOf(header, 'Broj NN', path),
    lower: columnOf(header, 'Niža stopa', path),
    higher: columnOf(header, 'Viša stopa', path),
    appliesFrom: columnOf(header, 'Stupanje na snagu', path),
  }
  return rows
    .slice(headerIndex + 1)
    .filter((row) => typeof row[columns.code] === 'number')
    .map((row) => {
      const code = row[columns.code]
      const where = `${basename(path)} code ${code}`
      const issues = String(row[columns.decision]).split(',').map((issue) => issue.trim())
      if (!issues.every((issue) => NN_ISSUE.test(issue))) {
        fail(`${where}: "${row[columns.decision]}" is not a list of NN issues.`)
      }
      return {
        code,
        name: String(row[columns.name]),
        lowerRate: basisPointsOf(row[columns.lower], `${where} lower rate`),
        higherRate: basisPointsOf(row[columns.higher], `${where} higher rate`),
        decision: issues.join(', '),
        appliesFrom: isoDay(row[columns.appliesFrom], `${where} date`),
      }
    })
}

/** Joins the codes of a rate table to census units by name, using the county for a shared name. */
function unitsByCode(rateRows, census) {
  const byName = Map.groupBy(census, (unit) => nameKey(unit.name))
  const joined = new Map()
  for (const row of rateRows) {
    const candidates = (byName.get(nameKey(row.name)) ?? []).filter(
      (unit) => !COUNTY_BY_SHARED_NAME_CODE.has(row.code) || unit.county === COUNTY_BY_SHARED_NAME_CODE.get(row.code),
    )
    if (candidates.length !== 1) {
      fail(`Code ${row.code} ${row.name} matches ${candidates.length} census units.`)
    }
    joined.set(row.code, candidates[0])
  }
  if (new Set(joined.values()).size !== census.length) {
    fail(`The rate table names ${new Set(joined.values()).size} of the ${census.length} census units.`)
  }
  return joined
}

/** Sorts NN issues by year, then by issue number. */
function issueOrder(issue) {
  const [number, year] = issue.split('/').map(Number)
  return year * 1000 + number
}

if (options.table.length === 0 || options.census === undefined) {
  fail('Give at least one --table <yyyy-mm-dd>=<xlsx> and the --census <xlsx>.')
}

const tableArguments = options.table
  .map((entry) => {
    const match = /^(\d{4}-\d{2}-\d{2})=(.+)$/.exec(entry)
    if (match === null) {
      fail(`--table takes <yyyy-mm-dd>=<xlsx>, not ${entry}.`)
    }
    return { validFrom: match[1], path: match[2] }
  })
  .sort((first, second) => first.validFrom.localeCompare(second.validFrom))

const census = readCensus(options.census)
const tables = tableArguments.map((table, index) => {
  const next = tableArguments[index + 1]
  return {
    ...table,
    validTo: next === undefined ? `${table.validFrom.slice(0, 4)}-12-31` : dayBefore(next.validFrom),
    rows: readRateTable(table.path),
  }
})

const units = unitsByCode(tables[0].rows, census)
for (const table of tables) {
  const codes = table.rows.map((row) => row.code)
  if (codes.length !== units.size || new Set(codes).size !== codes.length || !codes.every((code) => units.has(code))) {
    fail(`${basename(table.path)} does not list the same ${units.size} unit codes as ${basename(tables[0].path)}.`)
  }
  for (const row of table.rows) {
    if (row.appliesFrom > table.validFrom) {
      fail(`${basename(table.path)} code ${row.code}: applies from ${row.appliesFrom}, after the table starts on ${table.validFrom}.`)
    }
  }
}

// A decision a later table dates on or before an earlier table's first day must already be in that earlier table.
const mismatches = []
tables.forEach((later, laterIndex) => {
  for (const earlier of tables.slice(0, laterIndex)) {
    const earlierByCode = new Map(earlier.rows.map((row) => [row.code, row]))
    for (const row of later.rows) {
      const before = earlierByCode.get(row.code)
      if (row.appliesFrom <= earlier.validFrom && (before.lowerRate !== row.lowerRate || before.higherRate !== row.higherRate)) {
        mismatches.push(`${units.get(row.code).unit}: ${basename(later.path)} dates ${row.lowerRate}/${row.higherRate} from ${row.appliesFrom}, ${basename(earlier.path)} has ${before.lowerRate}/${before.higherRate}`)
      }
    }
  }
})
if (mismatches.length > 0) {
  fail(`The tables disagree:\n${mismatches.join('\n')}`)
}

function quoted(text) {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

const collator = new Intl.Collator('hr')
const sourceLines = [...tableArguments.map((table) => table.path), options.census].map((path) => {
  const digest = createHash('sha256').update(readFileSync(path)).digest('hex')
  return `//   ${basename(path)}  sha256 ${digest}`
})

function rowLine(row) {
  const unit = units.get(row.code)
  return `      { unit: ${quoted(unit.unit)}, county: ${quoted(unit.county)}, unitType: ${quoted(unit.unitType)}, lowerRate: ${row.lowerRate}, higherRate: ${row.higherRate}, decision: ${quoted(row.decision)}, appliesFrom: ${quoted(row.appliesFrom)} },`
}

/** NN 114/23 amended the income tax act itself, so a unit listed with it alone adopted no decision. */
const NO_DECISION_ISSUE = '114/23'

function decisionIssuesOf(rows) {
  return [...new Set(rows.flatMap((row) => row.decision.split(', ')))]
    .filter((issue) => issue !== NO_DECISION_ISSUE)
    .sort((first, second) => issueOrder(first) - issueOrder(second))
}

function tableBlock(table) {
  const rows = [...table.rows].sort(
    (first, second) => collator.compare(units.get(first.code).name, units.get(second.code).name) || collator.compare(units.get(first.code).county, units.get(second.code).county),
  )
  return [
    '  {',
    `    validFrom: ${quoted(table.validFrom)},`,
    `    validTo: ${quoted(table.validTo)},`,
    `    decisionIssues: [${decisionIssuesOf(table.rows).map(quoted).join(', ')}],`,
    '    rows: [',
    ...rows.map(rowLine),
    '    ],',
    '  },',
  ]
}

const lines = [
  '// Generated by scripts/import-local-rates.mjs. Do not edit by hand: rerun `npm run import:local-rates` instead.',
  '// Source files:',
  ...sourceLines,
  '',
  "export type LocalUnitType = 'municipality' | 'town' | 'large-town-or-county-seat' | 'zagreb'",
  '',
  'export interface LocalRateRow {',
  '  /** The official name, such as `Grad Zagreb` or `Općina Bale – Valle`. */',
  '  readonly unit: string',
  '  readonly county: string',
  '  readonly unitType: LocalUnitType',
  '  /** In basis points. */',
  '  readonly lowerRate: number',
  '  /** In basis points. */',
  '  readonly higherRate: number',
  '  /** The NN issues the table lists for the unit. `114/23` alone means the unit adopted no decision. */',
  '  readonly decision: string',
  '  readonly appliesFrom: string',
  '}',
  '',
  'export interface LocalRateTable {',
  '  readonly validFrom: string',
  '  readonly validTo: string',
  '  /** The NN issues of the units\' decisions in the table, oldest first, without `114/23`. */',
  '  readonly decisionIssues: readonly string[]',
  '  readonly rows: readonly LocalRateRow[]',
  '}',
  '',
  '/** The NN issues of every table, oldest first. */',
  `export const LOCAL_RATE_DECISION_ISSUES: readonly string[] = [${decisionIssuesOf(tables.flatMap((table) => table.rows)).map(quoted).join(', ')}]`,
  '',
  'export const LOCAL_RATE_TABLES: readonly LocalRateTable[] = [',
  ...tables.flatMap(tableBlock),
  ']',
  '',
]

writeFileSync(options.out, lines.join('\n'))
for (const table of tables) {
  console.log(`${table.validFrom} to ${table.validTo}: ${table.rows.length} units from ${basename(table.path)}`)
}
console.log(`Wrote ${options.out}.`)
