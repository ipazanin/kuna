import { normaliseIban } from './fold'

/**
 * Each Croatian payment service provider's leading number (vodeći broj, VBDI) with the name a person calls it by.
 * The numbers are HNB's list of leading numbers of payment service providers, last updated by HNB on 27 March 2025 and read on 27 November 2026:
 * https://www.hnb.hr/temeljne-funkcije/platni-promet/vodeci-brojevi-pruzatelja-platnih-usluga
 */
const BANKS_BY_LEADING_NUMBER: ReadonlyMap<string, string> = new Map([
  ['2500009', 'Addiko Bank'],
  ['2481000', 'Agram banka'],
  ['4501006', 'Aircash'],
  ['4133006', 'Banka Kovanica'],
  ['2488001', 'BKS Bank'],
  ['2485003', 'Croatia banka'],
  ['2402006', 'Erste banka'],
  ['1001005', 'Hrvatska narodna banka'],
  ['2390001', 'Hrvatska poštanska banka'],
  ['2492008', 'Imex banka'],
  ['2380006', 'Istarska kreditna banka Umag'],
  ['2489004', 'J&T banka'],
  ['2400008', 'Karlovačka banka'],
  ['4124003', 'KentBank'],
  ['2407000', 'OTP banka'],
  ['2408002', 'Partner banka'],
  ['2386002', 'Podravska banka'],
  ['2340009', 'Privredna banka Zagreb'],
  ['2484008', 'Raiffeisenbank Austria'],
  ['2403009', 'Samoborska banka'],
  ['2412009', 'Slatinska banka'],
  ['2360000', 'Zagrebačka banka'],
])

/** The Croatian bank a Croatian IBAN names by the leading number in its fifth to eleventh characters, or null for another country's IBAN, a shorter text or a number no bank has. */
export function bankOfIban(iban: string): string | null {
  const normalised = normaliseIban(iban)
  if (!normalised.startsWith('HR')) {
    return null
  }
  return BANKS_BY_LEADING_NUMBER.get(normalised.slice(4, 11)) ?? null
}
