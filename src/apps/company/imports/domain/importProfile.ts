import { capitalised } from '../../../../shared/text/capitalised'
import { words } from './words'

/** How a text date is written. A date cell is read as a date whatever the profile says. */
export const DATE_FORMATS = ['dd.mm.yyyy', 'dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd'] as const

export type DateFormat = (typeof DATE_FORMATS)[number]

/** The decimal mark of a text amount: `1.234,56` or `1,234.56`. A number cell is read as a number. */
export const DECIMAL_MARKS = ['comma', 'point'] as const

export type DecimalMark = (typeof DECIMAL_MARKS)[number]

/** One signed amount column, money out negative, or a debit and a credit column, each a positive amount. */
export type AmountColumns = { readonly signed: string } | { readonly debit: string; readonly credit: string }

/**
 * How one bank's spreadsheet export reads as ledger rows, saved on the settings tab as
 * `import_profile_<name>` so it follows the workbook. Each column is named by its header text, so
 * the header row is found in the file wherever it sits. A blank optional column means the export
 * has none.
 */
export interface ImportProfile {
  /** Lower-case letters and digits with single hyphens. */
  readonly name: string
  /** The account on the accounts tab the export is for. */
  readonly account: string
  readonly date: string
  readonly dateFormat: DateFormat
  readonly decimal: DecimalMark
  readonly amount: AmountColumns
  readonly balance: string
  readonly counterparty: string
  readonly counterpartyIban: string
  readonly description: string
  readonly reference: string
}

export const IMPORT_PROFILE_PREFIX = 'import_profile_'

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** The optional columns, by the word the setting's value names each with. */
const OPTIONAL_COLUMNS = {
  balance: 'balance',
  counterparty: 'counterparty',
  counterparty_iban: 'counterpartyIban',
  description: 'description',
  reference: 'reference',
} as const satisfies Record<string, keyof ImportProfile>

const KNOWN_WORDS = new Set(['account', 'date', 'date_format', 'decimal', 'amount', 'debit', 'credit', ...Object.keys(OPTIONAL_COLUMNS)])

/** The settings key a profile is saved under. */
export function profileKey(name: string): string {
  return `${IMPORT_PROFILE_PREFIX}${name}`
}

/** Null when the name can be a profile's. */
export function profileNameProblem(name: string): string | null {
  return NAME_PATTERN.test(name) ? null : words.profile.badName
}

/**
 * A profile from its settings row, such as `account=otp; date=Datum; date_format=dd.mm.yyyy;
 * decimal=comma; debit=Isplata; credit=Uplata; balance=Stanje`, or why it cannot be used.
 */
export function readProfile(name: string, value: string): ImportProfile | string {
  const nameProblem = profileNameProblem(name)
  if (nameProblem !== null) {
    return nameProblem
  }
  const fields = new Map<string, string>()
  for (const part of value.split(';')) {
    if (part.trim() === '') continue
    const separator = part.indexOf('=')
    const word = (separator < 0 ? part : part.slice(0, separator)).trim().toLowerCase()
    if (separator < 0 || !KNOWN_WORDS.has(word)) {
      return words.profile.notAPair(part.trim())
    }
    if (fields.has(word)) {
      return words.profile.givenTwice(word)
    }
    fields.set(word, part.slice(separator + 1).trim())
  }
  const field = (word: string): string => fields.get(word) ?? ''
  const missing = ['account', 'date'].filter((word) => field(word) === '')
  if (missing.length > 0) {
    return words.profile.namesNo(missing)
  }
  const dateFormat = field('date_format') || 'dd.mm.yyyy'
  if (!(DATE_FORMATS as readonly string[]).includes(dateFormat)) {
    return words.profile.badDateFormat(dateFormat, DATE_FORMATS)
  }
  const decimal = field('decimal') || 'comma'
  if (!(DECIMAL_MARKS as readonly string[]).includes(decimal)) {
    return words.profile.badDecimal(decimal)
  }
  const signed = field('amount')
  const debit = field('debit')
  const credit = field('credit')
  if (signed !== '' ? debit !== '' || credit !== '' : debit === '' || credit === '') {
    return words.profile.amountColumns
  }
  return {
    name,
    account: field('account').toLowerCase(),
    date: field('date'),
    dateFormat: dateFormat as DateFormat,
    decimal: decimal as DecimalMark,
    amount: signed !== '' ? { signed } : { debit, credit },
    balance: field('balance'),
    counterparty: field('counterparty'),
    counterpartyIban: field('counterparty_iban'),
    description: field('description'),
    reference: field('reference'),
  }
}

/** The settings value a profile is saved as, every column it names in a fixed order. */
export function profileValue(profile: ImportProfile): string {
  const amount: [string, string][] =
    'signed' in profile.amount
      ? [['amount', profile.amount.signed]]
      : [
          ['debit', profile.amount.debit],
          ['credit', profile.amount.credit],
        ]
  const pairs: [string, string][] = [
    ['account', profile.account],
    ['date', profile.date],
    ['date_format', profile.dateFormat],
    ['decimal', profile.decimal],
    ...amount,
    ...Object.entries(OPTIONAL_COLUMNS).map(([word, field]): [string, string] => [word, profile[field]]),
  ]
  return pairs
    .filter(([, column]) => column !== '')
    .map(([word, column]) => `${word}=${column}`)
    .join('; ')
}

/** The header texts a profile reads, which a file must carry in one row. */
export function profileColumns(profile: ImportProfile): string[] {
  const amount = 'signed' in profile.amount ? [profile.amount.signed] : [profile.amount.debit, profile.amount.credit]
  return [profile.date, ...amount, ...Object.values(OPTIONAL_COLUMNS).map((field) => profile[field])].filter((column) => column !== '')
}

/** Null when every column of the profile can be saved: a header with a semicolon or an equals sign would not read back. */
export function profileColumnProblem(profile: ImportProfile): string | null {
  const unsaveable = profileColumns(profile).find((column) => /[;=]/.test(column))
  return unsaveable === undefined ? null : words.profile.unsaveableColumn(unsaveable)
}

/** What a profile being made still lacks before it can read a file, as a sentence, or null when it can. */
export function profileDraftProblem(profile: ImportProfile): string | null {
  if (profileNameProblem(profile.name) !== null) return words.profile.draft.name
  if (profile.account === '') return words.profile.draft.account
  if (profile.date === '') return words.profile.draft.date
  const { amount } = profile
  if ('signed' in amount ? amount.signed === '' : amount.debit === '' || amount.credit === '') return words.profile.draft.amount
  const column = profileColumnProblem(profile)
  return column === null ? null : `${capitalised(column)}.`
}
