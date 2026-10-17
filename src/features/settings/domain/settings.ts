import { normaliseIban } from '../../../shared/text/fold'
import { BUCKETS } from '../../workbook/domain/bucket'
import type { DefinedBucket } from '../../workbook/domain/bucket'

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
}

/** `flagged_by` values the categoriser writes, which a person's label must not reuse. */
const MACHINE_FLAGS = ['rule', 'ai'] as const

/** Names the screens already give derived lines and chart series, so no bucket label may take them. */
const RESERVED_LABELS = ['net', 'all costs', 'owner earns', 'kept']

const LABEL_MAX_LENGTH = 40

/** Two letters, two check digits and up to thirty letters or digits, after the grouping spaces go. */
const IBAN_SHAPE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/

export type SettingCell = string | number | boolean

export interface SettingRow {
  readonly key: string
  readonly value: SettingCell | undefined
  readonly sheetRow: number
}

export interface SettingProblem {
  readonly sheetRow: number
  readonly reason: string
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
]

const DEFINITION_BY_KEY = new Map(SETTING_DEFINITIONS.map((definition) => [definition.key, definition]))

/**
 * The settings a `settings` tab describes, and what in it could not be used. A blank value means the
 * default. An unknown key is kept in the tab and reported. A value that does not hold falls back to
 * the default and is reported. The first row of a key wins, as with categories.
 */
export function parseSettings(rows: readonly SettingRow[]): { readonly settings: Settings; readonly problems: SettingProblem[] } {
  const problems: SettingProblem[] = []
  const seen = new Set<string>()
  let settings = DEFAULT_SETTINGS
  for (const row of rows) {
    const key = row.key.trim().toLowerCase()
    if (key === '') {
      problems.push({ sheetRow: row.sheetRow, reason: 'a value without a key' })
      continue
    }
    const definition = DEFINITION_BY_KEY.get(key)
    if (definition === undefined) {
      problems.push({ sheetRow: row.sheetRow, reason: `"${key}" is not a setting this app knows, so it is kept but not used` })
      continue
    }
    if (seen.has(key)) {
      problems.push({ sheetRow: row.sheetRow, reason: `"${key}" is already set above` })
      continue
    }
    seen.add(key)
    if (row.value === undefined || String(row.value).trim() === '') {
      continue
    }
    const applied = definition.apply(settings, row.value)
    if (typeof applied === 'string') {
      problems.push({ sheetRow: row.sheetRow, reason: `${key}: ${applied}, so the default is used` })
    } else {
      settings = applied
    }
  }
  const clash = labelClash(settings.bucketLabels)
  if (clash !== null) {
    const sheetRow = rows.find((row) => row.key.trim().toLowerCase().startsWith('label_'))?.sheetRow ?? 0
    problems.push({ sheetRow, reason: `${clash}, so every bucket label is back to its default` })
    settings = { ...settings, bucketLabels: DEFAULT_BUCKET_LABELS }
  }
  return { settings, problems }
}

/** The key and value of every setting, in template order, as a `settings` tab holds them. */
export function settingsTabEntries(settings: Settings): { readonly key: string; readonly value: SettingCell }[] {
  return SETTING_DEFINITIONS.map((definition) => ({ key: definition.key, value: definition.valueOf(settings) }))
}

export function isKnownSetting(key: string): boolean {
  return DEFINITION_BY_KEY.has(key.trim().toLowerCase())
}

export function settingNote(key: string): string | null {
  return DEFINITION_BY_KEY.get(key)?.note ?? null
}

export type SettingsField = 'companyName' | 'currency' | 'numberLocale' | 'reviewLabel' | 'cardSettlementIbans' | DefinedBucket

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
  const malformed = ibans.filter((iban) => !IBAN_SHAPE.test(iban))
  return malformed.length === 0 ? null : `${malformed.map((iban) => `"${iban}"`).join(', ')} ${malformed.length === 1 ? 'is not an IBAN' : 'are not IBANs'}`
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
