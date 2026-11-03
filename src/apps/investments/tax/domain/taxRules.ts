import { dividedRounded, moneyFromCents } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** How sure a rule is: the law or Porezna says it, it is a reading of the law, or no source says it. */
export type RuleMark = 'settled' | 'reading' | 'unconfirmed'

/** Each rule the tax figures rest on, by how sure it is. The screen lists them with their words and sources. */
export const RULE_MARKS = {
  gainsRate: 'settled',
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
}

const RULES: readonly CapitalTaxRules[] = [2024, 2025, 2026].map((year) => ({ year, gainsRate: 12, incomeRate: 12, usWithholding: 30, usTreaty: false }))

export interface YearRules {
  readonly rules: CapitalTaxRules
  /** False for a year with no row of its own, which takes the nearest year's row. */
  readonly ownRow: boolean
}

export function rulesOf(year: number): YearRules {
  const own = RULES.find((rules) => rules.year === year)
  if (own !== undefined) {
    return { rules: own, ownRow: true }
  }
  return { rules: year < RULES[0]!.year ? RULES[0]! : RULES.at(-1)!, ownRow: false }
}

/** A whole percent of an amount, rounded half away from zero to the cent. */
export function percentOf(amount: Money, percent: number): Money {
  return moneyFromCents(dividedRounded(amount * percent, 100))
}
