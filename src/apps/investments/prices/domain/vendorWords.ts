import type { InstrumentType } from '../../workbook/domain/instrument'
import type { Sector } from '../../workbook/domain/mixGroup'

// Every table below is read from the vendors' documentation and examples, unconfirmed until a request with a real key.
// A word missing from a table counts as not known, so an unexpected answer leaves a holding in "Other and not known".

/** Finnhub's `finnhubIndustry` of profile2 answers, by the GICS sector it falls in. */
const INDUSTRY_SECTORS: Readonly<Record<string, Sector>> = {
  Technology: 'information-technology',
  Semiconductors: 'information-technology',
  'Electrical Equipment': 'industrials',
  Communications: 'communication-services',
  Telecommunication: 'communication-services',
  Media: 'communication-services',
  Banking: 'financials',
  Banks: 'financials',
  'Financial Services': 'financials',
  Insurance: 'financials',
  Pharmaceuticals: 'health-care',
  Biotechnology: 'health-care',
  'Health Care': 'health-care',
  'Life Sciences Tools & Services': 'health-care',
  Retail: 'consumer-discretionary',
  Automobiles: 'consumer-discretionary',
  'Auto Components': 'consumer-discretionary',
  'Hotels, Restaurants & Leisure': 'consumer-discretionary',
  'Textiles, Apparel & Luxury Goods': 'consumer-discretionary',
  'Leisure Products': 'consumer-discretionary',
  'Diversified Consumer Services': 'consumer-discretionary',
  Distributors: 'consumer-discretionary',
  'Food Products': 'consumer-staples',
  Beverages: 'consumer-staples',
  Tobacco: 'consumer-staples',
  'Consumer products': 'consumer-staples',
  'Aerospace & Defense': 'industrials',
  Airlines: 'industrials',
  Machinery: 'industrials',
  Building: 'industrials',
  Construction: 'industrials',
  'Commercial Services & Supplies': 'industrials',
  'Industrial Conglomerates': 'industrials',
  'Logistics & Transportation': 'industrials',
  'Road & Rail': 'industrials',
  Marine: 'industrials',
  'Professional Services': 'industrials',
  'Trading Companies & Distributors': 'industrials',
  'Transportation Infrastructure': 'industrials',
  Energy: 'energy',
  'Oil & Gas': 'energy',
  Chemicals: 'materials',
  'Metals & Mining': 'materials',
  Packaging: 'materials',
  'Paper & Forest': 'materials',
  Utilities: 'utilities',
  'Real Estate': 'real-estate',
}

/** Alpha Vantage's ETF_PROFILE sector names, in capitals as its example answer writes them, by GICS sector. */
const FUND_SECTORS: Readonly<Record<string, Sector>> = {
  'INFORMATION TECHNOLOGY': 'information-technology',
  FINANCIALS: 'financials',
  HEALTHCARE: 'health-care',
  'HEALTH CARE': 'health-care',
  'CONSUMER DISCRETIONARY': 'consumer-discretionary',
  'CONSUMER STAPLES': 'consumer-staples',
  INDUSTRIALS: 'industrials',
  ENERGY: 'energy',
  MATERIALS: 'materials',
  UTILITIES: 'utilities',
  'REAL ESTATE': 'real-estate',
  'COMMUNICATION SERVICES': 'communication-services',
}

/**
 * What a search answer calls a listing, by Kuna's type: Twelve Data's `instrument_type`, Alpha Vantage's `3. type` and
 * Finnhub's `type`. A word that could be any of several types, such as Twelve Data's `Structured Product`, is left out.
 */
const LISTING_TYPES: Readonly<Record<string, InstrumentType>> = {
  'Common Stock': 'share',
  'Preferred Stock': 'share',
  'Depositary Receipt': 'share',
  ADR: 'share',
  GDR: 'share',
  REIT: 'share',
  Equity: 'share',
  ETF: 'fund',
  ETP: 'fund',
  ETC: 'fund',
  'Mutual Fund': 'fund',
  'Closed-end Fund': 'fund',
  'Open-End Fund': 'fund',
  Bond: 'bond',
  'Digital Currency': 'crypto',
  Crypto: 'crypto',
}

/** A lookup that ignores case and the spaces around a word. */
function lookup<Meaning>(table: Readonly<Record<string, Meaning>>): (word: string) => Meaning | null {
  const byWord = new Map(Object.entries(table).map(([word, meaning]) => [word.toLowerCase(), meaning]))
  return (word) => byWord.get(word.trim().toLowerCase()) ?? null
}

export const sectorOfIndustry = lookup(INDUSTRY_SECTORS)

export const sectorOfFundSector = lookup(FUND_SECTORS)

export const typeOfListing = lookup(LISTING_TYPES)
