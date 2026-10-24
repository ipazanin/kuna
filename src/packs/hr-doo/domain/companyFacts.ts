import { civilDateFromSerial, parseCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { folderPathOf } from '../../../shared/text/folderPath'
import { booleanOf } from '../../../features/settings/domain/settings'
import type { PackSettings, SettingCell } from '../../../features/settings/domain/settings'

const CITY_MAX_LENGTH = 60

const EARLIEST_BIRTH_YEAR = 1900
const LATEST_BIRTH_YEAR = 2100

const MOST_DEPENDANTS = 20

const BASIS_POINTS_PER_WHOLE = 10_000

/** Which corporate tax return the company files: `pd` on the accrual profit, `pd-nn` on cash received and paid. */
export const CIT_RETURNS = ['pd', 'pd-nn'] as const

export type CitReturn = (typeof CIT_RETURNS)[number]

/** When VAT falls due: on the invoice, or when it is paid. */
export const VAT_PRINCIPLES = ['invoice', 'cash'] as const

export type VatPrinciple = (typeof VAT_PRINCIPLES)[number]

/** Where the accountant's monthly VAT returns are filed, as folder names from My Drive down. */
export const DEFAULT_VAT_RETURNS_FOLDER: readonly string[] = ['work', 'dss', 'dss-finance', 'vat-returns']

/** Where the accountant's salary workbooks are filed, a folder for each year and month inside. */
export const DEFAULT_PAYROLL_FOLDER: readonly string[] = ['work', 'dss', 'dss-finance', 'payroll']

/**
 * What the pack needs to know about this company and its owner that the law does not say. These
 * are the owner's own facts, so they live in the workbook and never in the app.
 */
export interface CompanyFacts {
  /** Where the owner lives, which sets the local income tax rates. Blank when not given. */
  readonly residenceCity: string
  /** For the youth income tax relief. Null when not given. */
  readonly birthYear: number | null
  /** Whether the owner pays into the second pension pillar, which splits the pension contribution. */
  readonly pensionPillarTwo: boolean
  /** Dependants who raise the personal allowance. */
  readonly dependants: number
  /** The day the company was registered, which starts its first tax period. Null when not given. */
  readonly companyRegistered: CivilDate | null
  readonly citReturn: CitReturn
  readonly vatPrinciple: VatPrinciple
  /** The default for assets: whether the accountant doubles depreciation rates. */
  readonly depreciationDoubled: boolean
  /** The yearly interest rate the owner's loans carry, in basis points, so 200 is 2%. */
  readonly ownerLoanInterest: number
  /** The Drive folder of the accountant's VAT returns, as folder names from My Drive down. */
  readonly vatReturnsFolder: readonly string[]
  /** The Drive folder of the accountant's salary workbooks, as folder names from My Drive down. */
  readonly payrollFolder: readonly string[]
}

/** The pack's settings keys, read and checked whatever the owner-pay switch says. */
export const COMPANY_FACT_SETTINGS: PackSettings<CompanyFacts> = {
  defaults: {
    residenceCity: '',
    birthYear: null,
    pensionPillarTwo: true,
    dependants: 0,
    companyRegistered: null,
    citReturn: 'pd',
    vatPrinciple: 'invoice',
    depreciationDoubled: false,
    ownerLoanInterest: 0,
    vatReturnsFolder: DEFAULT_VAT_RETURNS_FOLDER,
    payrollFolder: DEFAULT_PAYROLL_FOLDER,
  },
  definitions: [
  {
    key: 'hr_residence_city',
    note: 'The city or municipality the owner lives in, such as Zagreb. It sets the local income tax rates, so payroll figures stay empty while it is blank.',
    valueOf: (facts) => facts.residenceCity,
    apply: (facts, cell) => {
      const city = String(cell).trim()
      return residenceCityProblem(city) ?? withFacts(facts, { residenceCity: city })
    },
  },
  {
    key: 'hr_birth_year',
    note: "The owner's year of birth, such as 1990, for the youth income tax relief. Blank means no relief is assumed.",
    valueOf: (facts) => facts.birthYear ?? '',
    apply: (facts, cell) => {
      const year = typeof cell === 'number' ? cell : Number(String(cell).trim())
      return birthYearProblem(year) ?? withFacts(facts, { birthYear: year })
    },
  },
  {
    key: 'hr_pension_pillar_2',
    note: 'TRUE when the owner pays into the second pension pillar, FALSE when the whole pension contribution goes to the first.',
    valueOf: (facts) => facts.pensionPillarTwo,
    apply: (facts, cell) => {
      const pillarTwo = booleanOf(cell)
      return pillarTwo === null ? `"${String(cell)}" is neither TRUE nor FALSE` : withFacts(facts, { pensionPillarTwo: pillarTwo })
    },
  },
  {
    key: 'hr_dependants',
    note: 'How many dependants raise the personal allowance, as a whole number. Blank means 0.',
    valueOf: (facts) => facts.dependants,
    apply: (facts, cell) => {
      const dependants = typeof cell === 'number' ? cell : Number(String(cell).trim())
      return dependantsProblem(dependants) ?? withFacts(facts, { dependants })
    },
  },
  {
    key: 'hr_company_registered',
    note: 'The day the company was registered, as a date or as text such as 2025-05-12. It starts the first tax period.',
    valueOf: (facts) => facts.companyRegistered ?? '',
    apply: (facts, cell) => {
      const registered = typeof cell === 'number' && Number.isFinite(cell) ? civilDateFromSerial(cell) : parseCivilDate(String(cell).trim())
      return registered === null ? `"${String(cell)}" is not a date such as 2025-05-12` : withFacts(facts, { companyRegistered: registered })
    },
  },
  {
    key: 'hr_cit_return',
    note: 'pd for the corporate tax return on the accrual profit, pd-nn for the return on cash received and paid.',
    valueOf: (facts) => facts.citReturn,
    apply: (facts, cell) => {
      const citReturn = String(cell).trim().toLowerCase()
      return isOneOf(citReturn, CIT_RETURNS) ? withFacts(facts, { citReturn }) : `"${citReturn}" is neither ${CIT_RETURNS.join(' nor ')}`
    },
  },
  {
    key: 'hr_vat_principle',
    note: 'invoice when VAT falls due on the invoice date, cash when it falls due on payment.',
    valueOf: (facts) => facts.vatPrinciple,
    apply: (facts, cell) => {
      const vatPrinciple = String(cell).trim().toLowerCase()
      return isOneOf(vatPrinciple, VAT_PRINCIPLES) ? withFacts(facts, { vatPrinciple }) : `"${vatPrinciple}" is neither ${VAT_PRINCIPLES.join(' nor ')}`
    },
  },
  {
    key: 'hr_depreciation_doubled',
    note: 'TRUE when the accountant doubles the depreciation rates by default. An asset row can still say otherwise.',
    valueOf: (facts) => facts.depreciationDoubled,
    apply: (facts, cell) => {
      const doubled = booleanOf(cell)
      return doubled === null ? `"${String(cell)}" is neither TRUE nor FALSE` : withFacts(facts, { depreciationDoubled: doubled })
    },
  },
  {
    key: 'hr_owner_loan_interest',
    note: "The yearly interest rate the owner's loans from the company carry, as a percentage cell such as 2%. Blank means 0%. Below the income tax law's rate the difference is a benefit in kind.",
    valueOf: (facts) => facts.ownerLoanInterest / BASIS_POINTS_PER_WHOLE,
    apply: (facts, cell) => {
      const rate = rateOfCell(cell)
      return typeof rate === 'string' ? rate : (ownerLoanInterestProblem(rate) ?? withFacts(facts, { ownerLoanInterest: rate }))
    },
  },
  {
    key: 'hr_vat_returns_folder',
    note: `The Google Drive folder the accountant's VAT returns are filed in, as a path from My Drive. Year, Taxes reads them. Blank means ${DEFAULT_VAT_RETURNS_FOLDER.join('/')}.`,
    valueOf: (facts) => facts.vatReturnsFolder.join('/'),
    apply: (facts, cell) => {
      const folders = folderPathOf(String(cell))
      return folders.length === 0 ? `"${String(cell)}" names no folder` : withFacts(facts, { vatReturnsFolder: folders })
    },
  },
  {
    key: 'hr_payroll_folder',
    note: `The Google Drive folder the accountant's salary workbooks are filed in, as a path from My Drive, with a folder for each year and month inside. Year, Taxes reads them. Blank means ${DEFAULT_PAYROLL_FOLDER.join('/')}.`,
    valueOf: (facts) => facts.payrollFolder.join('/'),
    apply: (facts, cell) => {
      const folders = folderPathOf(String(cell))
      return folders.length === 0 ? `"${String(cell)}" names no folder` : withFacts(facts, { payrollFolder: folders })
    },
  },
],
}

function withFacts(facts: CompanyFacts, changed: Partial<CompanyFacts>): CompanyFacts {
  return { ...facts, ...changed }
}

/** The facts a typed value can be wrong in, which the facts card shows an error under. */
export type CompanyFactsField = 'residenceCity' | 'birthYear' | 'dependants' | 'ownerLoanInterest' | 'vatReturnsFolder' | 'payrollFolder'

/** What is wrong with facts typed in the app, by field. The same rules as reading the keys, so facts saved from the app read back without a problem. */
export function companyFactsErrors(facts: CompanyFacts): Partial<Record<CompanyFactsField, string>> {
  const errors: Partial<Record<CompanyFactsField, string>> = {}
  const city = residenceCityProblem(facts.residenceCity)
  if (city !== null) errors.residenceCity = city
  const born = facts.birthYear === null ? null : birthYearProblem(facts.birthYear)
  if (born !== null) errors.birthYear = born
  const dependantCount = dependantsProblem(facts.dependants)
  if (dependantCount !== null) errors.dependants = dependantCount
  const loanInterest = ownerLoanInterestProblem(facts.ownerLoanInterest)
  if (loanInterest !== null) errors.ownerLoanInterest = loanInterest
  if (facts.vatReturnsFolder.length === 0) errors.vatReturnsFolder = FOLDER_MISSING
  if (facts.payrollFolder.length === 0) errors.payrollFolder = FOLDER_MISSING
  return errors
}

const FOLDER_MISSING = 'name a folder from My Drive, such as finance/accountant'

function residenceCityProblem(city: string): string | null {
  return city.length > CITY_MAX_LENGTH ? `a city name can be at most ${CITY_MAX_LENGTH} characters` : null
}

function birthYearProblem(year: number): string | null {
  return Number.isInteger(year) && year >= EARLIEST_BIRTH_YEAR && year <= LATEST_BIRTH_YEAR ? null : 'use a year of birth such as 1990'
}

function dependantsProblem(dependants: number): string | null {
  return Number.isInteger(dependants) && dependants >= 0 && dependants <= MOST_DEPENDANTS ? null : `use a whole number from 0 to ${MOST_DEPENDANTS}`
}

/**
 * A rate in basis points from a percentage cell, which holds 2% as 0.02, or from text such as 2%,
 * 2,5 % or 0.025. A number above 1 is refused, as the year-end tab refuses it, since 2 would read as 200%.
 */
function rateOfCell(cell: SettingCell): number | string {
  const text = String(cell).trim().replace(/\s+/g, '').replace(',', '.')
  const percent = text.endsWith('%')
  const number = typeof cell === 'number' ? cell : Number(percent ? text.slice(0, -1) : text)
  if (typeof cell === 'boolean' || !Number.isFinite(number) || text === '' || text === '%') return `"${String(cell)}" is not a rate such as 2%`
  if (!percent && number > 1) return `${number} reads as ${number * 100}%. Enter the rate as a percentage cell, such as 2%`
  return Math.round((percent ? number / 100 : number) * BASIS_POINTS_PER_WHOLE * 1_000) / 1_000
}

function ownerLoanInterestProblem(basisPoints: number): string | null {
  return Number.isInteger(basisPoints) && basisPoints >= 0 && basisPoints <= BASIS_POINTS_PER_WHOLE ? null : 'use a rate from 0% to 100% with at most two decimals, such as 2%'
}

function isOneOf<Word extends string>(text: string, words: readonly Word[]): text is Word {
  return (words as readonly string[]).includes(text)
}
