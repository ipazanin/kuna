import { parseCivilDate } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { percentFromBasisPoints, percentFromWhole, percentFromWritten, writtenPercent } from '../../../../../shared/money/percent'
import type { Percent } from '../../../../../shared/money/percent'
import { booleanOf, flagText } from '../../../settings/domain/settings'
import type { PackSettings } from '../../../settings/domain/settings'
import { words as settingsWords } from '../../../settings/domain/words'
import { words } from './words'

const HIGHEST_LOAN_INTEREST = percentFromWhole(100)

/** Which corporate tax return the company files: `pd` on the accrual profit, `pd-nn` on cash received and paid. */
export const CIT_RETURNS = ['pd', 'pd-nn'] as const

export type CitReturn = (typeof CIT_RETURNS)[number]

/** When VAT falls due: on the invoice, or when it is paid. */
export const VAT_PRINCIPLES = ['invoice', 'cash'] as const

export type VatPrinciple = (typeof VAT_PRINCIPLES)[number]

/**
 * What the pack needs to know about this company that the law does not say. They are the company's
 * own facts, so they live in the workbook and never in the app. The facts about a person are on the
 * employees tab.
 */
export interface CompanyFacts {
  /** The day the company was registered, which starts its first tax period. Null when not given. */
  readonly companyRegistered: CivilDate | null
  readonly citReturn: CitReturn
  readonly vatPrinciple: VatPrinciple
  /** The default for assets: whether the accountant doubles depreciation rates. */
  readonly depreciationDoubled: boolean
  /** The yearly interest rate the owner's loans carry. */
  readonly ownerLoanInterest: Percent
}

/** The facts as the settings form drafts them. Loan interest that is typed but is no rate is null, so the field shows its error and the form does not save. */
export type CompanyFactsDraft = Omit<CompanyFacts, 'ownerLoanInterest'> & { readonly ownerLoanInterest: Percent | null }

/** The pack's settings keys, read and checked whatever the owner-pay switch says. */
export const COMPANY_FACT_SETTINGS: PackSettings<CompanyFacts> = {
  defaults: {
    companyRegistered: null,
    citReturn: 'pd',
    vatPrinciple: 'invoice',
    depreciationDoubled: false,
    ownerLoanInterest: percentFromBasisPoints(0),
  },
  definitions: [
    {
      key: 'hr_company_registered',
      note: 'The day the company was registered, as a date or as text such as 2025-05-12. It starts the first tax period.',
      type: 'date',
      valueOf: (facts) => facts.companyRegistered ?? '',
      apply: (facts, value) => {
        const registered = parseCivilDate(value.trim())
        return registered === null ? words.facts.notADay(value) : withFacts(facts, { companyRegistered: registered })
      },
    },
    {
      key: 'hr_cit_return',
      note: 'pd for the corporate tax return on the accrual profit, pd-nn for the return on cash received and paid.',
      type: 'text',
      valueOf: (facts) => facts.citReturn,
      apply: (facts, value) => {
        const citReturn = value.trim().toLowerCase()
        return isOneOf(citReturn, CIT_RETURNS) ? withFacts(facts, { citReturn }) : words.facts.neither(citReturn, CIT_RETURNS)
      },
    },
    {
      key: 'hr_vat_principle',
      note: 'invoice when VAT falls due on the invoice date, cash when it falls due on payment.',
      type: 'text',
      valueOf: (facts) => facts.vatPrinciple,
      apply: (facts, value) => {
        const vatPrinciple = value.trim().toLowerCase()
        return isOneOf(vatPrinciple, VAT_PRINCIPLES) ? withFacts(facts, { vatPrinciple }) : words.facts.neither(vatPrinciple, VAT_PRINCIPLES)
      },
    },
    {
      key: 'hr_depreciation_doubled',
      note: 'TRUE when the accountant doubles the depreciation rates by default. An asset row can still say otherwise.',
      type: 'flag',
      valueOf: (facts) => flagText(facts.depreciationDoubled),
      apply: (facts, value) => {
        const doubled = booleanOf(value)
        return doubled === null ? settingsWords.settings.notAFlag(value) : withFacts(facts, { depreciationDoubled: doubled })
      },
    },
    {
      key: 'hr_owner_loan_interest',
      note: "The yearly interest rate the owner's loans from the company carry, with its percent sign, such as 2%. Blank means 0%. Below the income tax law's rate the difference is a benefit in kind.",
      type: 'number',
      valueOf: (facts) => `${writtenPercent(facts.ownerLoanInterest)}%`,
      apply: (facts, value) => {
        const rate = rateOf(value)
        return typeof rate === 'string' ? rate : withFacts(facts, { ownerLoanInterest: rate })
      },
    },
  ],
  retired: [
    'hr_accountant_sync',
    'hr_accountant_mail_from',
    'hr_payroll_mail_sync',
    'hr_vat_mail_sync',
    'hr_invoices_mail_sync',
    'hr_payroll_mail_subject',
    'hr_vat_mail_subject',
    'hr_invoices_mail_subject',
    'hr_payroll_folder',
    'hr_vat_returns_folder',
    'hr_incoming_invoices_folder',
  ],
}

function withFacts(facts: CompanyFacts, changed: Partial<CompanyFacts>): CompanyFacts {
  return { ...facts, ...changed }
}

/** The facts a typed value can be wrong in, which the facts card shows an error under. */
export type CompanyFactsField = 'ownerLoanInterest'

/** What is wrong with facts typed in the app, by field. The same rules as reading the keys, so facts saved from the app read back without a problem. */
export function companyFactsErrors(facts: CompanyFactsDraft): Partial<Record<CompanyFactsField, string>> {
  return facts.ownerLoanInterest === null ? { ownerLoanInterest: words.facts.rateRange } : {}
}

/**
 * A rate from text with a percent sign, such as 2% or 2,5 %, or a plain 0. A number above zero with no
 * sign is refused, since 0.5 could be 0.5% or 50%, and a percentage cell holds the same number as a plain one.
 */
function rateOf(value: string): Percent | string {
  const text = value.trim().replace(/\s+/g, '').replace(',', '.')
  const percent = text.endsWith('%')
  const number = Number(percent ? text.slice(0, -1) : text)
  if (!Number.isFinite(number) || text === '' || text === '%') return words.facts.notARate(value)
  if (!percent && number > 1) return words.facts.rateAboveOne(number)
  if (!percent && number > 0) return words.facts.rateNeedsSign(number)
  return loanInterestOf(number) ?? words.facts.rateRange
}

/** The rate the facts card's field holds, typed as a percent with no sign, so 2.5 and 0.8 are 2.5% and 0.8%. A blank field is 0%. Null for what is no rate the loans can carry. */
export function typedLoanInterest(text: string): Percent | null {
  const typed = text.trim().replace(',', '.')
  return loanInterestOf(typed === '' ? 0 : Number(typed))
}

function loanInterestOf(written: number): Percent | null {
  const rate = percentFromWritten(written)
  return rate !== null && rate <= HIGHEST_LOAN_INTEREST ? rate : null
}

function isOneOf<Word extends string>(text: string, words: readonly Word[]): text is Word {
  return (words as readonly string[]).includes(text)
}
