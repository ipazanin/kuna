import { civilDate, daysBetween, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** How sure a rule is: the law or Porezna says it, it is a reading of the law, or no source says it. */
export type RuleMark = 'settled' | 'reading' | 'unconfirmed'

/** How sure a rule is, and the file and heading under docs/law/ that states it. */
export interface RuleBasis {
  readonly mark: RuleMark
  readonly law: `investments/${string}.md#${string}`
}

/** Each rule the tax figures rest on. The screen lists them with their words, marks and sources. */
export const TAX_RULES = {
  gainsRate: { mark: 'settled', law: 'investments/capital-gains.md#rates-by-year' },
  rates2023: { mark: 'settled', law: 'investments/capital-gains.md#income-of-2023' },
  citySurtax2023: { mark: 'reading', law: 'investments/capital-gains.md#city-surtax-of-2023' },
  twoYears: { mark: 'settled', law: 'investments/capital-gains.md#the-two-year-exemption' },
  anniversary: { mark: 'reading', law: 'investments/capital-gains.md#counting-the-two-years' },
  fifoAcrossAccounts: { mark: 'reading', law: 'investments/capital-gains.md#fifo-per-isin-across-accounts' },
  registerCurrency: { mark: 'settled', law: 'investments/capital-gains.md#the-register-and-its-currency' },
  convertOnce: { mark: 'reading', law: 'investments/capital-gains.md#converting-a-gain-once' },
  hnbRateDay: { mark: 'reading', law: 'investments/hnb-rates-and-settlement.md#which-hnb-list' },
  settlementDay: { mark: 'reading', law: 'investments/hnb-rates-and-settlement.md#the-settlement-day-as-the-payment-day' },
  decemberSale: { mark: 'reading', law: 'investments/capital-gains.md#which-year-a-sale-counts-in' },
  sameYearLosses: { mark: 'settled', law: 'investments/capital-gains.md#losses' },
  oldLosses: { mark: 'settled', law: 'investments/capital-gains.md#losses-on-lots-past-two-years' },
  fees: { mark: 'reading', law: 'investments/capital-gains.md#fees' },
  joppdDeadline: { mark: 'settled', law: 'investments/joppd-for-investors.md#due-dates' },
  lossYear: { mark: 'settled', law: 'investments/joppd-for-investors.md#who-files' },
  taxFreeInLossYear: { mark: 'unconfirmed', law: 'investments/joppd-for-investors.md#who-files' },
  joppdCodes: { mark: 'settled', law: 'investments/joppd-for-investors.md#codes' },
  joppdMapping: { mark: 'reading', law: 'investments/joppd-for-investors.md#the-capital-gains-joppd' },
  gainsRecipient: { mark: 'unconfirmed', law: 'investments/joppd-for-investors.md#recipient-1001-or-1003' },
  codeTwoForShares: { mark: 'settled', law: 'investments/joppd-for-investors.md#the-code-02-line' },
  foreignCredit: { mark: 'settled', law: 'investments/foreign-capital-income.md#the-credit-for-tax-withheld-abroad' },
  usTreaty: { mark: 'settled', law: 'investments/foreign-capital-income.md#us-withholding' },
  withheldAbroad: { mark: 'settled', law: 'investments/foreign-capital-income.md#tax-withheld-abroad-ino-izjava-and-ino-doh' },
  inoDohWeekend: { mark: 'reading', law: 'investments/filing-calendar.md#weekends-and-holidays' },
  thirtyDays: { mark: 'settled', law: 'investments/foreign-capital-income.md#nothing-withheld-the-30-day-joppd' },
  thirtyDayReport: { mark: 'settled', law: 'investments/foreign-capital-income.md#nothing-withheld-the-30-day-joppd' },
  thirtyDayCodes: { mark: 'reading', law: 'investments/joppd-for-investors.md#codes' },
  brokerInterest: { mark: 'reading', law: 'investments/foreign-capital-income.md#interest-a-broker-pays' },
  bondCoupons: { mark: 'settled', law: 'investments/foreign-capital-income.md#income-from-abroad' },
  stockLending: { mark: 'reading', law: 'investments/other-investment-income.md#stock-lending' },
  referralCredit: { mark: 'unconfirmed', law: 'investments/other-investment-income.md#referral-credits' },
  referralContributions: { mark: 'settled', law: 'investments/other-investment-income.md#contributions-on-a-referral-credit' },
  croatianIsin: { mark: 'reading', law: 'investments/foreign-capital-income.md#payments-of-a-croatian-isin' },
  usSettlement: { mark: 'settled', law: 'investments/hnb-rates-and-settlement.md#settlement-cycles' },
  europeSettlement: { mark: 'settled', law: 'investments/hnb-rates-and-settlement.md#settlement-cycles' },
} as const satisfies Readonly<Record<string, RuleBasis>>

export type TaxRule = keyof typeof TAX_RULES

/** The JOPPD codes Kuna writes, from the form's annexes. A recipient code goes in field 6.1 and a receipt code in 6.2. */
export const JOPPD_CODES = {
  /** Report type 11, a capital gains report a person files. */
  gainsReportType: '11',
  /** Submitter 4, a private person. */
  submitter: '4',
  /** Report type 8, a JOPPD a person files within 30 days for income received straight from abroad. */
  foreignReportType: '8',
  gains: { recipient: '1001', receipt: '1006' },
  /** Field 15.1 of the line for gains past two years, which carries 0000 in 6.1 and 6.2. */
  taxFree: { nonTaxable: '02', recipientAndReceipt: '0000' },
  dividend: { recipient: '1003', receipt: '1001' },
  interest: { recipient: '1103', receipt: '1005' },
  referral: { recipient: '4002', receipt: '4025' },
} as const

/** The JOPPD's report mark of a day: the year's two digits and the day of the year, 26365 for 31 December 2026. */
export function joppdReportMark(day: CivilDate): string {
  const dayOfYear = daysBetween(civilDate(yearOf(day), 1, 1), day) + 1
  return `${String(yearOf(day) % 100).padStart(2, '0')}${String(dayOfYear).padStart(3, '0')}`
}

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
