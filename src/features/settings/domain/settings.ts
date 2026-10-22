import { civilDateFromSerial, parseCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { moneyFromAmount } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { normaliseIban } from '../../../shared/text/fold'
import { BUCKETS } from '../../workbook/domain/bucket'
import type { DefinedBucket } from '../../workbook/domain/bucket'
import { isIban } from '../../workbook/domain/iban'
import { recordIdOf } from '../../workbook/domain/recordId'
import { SETTING_RECORDS } from '../../workbook/domain/recordKind'
import type { RecordProblem } from '../../workbook/domain/workbook'
import { sharedKeys } from '../../workbook/domain/sharedKeys'
import { IMPORT_PROFILE_PREFIX, profileKey, profileValue, readProfile } from '../../imports/domain/importProfile'
import type { ImportProfile } from '../../imports/domain/importProfile'
import { DEFAULT_FILE_PATH, filePathProblem } from '../../invoicing/domain/invoiceFiling'
import { DEFAULT_MAIL_BODY, DEFAULT_MAIL_SUBJECT, mailTemplateProblem } from '../../invoicing/domain/invoiceMail'
import { DEFAULT_NUMBER_PATTERN, numberPatternProblem } from '../../invoicing/domain/invoiceNumber'

/** The workbook format this app writes. A higher number comes from a newer app. */
export const TEMPLATE_VERSION = 1

/**
 * Everything about a workbook that would otherwise be built into the app. The defaults are how the
 * app behaved before any of it was configurable, so a workbook without a `settings` tab reads the
 * same as before.
 */
export interface Settings {
  readonly templateVersion: number
  /** Blank when unnamed. The app then uses the Sheet's or the file's name. */
  readonly companyName: string
  /** An ISO 4217 code with at most two decimals, such as `EUR`. */
  readonly currency: string
  /** A BCP 47 tag, such as `en-GB`, for grouping and the decimal mark. */
  readonly numberLocale: string
  /** What each bucket is called on screen. The identifiers themselves never change. */
  readonly bucketLabels: Readonly<Record<DefinedBucket, string>>
  /** Off hides owner pay and owner earns. Owner-pay rows still count as costs. */
  readonly ownerPayModule: boolean
  /** The `flagged_by` value a person's confirmation will write. */
  readonly reviewLabel: string
  /** The bank accounts a card purchase settles against, normalised. The rules read such a row as a card purchase. */
  readonly cardSettlementIbans: readonly string[]
  readonly billing: BillingTerms
  readonly invoicing: InvoicingTerms
  readonly companyFacts: CompanyFacts
  /** How each bank's spreadsheet export reads, from the `import_profile_<name>` keys, in tab order. */
  readonly importProfiles: readonly ImportProfile[]
}

/**
 * What an invoice the app makes says about your company, and where it is filed and mailed from.
 * Blank text is left off the invoice. The number pattern, file path, mail texts and VAT note have
 * defaults, the invoice generator's own.
 */
export interface InvoicingTerms {
  /** Your company's name as the invoice prints it. */
  readonly name: string
  readonly address: string
  readonly country: string
  readonly vatId: string
  readonly phone: string
  readonly mail: string
  /** Normalised. The account the client pays into. */
  readonly iban: string
  readonly swift: string
  /** The bank the IBAN is with, for the footer. */
  readonly bank: string
  readonly courtRegister: string
  /** As printed, such as EUR 2,500.00 (fully paid-up). */
  readonly shareCapital: string
  /** Where the invoice is issued, printed before its date. */
  readonly place: string
  /** The issuing time the invoice prints, such as 17:00h. */
  readonly issueTime: string
  /** Who prepares and signs the invoice. */
  readonly signatory: string
  /** The signatory's role, such as director. */
  readonly signatoryTitle: string
  readonly numberPattern: string
  /** The Drive folder picked to file invoices under. Blank until one is picked. */
  readonly folderId: string
  readonly filePath: string
  readonly mailSubject: string
  readonly mailBody: string
  /** The note a reverse-charge invoice prints under its totals. */
  readonly reverseChargeNote: string
}

export const DEFAULT_REVERSE_CHARGE_NOTE = 'Not subject to VAT in accordance with Article 17 of the Croatian VAT Law - reverse charge'

/**
 * The amounts a client is billed on terms, which the billing plan shows and fills in from. Each
 * amount comes with the `item` text its rows carry on the `outgoing-plan` tab. Null and blank when not set.
 */
export interface BillingTerms {
  /** The fee for each worked month. */
  readonly monthlyAmount: Money | null
  readonly monthlyItem: string
  /** Subscriptions re-billed every month. */
  readonly subscriptionAmount: Money | null
  readonly subscriptionItem: string
  /** The bonus for a whole year, shown for reference and never filled in. */
  readonly bonusAmount: Money | null
  readonly bonusItem: string
  /** The client slug filled rows are for. */
  readonly client: string
}

/** Which corporate tax return the company files: `pd` on the accrual profit, `pd-nn` on cash received and paid. */
export const CIT_RETURNS = ['pd', 'pd-nn'] as const

export type CitReturn = (typeof CIT_RETURNS)[number]

/** When VAT falls due: on the invoice, or when it is paid. */
export const VAT_PRINCIPLES = ['invoice', 'cash'] as const

export type VatPrinciple = (typeof VAT_PRINCIPLES)[number]

/**
 * What the owner-pay pack needs to know about this company and its owner that the law does not
 * say. These are the owner's own facts, so they live in the workbook and never in the app.
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
}

export const DEFAULT_BUCKET_LABELS: Readonly<Record<DefinedBucket, string>> = {
  income: 'Income',
  operating: 'Operating cost',
  taxes: 'Taxes',
  'owner-pay': 'Owner pay',
  financing: 'Financing',
  neutral: 'Neutral',
}

export const DEFAULT_SETTINGS: Settings = {
  templateVersion: TEMPLATE_VERSION,
  companyName: '',
  currency: 'EUR',
  numberLocale: 'en-GB',
  bucketLabels: DEFAULT_BUCKET_LABELS,
  ownerPayModule: true,
  reviewLabel: 'human',
  cardSettlementIbans: [],
  billing: {
    monthlyAmount: null,
    monthlyItem: '',
    subscriptionAmount: null,
    subscriptionItem: '',
    bonusAmount: null,
    bonusItem: '',
    client: '',
  },
  invoicing: {
    name: '',
    address: '',
    country: '',
    vatId: '',
    phone: '',
    mail: '',
    iban: '',
    swift: '',
    bank: '',
    courtRegister: '',
    shareCapital: '',
    place: '',
    issueTime: '',
    signatory: '',
    signatoryTitle: '',
    numberPattern: DEFAULT_NUMBER_PATTERN,
    folderId: '',
    filePath: DEFAULT_FILE_PATH,
    mailSubject: DEFAULT_MAIL_SUBJECT,
    mailBody: DEFAULT_MAIL_BODY,
    reverseChargeNote: DEFAULT_REVERSE_CHARGE_NOTE,
  },
  companyFacts: {
    residenceCity: '',
    birthYear: null,
    pensionPillarTwo: true,
    dependants: 0,
    companyRegistered: null,
    citReturn: 'pd',
    vatPrinciple: 'invoice',
    depreciationDoubled: false,
    ownerLoanInterest: 0,
  },
  importProfiles: [],
}

/** `flagged_by` values the categoriser writes, which a person's label must not reuse. */
const MACHINE_FLAGS = ['rule', 'ai'] as const

/** Names the screens already give derived lines and chart series, so no bucket label may take them. */
const RESERVED_LABELS = ['net', 'all costs', 'owner earns', 'kept']

const LABEL_MAX_LENGTH = 40

const CITY_MAX_LENGTH = 60

const BILLING_ITEM_MAX_LENGTH = 60

const EARLIEST_BIRTH_YEAR = 1900
const LATEST_BIRTH_YEAR = 2100

const MOST_DEPENDANTS = 20

const BASIS_POINTS_PER_WHOLE = 10_000

export type SettingCell = string | number | boolean

export interface SettingRow {
  readonly key: string
  readonly value: SettingCell | undefined
}

type BucketLabelKey = `label_${string}`

interface SettingDefinition {
  readonly key: string
  /** What the key means, as the template's note on it says. */
  readonly note: string
  readonly valueOf: (settings: Settings) => SettingCell
  /** The settings with this key applied, or the reason the cell cannot be used. */
  readonly apply: (settings: Settings, cell: SettingCell) => Settings | string
}

function bucketLabelKey(bucket: DefinedBucket): BucketLabelKey {
  return `label_${bucket.replace('-', '_')}`
}

const BUCKET_LABEL_DEFINITIONS: readonly SettingDefinition[] = BUCKETS.map((bucket) => ({
  key: bucketLabelKey(bucket),
  note: `What the ${bucket} bucket is called on screen. The bucket itself keeps its name in the categories tab.`,
  valueOf: (settings) => settings.bucketLabels[bucket],
  apply: (settings, cell) => {
    const label = String(cell).trim()
    const problem = labelProblem(label)
    return problem ?? { ...settings, bucketLabels: { ...settings.bucketLabels, [bucket]: label } }
  },
}))

function withFacts(settings: Settings, facts: Partial<CompanyFacts>): Settings {
  return { ...settings, companyFacts: { ...settings.companyFacts, ...facts } }
}

function withBilling(settings: Settings, terms: Partial<BillingTerms>): Settings {
  return { ...settings, billing: { ...settings.billing, ...terms } }
}

export type BillingAmountField = 'monthlyAmount' | 'subscriptionAmount' | 'bonusAmount'

export type BillingItemField = 'monthlyItem' | 'subscriptionItem' | 'bonusItem'

function billingAmountDefinition(key: string, field: BillingAmountField, note: string): SettingDefinition {
  return {
    key,
    note,
    valueOf: (settings) => {
      const amount = settings.billing[field]
      return amount === null ? '' : amount / 100
    },
    apply: (settings, cell) => {
      const amount = typeof cell === 'number' ? cell : Number(String(cell).trim())
      return billingAmountProblem(amount) ?? withBilling(settings, { [field]: moneyFromAmount(amount) })
    },
  }
}

function billingItemDefinition(key: string, field: BillingItemField, note: string): SettingDefinition {
  return {
    key,
    note,
    valueOf: (settings) => settings.billing[field],
    apply: (settings, cell) => {
      const item = String(cell).trim()
      return billingItemProblem(item) ?? withBilling(settings, { [field]: item })
    },
  }
}

/** The billing plan's terms, for any freelancer or small business. */
const BILLING_DEFINITIONS: readonly SettingDefinition[] = [
  billingAmountDefinition('billing_monthly_amount', 'monthlyAmount', 'The fee invoiced for each worked month, such as 7200. "Fill the rest of the year" adds a row of it for every month to December. Optional.'),
  billingItemDefinition('billing_monthly_item', 'monthlyItem', 'The item text of the monthly fee rows on the outgoing-plan tab, written as the tab writes it. Needed with billing_monthly_amount.'),
  billingAmountDefinition('billing_subscription_amount', 'subscriptionAmount', 'Subscriptions re-billed every month, such as 60. "Fill the rest of the year" adds a row of it for every month to December. Optional.'),
  billingItemDefinition('billing_subscription_item', 'subscriptionItem', 'The item text of the subscription rows on the outgoing-plan tab. Needed with billing_subscription_amount.'),
  billingAmountDefinition('billing_bonus_amount', 'bonusAmount', 'The bonus agreed for a whole year, such as 4800. It is shown for reference and never filled in. Optional.'),
  billingItemDefinition('billing_bonus_item', 'bonusItem', 'The item text of the bonus rows on the outgoing-plan tab. Needed with billing_bonus_amount.'),
  {
    key: 'billing_client',
    note: 'The client the filled rows are for, by the client name in the clients tab, such as northwind. Optional.',
    valueOf: (settings) => settings.billing.client,
    apply: (settings, cell) => withBilling(settings, { client: String(cell).trim().toLowerCase() }),
  },
]

export type InvoicingField = keyof InvoicingTerms

/** What is wrong with one invoicing value, or null. Only the fields the app fills in or files by have a rule. */
function invoicingProblem(field: InvoicingField, value: string): string | null {
  switch (field) {
    case 'iban':
      return value === '' || isIban(value) ? null : `"${value}" is not an IBAN`
    case 'numberPattern':
      return numberPatternProblem(value)
    case 'filePath':
      return filePathProblem(value)
    case 'mailSubject':
    case 'mailBody':
      return mailTemplateProblem(value)
    default:
      return null
  }
}

function invoicingDefinition(key: string, field: InvoicingField, note: string): SettingDefinition {
  return {
    key,
    note,
    valueOf: (settings) => settings.invoicing[field],
    apply: (settings, cell) => {
      const typed = String(cell)
      const text = field === 'iban' ? normaliseIban(typed) : field === 'mailBody' ? typed.replaceAll('\r\n', '\n').trim() : typed.replace(/\s*[\r\n]+\s*/g, ' ').trim()
      return invoicingProblem(field, text) ?? { ...settings, invoicing: { ...settings.invoicing, [field]: text } }
    },
  }
}

/** What an invoice the app makes prints about your company, and how it is numbered, filed and mailed. */
const INVOICING_DEFINITIONS: readonly SettingDefinition[] = [
  invoicingDefinition('invoice_company_name', 'name', 'Your company’s name as the invoice prints it, such as Example Studio d.o.o. Needed to make an invoice.'),
  invoicingDefinition('invoice_address', 'address', 'Your street and town, such as Example Street 1, Zagreb. Needed to make an invoice.'),
  invoicingDefinition('invoice_country', 'country', 'Your country, printed under the address. Optional.'),
  invoicingDefinition('invoice_vat_id', 'vatId', 'Your VAT ID, such as HR00000000000. Needed to make an invoice.'),
  invoicingDefinition('invoice_phone', 'phone', 'The phone number the invoice prints. Optional.'),
  invoicingDefinition('invoice_mail', 'mail', 'The mail address the invoice prints. Optional.'),
  invoicingDefinition('invoice_iban', 'iban', 'The IBAN the client pays into. Needed to make an invoice.'),
  invoicingDefinition('invoice_swift', 'swift', 'Your bank’s SWIFT or BIC code. Optional.'),
  invoicingDefinition('invoice_bank', 'bank', 'The bank the IBAN is with, for the footer. Optional.'),
  invoicingDefinition('invoice_court_register', 'courtRegister', 'Your court register number, for the footer. Optional.'),
  invoicingDefinition('invoice_share_capital', 'shareCapital', 'Your share capital as the footer prints it, such as EUR 2,500.00 (fully paid-up). Optional.'),
  invoicingDefinition('invoice_place', 'place', 'The town the invoice is issued in, printed before its date. Needed to make an invoice.'),
  invoicingDefinition('invoice_issue_time', 'issueTime', 'The issuing time the invoice prints, such as 17:00h. Blank leaves the line out.'),
  invoicingDefinition('invoice_signatory', 'signatory', 'Who prepares and signs the invoice, by name. Needed to make an invoice.'),
  invoicingDefinition('invoice_signatory_title', 'signatoryTitle', 'The signatory’s role, such as director. Optional.'),
  invoicingDefinition('invoice_number_pattern', 'numberPattern', `How invoice numbers are written: {n} is the sequence, which restarts each year, {yy} and {yyyy} the year. Blank means ${DEFAULT_NUMBER_PATTERN}.`),
  invoicingDefinition('invoice_folder_id', 'folderId', 'The Google Drive folder invoices are filed under, as the app’s folder picker sets it. Optional.'),
  invoicingDefinition('invoice_file_path', 'filePath', `Where under that folder each invoice is filed, with {yyyy}, {yy}, {mm}, {client} and {number}. Blank means ${DEFAULT_FILE_PATH}.`),
  invoicingDefinition('invoice_mail_subject', 'mailSubject', `The subject of the invoice mail, with {month}, {number}, {client}, {company} and {signatory}. Blank means ${DEFAULT_MAIL_SUBJECT}.`),
  invoicingDefinition('invoice_mail_body', 'mailBody', 'The text of the invoice mail, with the same words in braces as the subject. Blank means a short note signed by the signatory.'),
  invoicingDefinition('invoice_reverse_charge_note', 'reverseChargeNote', 'The note a reverse-charge invoice prints under its totals. Blank means the Croatian VAT law’s Article 17 note.'),
]

/** The pack's keys, read only while the owner-pay module is on, but kept and checked whatever it is. */
const COMPANY_FACT_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: 'hr_residence_city',
    note: 'The city or municipality the owner lives in, such as Zagreb. It sets the local income tax rates, so payroll figures stay empty while it is blank.',
    valueOf: (settings) => settings.companyFacts.residenceCity,
    apply: (settings, cell) => {
      const city = String(cell).trim()
      return residenceCityProblem(city) ?? withFacts(settings, { residenceCity: city })
    },
  },
  {
    key: 'hr_birth_year',
    note: "The owner's year of birth, such as 1990, for the youth income tax relief. Blank means no relief is assumed.",
    valueOf: (settings) => settings.companyFacts.birthYear ?? '',
    apply: (settings, cell) => {
      const year = typeof cell === 'number' ? cell : Number(String(cell).trim())
      return birthYearProblem(year) ?? withFacts(settings, { birthYear: year })
    },
  },
  {
    key: 'hr_pension_pillar_2',
    note: 'TRUE when the owner pays into the second pension pillar, FALSE when the whole pension contribution goes to the first.',
    valueOf: (settings) => settings.companyFacts.pensionPillarTwo,
    apply: (settings, cell) => {
      const pillarTwo = booleanOf(cell)
      return pillarTwo === null ? `"${String(cell)}" is neither TRUE nor FALSE` : withFacts(settings, { pensionPillarTwo: pillarTwo })
    },
  },
  {
    key: 'hr_dependants',
    note: 'How many dependants raise the personal allowance, as a whole number. Blank means 0.',
    valueOf: (settings) => settings.companyFacts.dependants,
    apply: (settings, cell) => {
      const dependants = typeof cell === 'number' ? cell : Number(String(cell).trim())
      return dependantsProblem(dependants) ?? withFacts(settings, { dependants })
    },
  },
  {
    key: 'hr_company_registered',
    note: 'The day the company was registered, as a date or as text such as 2025-05-12. It starts the first tax period.',
    valueOf: (settings) => settings.companyFacts.companyRegistered ?? '',
    apply: (settings, cell) => {
      const registered = typeof cell === 'number' && Number.isFinite(cell) ? civilDateFromSerial(cell) : parseCivilDate(String(cell).trim())
      return registered === null ? `"${String(cell)}" is not a date such as 2025-05-12` : withFacts(settings, { companyRegistered: registered })
    },
  },
  {
    key: 'hr_cit_return',
    note: 'pd for the corporate tax return on the accrual profit, pd-nn for the return on cash received and paid.',
    valueOf: (settings) => settings.companyFacts.citReturn,
    apply: (settings, cell) => {
      const citReturn = String(cell).trim().toLowerCase()
      return isOneOf(citReturn, CIT_RETURNS) ? withFacts(settings, { citReturn }) : `"${citReturn}" is neither ${CIT_RETURNS.join(' nor ')}`
    },
  },
  {
    key: 'hr_vat_principle',
    note: 'invoice when VAT falls due on the invoice date, cash when it falls due on payment.',
    valueOf: (settings) => settings.companyFacts.vatPrinciple,
    apply: (settings, cell) => {
      const vatPrinciple = String(cell).trim().toLowerCase()
      return isOneOf(vatPrinciple, VAT_PRINCIPLES) ? withFacts(settings, { vatPrinciple }) : `"${vatPrinciple}" is neither ${VAT_PRINCIPLES.join(' nor ')}`
    },
  },
  {
    key: 'hr_depreciation_doubled',
    note: 'TRUE when the accountant doubles the depreciation rates by default. An asset row can still say otherwise.',
    valueOf: (settings) => settings.companyFacts.depreciationDoubled,
    apply: (settings, cell) => {
      const doubled = booleanOf(cell)
      return doubled === null ? `"${String(cell)}" is neither TRUE nor FALSE` : withFacts(settings, { depreciationDoubled: doubled })
    },
  },
  {
    key: 'hr_owner_loan_interest',
    note: "The yearly interest rate the owner's loans from the company carry, as a percentage cell such as 2%. Blank means 0%. Below the income tax law's rate the difference is a benefit in kind.",
    valueOf: (settings) => settings.companyFacts.ownerLoanInterest / BASIS_POINTS_PER_WHOLE,
    apply: (settings, cell) => {
      const rate = rateOfCell(cell)
      return typeof rate === 'string' ? rate : (ownerLoanInterestProblem(rate) ?? withFacts(settings, { ownerLoanInterest: rate }))
    },
  },
]

/** Every key the app reads, in the order the template lists them. */
export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: 'template_version',
    note: 'The workbook format. Leave it as the app wrote it.',
    valueOf: (settings) => settings.templateVersion,
    apply: (settings, cell) => {
      const version = typeof cell === 'number' ? cell : Number(String(cell).trim())
      if (!Number.isInteger(version) || version < 1) {
        return `"${String(cell)}" is not a template version`
      }
      if (version > TEMPLATE_VERSION) {
        return `the workbook is template version ${version} and this app reads version ${TEMPLATE_VERSION}`
      }
      return { ...settings, templateVersion: version }
    },
  },
  {
    key: 'company_name',
    note: 'Shown in the app and used in the name of an exported file. Leave it blank to use the file name.',
    valueOf: (settings) => settings.companyName,
    apply: (settings, cell) => ({ ...settings, companyName: String(cell).trim() }),
  },
  {
    key: 'currency',
    note: 'The three-letter ISO code of the money in the ledger, such as EUR, USD or GBP.',
    valueOf: (settings) => settings.currency,
    apply: (settings, cell) => {
      const currency = String(cell).trim().toUpperCase()
      const problem = currencyProblem(currency)
      return problem ?? { ...settings, currency }
    },
  },
  {
    key: 'number_locale',
    note: 'How amounts are written: en-GB gives 1,234.56 and de-DE gives 1.234,56. Dates and text stay in English.',
    valueOf: (settings) => settings.numberLocale,
    apply: (settings, cell) => {
      const locale = String(cell).trim()
      const problem = localeProblem(locale)
      return problem ?? { ...settings, numberLocale: locale }
    },
  },
  ...BUCKET_LABEL_DEFINITIONS,
  {
    key: 'owner_pay_module',
    note: 'TRUE shows owner pay and owner earns. FALSE hides them, and the owner-pay rows then count as operating cost.',
    valueOf: (settings) => settings.ownerPayModule,
    apply: (settings, cell) => {
      const enabled = booleanOf(cell)
      return enabled === null ? `"${String(cell)}" is neither TRUE nor FALSE` : { ...settings, ownerPayModule: enabled }
    },
  },
  {
    key: 'review_label',
    note: 'What flagged_by says on a row a person confirmed, such as human or your first name. rule and ai are taken.',
    valueOf: (settings) => settings.reviewLabel,
    apply: (settings, cell) => {
      const label = String(cell).trim().toLowerCase()
      const problem = reviewLabelProblem(label)
      return problem ?? { ...settings, reviewLabel: label }
    },
  },
  {
    key: 'card_settlement_ibans',
    note: 'The bank accounts a card purchase settles against, comma separated. A row with one of them as counterparty reads as a card purchase. Optional.',
    valueOf: (settings) => settings.cardSettlementIbans.join(', '),
    apply: (settings, cell) => {
      const ibans = ibanListOf(String(cell))
      const problem = ibanListProblem(ibans)
      return problem ?? { ...settings, cardSettlementIbans: ibans }
    },
  },
  ...BILLING_DEFINITIONS,
  ...INVOICING_DEFINITIONS,
  ...COMPANY_FACT_DEFINITIONS,
]

const DEFINITION_BY_KEY = new Map(SETTING_DEFINITIONS.map((definition) => [definition.key, definition]))

/**
 * The settings a `settings` tab describes, and what in it could not be used. A blank value means the
 * default. An unknown key is kept in the tab and reported. A value that does not hold falls back to
 * the default and is reported. A key set on more than one row is used from none of them, so it
 * takes its default, since where a row sits decides nothing.
 */
export function parseSettings(rows: readonly SettingRow[]): { readonly settings: Settings; readonly problems: RecordProblem[] } {
  const problems: RecordProblem[] = []
  const keyOf = (row: SettingRow): string => row.key.trim().toLowerCase()
  const shared = sharedKeys(rows, keyOf)
  let settings = DEFAULT_SETTINGS
  for (const row of rows) {
    const key = keyOf(row)
    if (key === '') {
      problems.push({ id: null, label: 'unnamed', reason: 'a value without a key' })
      continue
    }
    const named = { id: recordIdOf(SETTING_RECORDS, key), label: key }
    const known = key.startsWith(IMPORT_PROFILE_PREFIX) || DEFINITION_BY_KEY.has(key)
    if (known && shared.has(key)) {
      problems.push({ ...named, reason: `set on more than one row, so ${key.startsWith(IMPORT_PROFILE_PREFIX) ? 'the profile is not offered' : 'the default is used'}` })
      continue
    }
    if (key.startsWith(IMPORT_PROFILE_PREFIX)) {
      if (row.value === undefined || String(row.value).trim() === '') continue
      const profile = readProfile(key.slice(IMPORT_PROFILE_PREFIX.length), String(row.value))
      if (typeof profile === 'string') {
        problems.push({ ...named, reason: `${profile}, so the profile is not offered` })
      } else {
        settings = { ...settings, importProfiles: [...settings.importProfiles, profile] }
      }
      continue
    }
    const definition = DEFINITION_BY_KEY.get(key)
    if (definition === undefined) {
      problems.push({ ...named, reason: 'not a setting this app knows, so it is kept but not used' })
      continue
    }
    if (row.value === undefined || String(row.value).trim() === '') {
      continue
    }
    const applied = definition.apply(settings, row.value)
    if (typeof applied === 'string') {
      problems.push({ ...named, reason: `${applied}, so the default is used` })
    } else {
      settings = applied
    }
  }
  const clash = labelClash(settings.bucketLabels)
  if (clash !== null) {
    const key = rows.map(keyOf).find((candidate) => candidate.startsWith('label_')) ?? null
    problems.push({ id: key === null ? null : recordIdOf(SETTING_RECORDS, key), label: key ?? 'label_', reason: `${clash}, so every bucket label is back to its default` })
    settings = { ...settings, bucketLabels: DEFAULT_BUCKET_LABELS }
  }
  return { settings, problems }
}

/** The key and value of every setting, in template order, as a `settings` tab holds them. */
export function settingsTabEntries(settings: Settings): { readonly key: string; readonly value: SettingCell }[] {
  return [
    ...SETTING_DEFINITIONS.map((definition) => ({ key: definition.key, value: definition.valueOf(settings) })),
    ...settings.importProfiles.map((profile) => ({ key: profileKey(profile.name), value: profileValue(profile) })),
  ]
}

const IMPORT_PROFILE_NOTE =
  'How one bank\'s spreadsheet export imports, as word=column pairs: account, date, date_format, decimal, amount or debit and credit, and the optional balance, counterparty, counterparty_iban, description and reference. Import saves it.'

export function settingNote(key: string): string | null {
  return key.startsWith(IMPORT_PROFILE_PREFIX) ? IMPORT_PROFILE_NOTE : (DEFINITION_BY_KEY.get(key)?.note ?? null)
}

export type SettingsField =
  | 'companyName'
  | 'currency'
  | 'numberLocale'
  | 'reviewLabel'
  | 'cardSettlementIbans'
  | BillingAmountField
  | BillingItemField
  | InvoicingField
  | 'residenceCity'
  | 'birthYear'
  | 'dependants'
  | 'ownerLoanInterest'
  | DefinedBucket

/**
 * What is wrong with settings typed in the app, by field. The same rules as reading the tab, so a
 * workbook saved from the app always reads back without a problem.
 */
export function settingsErrors(settings: Settings): Partial<Record<SettingsField, string>> {
  const errors: Partial<Record<SettingsField, string>> = {}
  const currency = currencyProblem(settings.currency)
  if (currency !== null) errors.currency = currency
  const locale = localeProblem(settings.numberLocale)
  if (locale !== null) errors.numberLocale = locale
  const review = reviewLabelProblem(settings.reviewLabel)
  if (review !== null) errors.reviewLabel = review
  const cardAccounts = ibanListProblem(settings.cardSettlementIbans)
  if (cardAccounts !== null) errors.cardSettlementIbans = cardAccounts
  Object.assign(errors, billingErrors(settings.billing))
  for (const [field, value] of Object.entries(settings.invoicing) as [InvoicingField, string][]) {
    const problem = invoicingProblem(field, value)
    if (problem !== null) errors[field] = problem
  }
  const { residenceCity, birthYear, dependants, ownerLoanInterest } = settings.companyFacts
  const city = residenceCityProblem(residenceCity)
  if (city !== null) errors.residenceCity = city
  const born = birthYear === null ? null : birthYearProblem(birthYear)
  if (born !== null) errors.birthYear = born
  const dependantCount = dependantsProblem(dependants)
  if (dependantCount !== null) errors.dependants = dependantCount
  const loanInterest = ownerLoanInterestProblem(ownerLoanInterest)
  if (loanInterest !== null) errors.ownerLoanInterest = loanInterest
  const seen = new Map<string, DefinedBucket>()
  for (const bucket of BUCKETS) {
    const label = settings.bucketLabels[bucket]
    const problem = labelProblem(label)
    const taken = seen.get(label.toLowerCase())
    if (problem !== null) {
      errors[bucket] = problem
    } else if (taken !== undefined) {
      errors[bucket] = `${DEFAULT_BUCKET_LABELS[taken]} already uses this label`
    }
    seen.set(label.toLowerCase(), bucket)
  }
  return errors
}

function labelProblem(label: string): string | null {
  if (label === '') return 'a label cannot be blank'
  if (label.length > LABEL_MAX_LENGTH) return `a label can be at most ${LABEL_MAX_LENGTH} characters`
  if (RESERVED_LABELS.includes(label.toLowerCase())) return `"${label}" already names another line`
  return null
}

function labelClash(labels: Readonly<Record<DefinedBucket, string>>): string | null {
  const seen = new Map<string, DefinedBucket>()
  for (const bucket of BUCKETS) {
    const label = labels[bucket].toLowerCase()
    const taken = seen.get(label)
    if (taken !== undefined) {
      return `${taken} and ${bucket} are both labelled "${labels[bucket]}"`
    }
    seen.set(label, bucket)
  }
  return null
}

/** Null for a currency the browser knows and the cents arithmetic can hold. */
export function currencyProblem(currency: string): string | null {
  if (!/^[A-Z]{3}$/.test(currency)) {
    return `"${currency}" is not a three-letter currency code`
  }
  if (!Intl.supportedValuesOf('currency').includes(currency)) {
    return `${currency} is not a currency this browser knows`
  }
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
  if (digits > 2) {
    return `${currency} has ${digits} decimals, and the app counts in hundredths`
  }
  return null
}

function localeProblem(locale: string): string | null {
  try {
    return Intl.NumberFormat.supportedLocalesOf([locale]).length > 0 ? null : `"${locale}" is not a locale this browser knows`
  } catch {
    return `"${locale}" is not a locale tag such as en-GB`
  }
}

/** A comma-separated list of IBANs, each normalised, blanks left out. */
export function ibanListOf(text: string): string[] {
  return text
    .split(',')
    .map(normaliseIban)
    .filter((iban) => iban !== '')
}

function ibanListProblem(ibans: readonly string[]): string | null {
  const malformed = ibans.filter((iban) => !isIban(iban))
  return malformed.length === 0 ? null : `${malformed.map((iban) => `"${iban}"`).join(', ')} ${malformed.length === 1 ? 'is not an IBAN' : 'are not IBANs'}`
}

/** An amount needs the item its rows carry, or the plan cannot tell which rows it is about. */
function billingErrors(terms: BillingTerms): Partial<Record<BillingAmountField | BillingItemField, string>> {
  const errors: Partial<Record<BillingAmountField | BillingItemField, string>> = {}
  const pairs = [
    ['monthlyAmount', 'monthlyItem'],
    ['subscriptionAmount', 'subscriptionItem'],
    ['bonusAmount', 'bonusItem'],
  ] as const
  for (const [amountField, itemField] of pairs) {
    const amount = terms[amountField]
    const amountProblem = amount === null ? null : billingAmountProblem(amount / 100)
    if (amountProblem !== null) errors[amountField] = amountProblem
    const itemProblem = billingItemProblem(terms[itemField])
    if (itemProblem !== null) errors[itemField] = itemProblem
    else if (amount !== null && terms[itemField] === '') errors[itemField] = 'name the item its rows carry on the outgoing-plan tab'
  }
  return errors
}

function billingAmountProblem(amount: number): string | null {
  return Number.isFinite(amount) && amount > 0 ? null : 'use an amount above zero, such as 7200'
}

function billingItemProblem(item: string): string | null {
  return item.length > BILLING_ITEM_MAX_LENGTH ? `an item can be at most ${BILLING_ITEM_MAX_LENGTH} characters` : null
}

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

function reviewLabelProblem(label: string): string | null {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(label)) {
    return 'use letters, digits, - or _, with no spaces'
  }
  if ((MACHINE_FLAGS as readonly string[]).includes(label)) {
    return `"${label}" is what the categoriser writes`
  }
  return null
}

function booleanOf(cell: SettingCell): boolean | null {
  if (typeof cell === 'boolean') return cell
  const text = String(cell).trim().toLowerCase()
  if (['true', 'yes', 'on', '1'].includes(text)) return true
  if (['false', 'no', 'off', '0'].includes(text)) return false
  return null
}

/** The keys whose value differs between two settings, with the new value, in template order. */
export function changedSettings(current: Settings, next: Settings): { readonly key: string; readonly value: SettingCell }[] {
  const before = new Map(settingsTabEntries(current).map((entry) => [entry.key, entry.value]))
  return settingsTabEntries(next).filter((entry) => String(before.get(entry.key)) !== String(entry.value))
}
