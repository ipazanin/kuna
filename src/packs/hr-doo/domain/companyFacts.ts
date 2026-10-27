import { parseCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { folderPathOf } from '../../../shared/text/folderPath'
import { mailAddressesOf, mailAddressesProblem, mailSubjectProblem } from '../../../features/mail/domain/mailSource'
import { booleanOf, flagText } from '../../../features/settings/domain/settings'
import type { PackSettings, SettingDefinition } from '../../../features/settings/domain/settings'

const BASIS_POINTS_PER_WHOLE = 10_000

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
  /** The yearly interest rate the owner's loans carry, in basis points, so 200 is 2%. */
  readonly ownerLoanInterest: number
  /** The Drive folder the accountant's VAT return mail is filed in, as folder names from My Drive down. None until one is chosen. */
  readonly vatReturnsFolder: readonly string[]
  /** The Drive folder the accountant's payroll mail is filed in, as folder names from My Drive down. None until one is chosen. */
  readonly payrollFolder: readonly string[]
  /** The addresses the accountant mails from, in lower case. */
  readonly accountantMailFrom: readonly string[]
  /** Whether each sync reads each kind of the accountant's mail. Each is off until the person switches it on. */
  readonly payrollMailSync: boolean
  readonly vatMailSync: boolean
  readonly invoicesMailSync: boolean
  /** The words the subject of each kind of the accountant's mail starts with. */
  readonly payrollMailSubject: string
  readonly vatMailSubject: string
  readonly invoicesMailSubject: string
  /** The Drive folder the accountant's own invoices are filed in, as folder names from My Drive down. None until one is chosen. */
  readonly incomingInvoicesFolder: readonly string[]
}

/** The pack's settings keys, read and checked whatever the owner-pay switch says. */
export const COMPANY_FACT_SETTINGS: PackSettings<CompanyFacts> = {
  defaults: {
    companyRegistered: null,
    citReturn: 'pd',
    vatPrinciple: 'invoice',
    depreciationDoubled: false,
    ownerLoanInterest: 0,
    vatReturnsFolder: [],
    payrollFolder: [],
    accountantMailFrom: [],
    payrollMailSync: false,
    vatMailSync: false,
    invoicesMailSync: false,
    payrollMailSubject: '',
    vatMailSubject: '',
    invoicesMailSubject: '',
    incomingInvoicesFolder: [],
  },
  definitions: [
  {
    key: 'hr_company_registered',
    note: 'The day the company was registered, as a date or as text such as 2025-05-12. It starts the first tax period.',
    type: 'date',
    valueOf: (facts) => facts.companyRegistered ?? '',
    apply: (facts, value) => {
      const registered = parseCivilDate(value.trim())
      return registered === null ? `"${value}" is not a date such as 2025-05-12` : withFacts(facts, { companyRegistered: registered })
    },
  },
  {
    key: 'hr_cit_return',
    note: 'pd for the corporate tax return on the accrual profit, pd-nn for the return on cash received and paid.',
    type: 'text',
    valueOf: (facts) => facts.citReturn,
    apply: (facts, value) => {
      const citReturn = value.trim().toLowerCase()
      return isOneOf(citReturn, CIT_RETURNS) ? withFacts(facts, { citReturn }) : `"${citReturn}" is neither ${CIT_RETURNS.join(' nor ')}`
    },
  },
  {
    key: 'hr_vat_principle',
    note: 'invoice when VAT falls due on the invoice date, cash when it falls due on payment.',
    type: 'text',
    valueOf: (facts) => facts.vatPrinciple,
    apply: (facts, value) => {
      const vatPrinciple = value.trim().toLowerCase()
      return isOneOf(vatPrinciple, VAT_PRINCIPLES) ? withFacts(facts, { vatPrinciple }) : `"${vatPrinciple}" is neither ${VAT_PRINCIPLES.join(' nor ')}`
    },
  },
  {
    key: 'hr_depreciation_doubled',
    note: 'TRUE when the accountant doubles the depreciation rates by default. An asset row can still say otherwise.',
    type: 'flag',
    valueOf: (facts) => flagText(facts.depreciationDoubled),
    apply: (facts, value) => {
      const doubled = booleanOf(value)
      return doubled === null ? `"${value}" is neither TRUE nor FALSE` : withFacts(facts, { depreciationDoubled: doubled })
    },
  },
  {
    key: 'hr_owner_loan_interest',
    note: "The yearly interest rate the owner's loans from the company carry, as a percentage cell such as 2%. Blank means 0%. Below the income tax law's rate the difference is a benefit in kind.",
    type: 'number',
    valueOf: (facts) => String(facts.ownerLoanInterest / BASIS_POINTS_PER_WHOLE),
    apply: (facts, value) => {
      const rate = rateOf(value)
      return typeof rate === 'string' ? rate : (ownerLoanInterestProblem(rate) ?? withFacts(facts, { ownerLoanInterest: rate }))
    },
  },
  {
    key: 'hr_vat_returns_folder',
    note: "The Google Drive folder the accountant's VAT return mail is filed in, as a path from My Drive, with a folder for each year inside. Blank names none.",
    type: 'text',
    valueOf: (facts) => facts.vatReturnsFolder.join('/'),
    apply: (facts, value) => {
      const folders = folderPathOf(value)
      return folders.length === 0 ? `"${value}" names no folder` : withFacts(facts, { vatReturnsFolder: folders })
    },
  },
  {
    key: 'hr_payroll_folder',
    note: "The Google Drive folder the accountant's payroll mail is filed in, as a path from My Drive, with a folder for each year and month inside. Blank names none.",
    type: 'text',
    valueOf: (facts) => facts.payrollFolder.join('/'),
    apply: (facts, value) => {
      const folders = folderPathOf(value)
      return folders.length === 0 ? `"${value}" names no folder` : withFacts(facts, { payrollFolder: folders })
    },
  },
  {
    key: 'hr_accountant_mail_from',
    note: "The addresses the accountant mails from, comma separated, which each kind of the accountant's mail that is switched on searches Gmail for.",
    type: 'text',
    valueOf: (facts) => facts.accountantMailFrom.join(', '),
    apply: (facts, value) => {
      const senders = mailAddressesOf(value)
      return mailAddressesProblem(senders) ?? withFacts(facts, { accountantMailFrom: senders })
    },
  },
  mailSyncDefinition('hr_payroll_mail_sync', 'payrollMailSync', "TRUE to have each sync read the accountant's payroll mail. FALSE, the default, makes no Gmail or Drive call for it."),
  mailSyncDefinition('hr_vat_mail_sync', 'vatMailSync', "TRUE to have each sync read the accountant's VAT return mail. FALSE, the default, makes no Gmail or Drive call for it."),
  mailSyncDefinition('hr_invoices_mail_sync', 'invoicesMailSync', "TRUE to have each sync read the accountant's invoice mail. FALSE, the default, makes no Gmail or Drive call for it."),
  mailSubjectDefinition('hr_payroll_mail_subject', 'payrollMailSubject', 'The words the subject of the payroll mail starts with, before the month, such as Plaća za.'),
  mailSubjectDefinition('hr_vat_mail_subject', 'vatMailSubject', 'The words the subject of the VAT return mail starts with, before the period, such as PDV za.'),
  mailSubjectDefinition('hr_invoices_mail_subject', 'invoicesMailSubject', "The words the subject of the accountant's invoice mail starts with, such as Račun za. Mail whose subject does not start with them is not filed."),
  {
    key: 'hr_incoming_invoices_folder',
    note: "The Google Drive folder the accountant's own invoices are filed in, as a path from My Drive, with a folder for each year and month inside. Blank names none.",
    type: 'text',
    valueOf: (facts) => facts.incomingInvoicesFolder.join('/'),
    apply: (facts, value) => {
      const folders = folderPathOf(value)
      return folders.length === 0 ? `"${value}" names no folder` : withFacts(facts, { incomingInvoicesFolder: folders })
    },
  },
],
}

type MailSubjectFact = 'payrollMailSubject' | 'vatMailSubject' | 'invoicesMailSubject'

function mailSyncDefinition(key: string, fact: 'payrollMailSync' | 'vatMailSync' | 'invoicesMailSync', note: string): SettingDefinition<CompanyFacts> {
  return {
    key,
    note,
    type: 'flag',
    valueOf: (facts) => flagText(facts[fact]),
    apply: (facts, value) => {
      const on = booleanOf(value)
      return on === null ? `"${value}" is neither TRUE nor FALSE` : withFacts(facts, { [fact]: on })
    },
  }
}

function mailSubjectDefinition(key: string, fact: MailSubjectFact, note: string): SettingDefinition<CompanyFacts> {
  return {
    key,
    note,
    type: 'text',
    valueOf: (facts) => facts[fact],
    apply: (facts, value) => {
      const subject = value.trim()
      return mailSubjectProblem(subject) ?? withFacts(facts, { [fact]: subject })
    },
  }
}

function withFacts(facts: CompanyFacts, changed: Partial<CompanyFacts>): CompanyFacts {
  return { ...facts, ...changed }
}

/** The facts a typed value can be wrong in, which the facts card shows an error under. */
export type CompanyFactsField = 'ownerLoanInterest' | 'accountantMailFrom' | MailSubjectFact

/** What is wrong with facts typed in the app, by field. The same rules as reading the keys, so facts saved from the app read back without a problem. */
export function companyFactsErrors(facts: CompanyFacts): Partial<Record<CompanyFactsField, string>> {
  const errors: Partial<Record<CompanyFactsField, string>> = {}
  const loanInterest = ownerLoanInterestProblem(facts.ownerLoanInterest)
  if (loanInterest !== null) errors.ownerLoanInterest = loanInterest
  const senders = mailAddressesProblem(facts.accountantMailFrom)
  if (senders !== null) errors.accountantMailFrom = senders
  for (const fact of ['payrollMailSubject', 'vatMailSubject', 'invoicesMailSubject'] as const) {
    const subject = mailSubjectProblem(facts[fact])
    if (subject !== null) errors[fact] = subject
  }
  return errors
}

/**
 * A rate in basis points from a fraction such as 0.025, which a percentage cell holds for 2.5%, or
 * from text such as 2% or 2,5 %. A number above 1 is refused, as the year-end tab refuses it, since 2
 * would read as 200%.
 */
function rateOf(value: string): number | string {
  const text = value.trim().replace(/\s+/g, '').replace(',', '.')
  const percent = text.endsWith('%')
  const number = Number(percent ? text.slice(0, -1) : text)
  if (!Number.isFinite(number) || text === '' || text === '%') return `"${value}" is not a rate such as 2%`
  if (!percent && number > 1) return `${number} reads as ${number * 100}%. Enter the rate as a percentage cell, such as 2%`
  return Math.round((percent ? number / 100 : number) * BASIS_POINTS_PER_WHOLE * 1_000) / 1_000
}

function ownerLoanInterestProblem(basisPoints: number): string | null {
  return Number.isInteger(basisPoints) && basisPoints >= 0 && basisPoints <= BASIS_POINTS_PER_WHOLE ? null : 'use a rate from 0% to 100% with at most two decimals, such as 2%'
}

function isOneOf<Word extends string>(text: string, words: readonly Word[]): text is Word {
  return (words as readonly string[]).includes(text)
}
