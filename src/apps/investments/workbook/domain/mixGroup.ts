import { INSTRUMENT_CLASSES } from './instrument'
import type { InstrumentClass } from './instrument'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The eleven GICS sectors. */
export const SECTORS = [
  'information-technology',
  'financials',
  'health-care',
  'consumer-discretionary',
  'consumer-staples',
  'industrials',
  'energy',
  'materials',
  'utilities',
  'real-estate',
  'communication-services',
] as const

export type Sector = (typeof SECTORS)[number]

/** What a fund spread over many countries names in place of one. */
export const REGIONS = ['world', 'europe', 'north-america', 'asia-pacific', 'emerging-markets'] as const

export type Region = (typeof REGIONS)[number]

/** A country by its ISO 3166 code such as US, or a region such as world. */
export type Country = string & { readonly __unit: 'country' }

/** The officially assigned ISO 3166-1 alpha-2 codes. */
export const COUNTRY_CODES: readonly Country[] = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ ' +
  'DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ ' +
  'OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
  'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ') as Country[]

const COUNTRIES: ReadonlySet<string> = new Set(COUNTRY_CODES)

/** The country in capitals or the region in lower case, or null for anything else. */
export function countryOf(text: string): Country | null {
  const region = text.trim().toLowerCase()
  if ((REGIONS as readonly string[]).includes(region)) return region as Country
  const code = text.trim().toUpperCase()
  return COUNTRIES.has(code) ? (code as Country) : null
}

/** The ways the value can be split. Sector and country split the holdings, the rest the whole value with its cash. */
export const MIXES = ['sector', 'currency', 'country', 'class', 'account'] as const

export type Mix = (typeof MIXES)[number]

/** The class groups, which count cash as one more. */
export const CLASS_GROUPS = [...INSTRUMENT_CLASSES, 'cash'] as const

export type ClassGroup = InstrumentClass | 'cash'

/** One group of one mix, such as the US of the country mix or an account of the account mix. */
export type MixGroup =
  | { readonly mix: 'sector'; readonly group: Sector }
  | { readonly mix: 'country'; readonly group: Country }
  | { readonly mix: 'class'; readonly group: ClassGroup }
  | { readonly mix: 'currency'; readonly group: CurrencyCode }
  | { readonly mix: 'account'; readonly group: RecordId }

/** A fund's own mix splits it by sector or by country. */
export const FUND_MIXES = ['sector', 'country'] as const

export type FundMixGroup = Extract<MixGroup, { readonly mix: (typeof FUND_MIXES)[number] }>
