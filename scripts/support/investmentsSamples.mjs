/**
 * The bare UUIDs of the fake Investments sample's instruments, and the name a holding page's flow waits for, without the
 * figures investmentsScreens.mjs works out, so the flow lists load in a moment.
 */

/** Example Tech of the sample, in US dollars with its first lot partly sold, and Example Spinco, received in a spin-off, split two for one and priced by hand. */
export const SAMPLE_SHARE_A = 'fa4e1000-0000-4000-8000-000000000010'
export const SAMPLE_SHARE_A_NAME = 'Example Tech'
export const SAMPLE_SPIN_CO = 'fa4e1000-0000-4000-8000-000000000014'
/** The sample's World ETF, accumulating, with its own mix by sector and by country, and its Index Fund, never bought, with no mix. */
export const SAMPLE_WORLD_ETF = 'fa4e1000-0000-4000-8000-000000000012'
export const SAMPLE_INDEX_FUND = 'fa4e1000-0000-4000-8000-000000000015'
/** The sample's Example Dividend Co, whose company profile Finnhub refused, and its Money Fund, with a whole fund profile from Alpha Vantage and no TER typed. */
export const SAMPLE_SHARE_B = 'fa4e1000-0000-4000-8000-000000000011'
export const SAMPLE_MONEY_FUND = 'fa4e1000-0000-4000-8000-000000000013'
/** The sample's Example Retired Co, sold in full, with prices from a year before its first buy. */
export const SAMPLE_RETIRED_CO = 'fa4e1000-0000-4000-8000-000000000016'
