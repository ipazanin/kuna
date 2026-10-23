import { moneyFromAmount } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { normaliseIban } from '../../../shared/text/fold'
import { BUCKETS } from '../../workbook/domain/bucket'
import type { DefinedBucket } from '../../workbook/domain/bucket'
import { isIban } from '../../workbook/domain/iban'
import { recordIdOf } from '../../workbook/domain/recordId'
import { SETTING_RECORDS } from '../../workbook/domain/recordKind'
import type { RecordsRead } from '../../workbook/domain/recordsRead'
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
  importProfiles: [],
}

/** `flagged_by` values the categoriser writes, which a person's label must not reuse. */
const MACHINE_FLAGS = ['rule', 'ai'] as const

/** Names the screens already give derived lines and chart series, so no bucket label may take them. */
const RESERVED_LABELS = ['net', 'all costs', 'owner earns', 'kept']

const LABEL_MAX_LENGTH = 40

const BILLING_ITEM_MAX_LENGTH = 60

export type SettingCell = string | number | boolean

export interface SettingRow {
  readonly key: string
  readonly value: SettingCell | undefined
}

type BucketLabelKey = `label_${string}`

/** One key of the settings tab, and how its cell reads into the values it sets and back. */
export interface SettingDefinition<Values> {
  readonly key: string
  /** What the key means, as the template's note on it says. */
  readonly note: string
  valueOf(values: Values): SettingCell
  /** The values with this key applied, or the reason the cell cannot be used. */
  apply(values: Values, cell: SettingCell): Values | string
}

/** The settings keys a pack reads, with the values they hold when blank, which core leaves to the pack. */
export interface PackSettings<Values> {
  readonly definitions: readonly SettingDefinition<Values>[]
  readonly defaults: Values
}

function bucketLabelKey(bucket: DefinedBucket): BucketLabelKey {
  return `label_${bucket.replace('-', '_')}`
}

const BUCKET_LABEL_DEFINITIONS: readonly SettingDefinition<Settings>[] = BUCKETS.map((bucket) => ({
  key: bucketLabelKey(bucket),
  note: `What the ${bucket} bucket is called on screen. The bucket itself keeps its name in the categories tab.`,
  valueOf: (settings) => settings.bucketLabels[bucket],
  apply: (settings, cell) => {
    const label = String(cell).trim()
    const problem = labelProblem(label)
    return problem ?? { ...settings, bucketLabels: { ...settings.bucketLabels, [bucket]: label } }
  },
}))

function withBilling(settings: Settings, terms: Partial<BillingTerms>): Settings {
  return { ...settings, billing: { ...settings.billing, ...terms } }
}

export type BillingAmountField = 'monthlyAmount' | 'subscriptionAmount' | 'bonusAmount'

export type BillingItemField = 'monthlyItem' | 'subscriptionItem' | 'bonusItem'

function billingAmountDefinition(key: string, field: BillingAmountField, note: string): SettingDefinition<Settings> {
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

function billingItemDefinition(key: string, field: BillingItemField, note: string): SettingDefinition<Settings> {
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
const BILLING_DEFINITIONS: readonly SettingDefinition<Settings>[] = [
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

function invoicingDefinition(key: string, field: InvoicingField, note: string): SettingDefinition<Settings> {
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
const INVOICING_DEFINITIONS: readonly SettingDefinition<Settings>[] = [
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

/** Every key the app reads, in the order the template lists them. */
export const SETTING_DEFINITIONS: readonly SettingDefinition<Settings>[] = [
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
]

const DEFINITION_BY_KEY = new Map(SETTING_DEFINITIONS.map((definition) => [definition.key, definition]))

function keyOfRow(row: SettingRow): string {
  return row.key.trim().toLowerCase()
}

/**
 * The values with one row's cell applied by its definition, or the problem that leaves the default.
 * A key set on more than one row is used from none of them, since where a row sits decides nothing.
 */
function applySettingRow<Values>(values: Values, row: SettingRow, definition: SettingDefinition<Values>, shared: ReadonlySet<string>): { readonly values: Values; readonly problem: RecordProblem | null } {
  const named = { id: recordIdOf(SETTING_RECORDS, definition.key), label: definition.key }
  if (shared.has(definition.key)) {
    return { values, problem: { ...named, reason: 'set on more than one row, so the default is used' } }
  }
  if (row.value === undefined || String(row.value).trim() === '') {
    return { values, problem: null }
  }
  const applied = definition.apply(values, row.value)
  return typeof applied === 'string' ? { values, problem: { ...named, reason: `${applied}, so the default is used` } } : { values: applied, problem: null }
}

/**
 * The settings a `settings` tab describes, and what in it could not be used. A blank value means the
 * default. An unknown key is kept in the tab and reported. A value that does not hold falls back to
 * the default and is reported. A key set on more than one row takes its default. The keys a pack
 * reads are left to it, so they are neither read nor reported here.
 */
export function parseSettings(rows: readonly SettingRow[], packKeys: ReadonlySet<string> = new Set()): { readonly settings: Settings; readonly problems: RecordProblem[] } {
  const problems: RecordProblem[] = []
  const shared = sharedKeys(rows, keyOfRow)
  let settings = DEFAULT_SETTINGS
  for (const row of rows) {
    const key = keyOfRow(row)
    if (key === '') {
      problems.push({ id: null, label: 'unnamed', reason: 'a value without a key' })
      continue
    }
    if (packKeys.has(key)) {
      continue
    }
    const definition = DEFINITION_BY_KEY.get(key)
    if (definition !== undefined) {
      const applied = applySettingRow(settings, row, definition, shared)
      settings = applied.values
      if (applied.problem !== null) problems.push(applied.problem)
      continue
    }
    const named = { id: recordIdOf(SETTING_RECORDS, key), label: key }
    if (isUnknownSettingKey(key, packKeys)) {
      problems.push({ ...named, reason: 'not a setting this app knows, so it is kept but not used' })
      continue
    }
    if (shared.has(key)) {
      problems.push({ ...named, reason: 'set on more than one row, so the profile is not offered' })
      continue
    }
    if (row.value === undefined || String(row.value).trim() === '') continue
    const profile = readProfile(key.slice(IMPORT_PROFILE_PREFIX.length), String(row.value))
    if (typeof profile === 'string') {
      problems.push({ ...named, reason: `${profile}, so the profile is not offered` })
    } else {
      settings = { ...settings, importProfiles: [...settings.importProfiles, profile] }
    }
  }
  const clash = labelClash(settings.bucketLabels)
  if (clash !== null) {
    const key = rows.map(keyOfRow).find((candidate) => candidate.startsWith('label_')) ?? null
    problems.push({ id: key === null ? null : recordIdOf(SETTING_RECORDS, key), label: key ?? 'label_', reason: `${clash}, so every bucket label is back to its default` })
    settings = { ...settings, bucketLabels: DEFAULT_BUCKET_LABELS }
  }
  return { settings, problems }
}

/** A key neither core, the pack nor an import profile reads, which the tab keeps and the app reports. */
function isUnknownSettingKey(key: string, packKeys: ReadonlySet<string>): boolean {
  return key !== '' && !packKeys.has(key) && !DEFINITION_BY_KEY.has(key) && !key.startsWith(IMPORT_PROFILE_PREFIX)
}

/** The keys of the settings that no setting of core or the pack reads, unknown keys and import profiles, which a person may take off the tab. */
export function removableSettingKeys(rows: readonly SettingRow[], pack: PackSettings<unknown> | null): string[] {
  const packKeys = new Set(pack?.definitions.map((definition) => definition.key))
  return [...new Set(rows.map(keyOfRow).filter((key) => key !== '' && !packKeys.has(key) && !DEFINITION_BY_KEY.has(key)))]
}

/** The values a pack's settings keys hold, read the way `parseSettings` reads core's, and what in them could not be used. */
export function readPackSettings<Values>(rows: readonly SettingRow[], pack: PackSettings<Values>): { readonly values: Values; readonly problems: RecordProblem[] } {
  const definitions = new Map(pack.definitions.map((definition) => [definition.key, definition]))
  const shared = sharedKeys(rows, keyOfRow)
  const problems: RecordProblem[] = []
  let values = pack.defaults
  for (const row of rows) {
    const definition = definitions.get(keyOfRow(row))
    if (definition === undefined) continue
    const applied = applySettingRow(values, row, definition, shared)
    values = applied.values
    if (applied.problem !== null) problems.push(applied.problem)
  }
  return { values, problems }
}

/** Core's settings and a pack's values from one settings tab, and what in either could not be used. Each reads its own keys. */
export function readSettingsTab<Values>(
  rows: readonly SettingRow[],
  pack: PackSettings<Values> | null,
): { readonly settings: Settings; readonly packValues: Values | null; readonly problems: RecordProblem[] } {
  const core = parseSettings(rows, new Set(pack?.definitions.map((definition) => definition.key)))
  const packRead = pack === null ? null : readPackSettings(rows, pack)
  return { settings: core.settings, packValues: packRead?.values ?? null, problems: [...core.problems, ...(packRead?.problems ?? [])] }
}

/** The value the settings hold for a key, which a write of it checks is still there, or null when no setting has the key. */
export function heldSettingValue(read: RecordsRead<SettingRow>, key: string): SettingCell | null {
  const held = read.records.find((stored) => stored.record.key.trim().toLowerCase() === key)
  return held === undefined ? null : (held.record.value ?? '')
}

/** A pack's settings keys with the values they hold. */
export interface PackSettingValues<Values> {
  readonly settings: PackSettings<Values>
  readonly values: Values
}

/** The key and value of every setting in template order, as a `settings` tab holds them: core's keys, then a pack's, then the import profiles. */
export function settingsTabEntries<Values>(settings: Settings, pack: PackSettingValues<Values> | null): { readonly key: string; readonly value: SettingCell }[] {
  return [
    ...SETTING_DEFINITIONS.map((definition) => ({ key: definition.key, value: definition.valueOf(settings) })),
    ...(pack === null ? [] : packSettingEntries(pack)),
    ...settings.importProfiles.map((profile) => ({ key: profileKey(profile.name), value: profileValue(profile) })),
  ]
}

function packSettingEntries<Values>(pack: PackSettingValues<Values>): { readonly key: string; readonly value: SettingCell }[] {
  return pack.settings.definitions.map((definition) => ({ key: definition.key, value: definition.valueOf(pack.values) }))
}

const IMPORT_PROFILE_NOTE =
  'How one bank\'s spreadsheet export imports, as word=column pairs: account, date, date_format, decimal, amount or debit and credit, and the optional balance, counterparty, counterparty_iban, description and reference. Import saves it.'

/** The template's note on a key, core's or the pack's, or null for a key neither reads. */
export function settingNote(key: string, pack: PackSettings<unknown> | null): string | null {
  if (key.startsWith(IMPORT_PROFILE_PREFIX)) return IMPORT_PROFILE_NOTE
  return (DEFINITION_BY_KEY.get(key) ?? pack?.definitions.find((definition) => definition.key === key))?.note ?? null
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

function reviewLabelProblem(label: string): string | null {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(label)) {
    return 'use letters, digits, - or _, with no spaces'
  }
  if ((MACHINE_FLAGS as readonly string[]).includes(label)) {
    return `"${label}" is what the categoriser writes`
  }
  return null
}

/** A flag from a settings cell: TRUE or FALSE, and the words people type for them. Null for anything else. */
export function booleanOf(cell: SettingCell): boolean | null {
  if (typeof cell === 'boolean') return cell
  const text = String(cell).trim().toLowerCase()
  if (['true', 'yes', 'on', '1'].includes(text)) return true
  if (['false', 'no', 'off', '0'].includes(text)) return false
  return null
}

/** The keys whose value differs between two settings, with the new value, in template order. */
export function changedSettings(current: Settings, next: Settings): { readonly key: string; readonly value: SettingCell }[] {
  return changedEntries(settingsTabEntries(current, null), settingsTabEntries(next, null))
}

/** The keys of a pack whose value differs between two sets of its values, with the new value, in template order. */
export function changedPackSettings<Values>(settings: PackSettings<Values>, current: Values, next: Values): { readonly key: string; readonly value: SettingCell }[] {
  return changedEntries(packSettingEntries({ settings, values: current }), packSettingEntries({ settings, values: next }))
}

function changedEntries(
  current: readonly { readonly key: string; readonly value: SettingCell }[],
  next: readonly { readonly key: string; readonly value: SettingCell }[],
): { readonly key: string; readonly value: SettingCell }[] {
  const before = new Map(current.map((entry) => [entry.key, entry.value]))
  return next.filter((entry) => String(before.get(entry.key)) !== String(entry.value))
}
