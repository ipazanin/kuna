/**
 * Writes the foreign per diems of every state into the ruleset, from the Narodne novine page of the
 * Odluka o visini dnevnice za službeno putovanje u inozemstvo (NN 16/24, item 277).
 *
 *   npm run import:foreign-per-diems -- <saved html of the NN page> [--out <ts>]
 *
 * Each row is keyed by the state's ISO 3166-1 alpha-2 code. The row for every state the Odluka does
 * not list ("sve druge države") is keyed `other`. The Odluka gives each amount in euros or US
 * dollars, and the row keeps its own currency. The script refuses a name it cannot map, a missing or
 * repeated row, and an amount in any other currency.
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const DEFAULT_OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/apps/company/packs/hr-doo/ruleset/rules/generatedForeignPerDiems.ts')

const OTHER_STATES = 'sve druge države'

/** The Odluka's names of states and areas. Kosovo has no ISO 3166-1 code and takes the user-assigned XK. */
const COUNTRY_CODES = new Map([
  ['Islamska Republika Afganistan', 'AF'],
  ['Republika Albanija', 'AL'],
  ['Alžirska Narodna Demokratska Republika', 'DZ'],
  ['Kneževina Andora', 'AD'],
  ['Republika Angola', 'AO'],
  ['Argentinska Republika', 'AR'],
  ['Republika Armenija', 'AM'],
  ['Australija', 'AU'],
  ['Republika Austrija', 'AT'],
  ['Republika Azerbajdžan', 'AZ'],
  ['Kraljevina Belgija', 'BE'],
  ['Republika Bjelarus', 'BY'],
  ['Višenacionalna Država Bolivija', 'BO'],
  ['Bosna i Hercegovina', 'BA'],
  ['Savezna Republika Brazil', 'BR'],
  ['Republika Bugarska', 'BG'],
  ['Republika Cipar', 'CY'],
  ['Crna Gora', 'ME'],
  ['Češka Republika', 'CZ'],
  ['Republika Čile', 'CL'],
  ['Kraljevina Danska', 'DK'],
  ['Demokratska Narodna Republika Koreja', 'KP'],
  ['Arapska Republika Egipat', 'EG'],
  ['Republika Estonija', 'EE'],
  ['Savezna Demokratska Republika Etiopija', 'ET'],
  ['Republika Filipini', 'PH'],
  ['Republika Finska', 'FI'],
  ['Francuska Republika', 'FR'],
  ['Helenska Republika', 'GR'],
  ['Gruzija', 'GE'],
  ['Republika Indija', 'IN'],
  ['Republika Indonezija', 'ID'],
  ['Republika Irak', 'IQ'],
  ['Islamska Republika Iran', 'IR'],
  ['Irska', 'IE'],
  ['Republika Island', 'IS'],
  ['Talijanska Republika', 'IT'],
  ['Država Izrael', 'IL'],
  ['Jamajka', 'JM'],
  ['Japan', 'JP'],
  ['Republika Jemen', 'YE'],
  ['Hašemitska Kraljevina Jordan', 'JO'],
  ['Republika Južna Afrika', 'ZA'],
  ['Kanada', 'CA'],
  ['Država Katar', 'QA'],
  ['Republika Kazahstan', 'KZ'],
  ['Republika Kenija', 'KE'],
  ['Narodna Republika Kina', 'CN'],
  ['Posebno upravno područje Hong Kong Narodne Republike Kine', 'HK'],
  ['Kirgiska Republika', 'KG'],
  ['Republika Kolumbija', 'CO'],
  ['Republika Kongo', 'CG'],
  ['Republika Kosovo', 'XK'],
  ['Republika Kuba', 'CU'],
  ['Država Kuvajt', 'KW'],
  ['Republika Latvija', 'LV'],
  ['Libanonska Republika', 'LB'],
  ['Republika Liberija', 'LR'],
  ['Država Libija', 'LY'],
  ['Kneževina Lihtenštajn', 'LI'],
  ['Republika Litva', 'LT'],
  ['Veliko Vojvodstvo Luksemburg', 'LU'],
  ['Mađarska', 'HU'],
  ['Malezija', 'MY'],
  ['Republika Malta', 'MT'],
  ['Sjedinjene Meksičke Države', 'MX'],
  ['Kneževina Monako', 'MC'],
  ['Republika Mozambik', 'MZ'],
  ['Kraljevina Nizozemska', 'NL'],
  ['Kraljevina Norveška', 'NO'],
  ['Novi Zeland', 'NZ'],
  ['Savezna Republika Njemačka', 'DE'],
  ['Islamska Republika Pakistan', 'PK'],
  ['Republika Panama', 'PA'],
  ['Republika Peru', 'PE'],
  ['Republika Poljska', 'PL'],
  ['Portugalska Republika', 'PT'],
  ['Republika Koreja', 'KR'],
  ['Republika Moldova', 'MD'],
  ['Republika Sjeverna Makedonija', 'MK'],
  ['Rumunjska', 'RO'],
  ['Ruska Federacija', 'RU'],
  ['Republika San Marino', 'SM'],
  ['Kraljevina Saudijska Arabija', 'SA'],
  ['Republika Senegal', 'SN'],
  ['Republika Singapur', 'SG'],
  ['Sirijska Arapska Republika', 'SY'],
  ['Sjedinjene Američke Države', 'US'],
  ['Slovačka Republika', 'SK'],
  ['Republika Slovenija', 'SI'],
  ['Republika Srbija', 'RS'],
  ['Republika Sudan', 'SD'],
  ['Kraljevina Španjolska', 'ES'],
  ['Kraljevina Švedska', 'SE'],
  ['Švicarska Konfederacija', 'CH'],
  ['Republika Tadžikistan', 'TJ'],
  ['Kraljevina Tajland', 'TH'],
  ['Republika Tunis', 'TN'],
  ['Turkmenistan', 'TM'],
  ['Republika Turska', 'TR'],
  ['Ujedinjena Kraljevina Velike Britanije i Sjeverne Irske', 'GB'],
  ['Ujedinjeni Arapski Emirati', 'AE'],
  ['Ukrajina', 'UA'],
  ['Republika Uzbekistan', 'UZ'],
  ['Država Vatikanskoga Grada', 'VA'],
  [OTHER_STATES, 'other'],
])

const CURRENCIES = new Set(['EUR', 'USD'])

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: 'string', default: DEFAULT_OUT } },
})

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (positionals.length !== 1) {
  fail('Give the saved HTML of the NN page of the Odluka, NN 16/24, item 277.')
}

const path = positionals[0]
const page = readFileSync(path)

function cellText(cell) {
  return cell
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;| /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** `90,00 EUR` is 9000 cents of euros. */
function amountOf(written, where) {
  const match = /^(\d+),(\d{2}) ([A-Z]{3})$/.exec(written)
  if (match === null) {
    fail(`${where}: "${written}" is not an amount written as 0,00 and a currency.`)
  }
  if (!CURRENCIES.has(match[3])) {
    fail(`${where}: ${match[3]} is not a currency the ruleset keeps.`)
  }
  return { fullDay: Number(match[1]) * 100 + Number(match[2]), currency: match[3] }
}

const rows = [...page.toString('utf8').matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)]
  .map((row) => [...row[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((cell) => cellText(cell[1])))
  .filter((cells) => cells.length === 3 && /^\d+\.$/.test(cells[0]))
  .map(([number, name, amount], index) => {
    const where = `Row ${number}`
    if (Number.parseInt(number, 10) !== index + 1) {
      fail(`${where}: expected row ${index + 1}.`)
    }
    const country = COUNTRY_CODES.get(name)
    if (country === undefined) {
      fail(`${where}: no country code for "${name}".`)
    }
    return { row: index + 1, country, name, ...amountOf(amount, where) }
  })

const countries = rows.map((row) => row.country)
if (rows.length !== COUNTRY_CODES.size || new Set(countries).size !== countries.length) {
  fail(`The page lists ${rows.length} rows with ${new Set(countries).size} countries, not the ${COUNTRY_CODES.size} the script maps.`)
}

function quoted(text) {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

const digest = createHash('sha256').update(page).digest('hex')

const lines = [
  '// Generated by scripts/import-foreign-per-diems.mjs. Do not edit by hand: rerun `npm run import:foreign-per-diems` instead.',
  '// Source file:',
  `//   ${basename(path)}  sha256 ${digest}`,
  '',
  "export type PerDiemCurrency = 'EUR' | 'USD'",
  '',
  'export interface ForeignPerDiemRow {',
  '  /** The row number in item I of the Odluka. */',
  '  readonly row: number',
  '  /** ISO 3166-1 alpha-2, XK for Kosovo, or `other` for every state the Odluka does not list. */',
  '  readonly country: string',
  '  /** The name as the Odluka writes it. */',
  '  readonly name: string',
  "  /** Whole cents of the row's own currency. */",
  '  readonly fullDay: number',
  '  readonly currency: PerDiemCurrency',
  '}',
  '',
  'export const FOREIGN_PER_DIEM_ROWS: readonly ForeignPerDiemRow[] = [',
  ...rows.map((row) => `  { row: ${row.row}, country: ${quoted(row.country)}, name: ${quoted(row.name)}, fullDay: ${row.fullDay}, currency: ${quoted(row.currency)} },`),
  ']',
  '',
]

writeFileSync(options.out, lines.join('\n'))
for (const currency of CURRENCIES) {
  console.log(`${currency}: ${rows.filter((row) => row.currency === currency).length} rows`)
}
console.log(`Wrote ${options.out}.`)
