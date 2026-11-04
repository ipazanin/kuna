import type { FundFact, ProfileFact } from '../../src/apps/investments/prices/domain/pricesFile'

/** A company profile asked on the day, with the parts given and every other part null. */
export function profileFact(asked: string, parts: Partial<Omit<ProfileFact, 'asked'>> = {}): ProfileFact {
  return { asked, industry: null, country: null, exchange: null, marketCap: null, currency: null, ipo: null, failed: null, ...parts }
}

/** A fund profile asked on the day, with the parts given, every other part null and no sectors. */
export function fundFact(asked: string, parts: Partial<Omit<FundFact, 'asked'>> = {}): FundFact {
  return { asked, expenseRatio: null, netAssets: null, inception: null, leveraged: null, holdings: null, dividendYield: null, sectors: [], failed: null, ...parts }
}
