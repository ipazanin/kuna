import { dividedRounded, moneyFromCents } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** How sure a rule is: the law or Porezna says it, it is a reading of the law, or no source says it. */
export type RuleMark = 'settled' | 'reading' | 'unconfirmed'

/** Each rule the tax figures rest on, by how sure it is. The screen lists them with their words and sources. */
export const RULE_MARKS = {
  gainsRate: 'settled',
  rates2023: 'settled',
  twoYears: 'settled',
  anniversary: 'reading',
  fifoAcrossAccounts: 'reading',
  registerCurrency: 'settled',
  convertOnce: 'reading',
  hnbRateDay: 'reading',
  settlementDay: 'reading',
  decemberSale: 'reading',
  sameYearLosses: 'settled',
  oldLosses: 'reading',
  joppdDeadline: 'settled',
  joppdCodes: 'settled',
  joppdMapping: 'reading',
  gainsRecipient: 'unconfirmed',
  codeTwoForShares: 'reading',
  foreignCredit: 'settled',
  usTreaty: 'settled',
  withheldAbroad: 'settled',
  inoDohWeekend: 'reading',
  thirtyDays: 'settled',
  thirtyDayCodes: 'reading',
  brokerInterest: 'reading',
  stockLending: 'reading',
  referralCredit: 'unconfirmed',
  referralContributions: 'settled',
  croatianIsin: 'reading',
  usSettlement: 'settled',
  europeSettlement: 'unconfirmed',
} as const satisfies Readonly<Record<string, RuleMark>>

export type TaxRule = keyof typeof RULE_MARKS

/** The tax on capital in one year, as the law in force that year sets it. */
export interface CapitalTaxRules {
  readonly year: number
  /** Whole percent of the base, on capital gains. */
  readonly gainsRate: number
  /** Whole percent of the gross, on dividends and interest. */
  readonly incomeRate: number
  /** What the US withholds from a dividend paid to a resident of Croatia, in whole percent. */
  readonly usWithholding: number
  /** Whether a treaty with the US is in force, which would lower that withholding. */
  readonly usTreaty: boolean
  /** Whether the city's surtax is due on top of the tax, as it was on income up to 31 Dec 2023. */
  readonly surtax: boolean
}

/** Income up to 2023 stays under the law as it stood then: 10% and the city's surtax. Prirez ends with 2023, and the rates rise to 12%. */
const RULES: readonly CapitalTaxRules[] = [
  { year: 2023, gainsRate: 10, incomeRate: 10, usWithholding: 30, usTreaty: false, surtax: true },
  ...[2024, 2025, 2026].map((year) => ({ year, gainsRate: 12, incomeRate: 12, usWithholding: 30, usTreaty: false, surtax: false })),
]

/** The first year Kuna has rules for. Earlier years are not worked out at all. */
export const FIRST_TAX_YEAR = RULES[0]!.year

export interface YearRules {
  readonly rules: CapitalTaxRules
  /** False for a year past the last row, which takes the last row. */
  readonly ownRow: boolean
}

/** The year's row, or the last row for a later year. A year before the first row has no rules, and asking for one is a mistake. */
export function rulesOf(year: number): YearRules {
  if (year < FIRST_TAX_YEAR) {
    throw new RangeError(`Kuna has no tax rules for ${year}.`)
  }
  const own = RULES.find((rules) => rules.year === year)
  return own === undefined ? { rules: RULES.at(-1)!, ownRow: false } : { rules: own, ownRow: true }
}

/** A whole percent of an amount, rounded half away from zero to the cent. */
export function percentOf(amount: Money, percent: number): Money {
  return moneyFromCents(dividedRounded(amount * percent, 100))
}
