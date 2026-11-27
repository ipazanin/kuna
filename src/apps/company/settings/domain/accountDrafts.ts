import { normaliseIban } from '../../../../shared/text/fold'
import { accountOfFields } from '../../workbook/domain/accountsReading'
import type { AccountRecord } from '../../workbook/domain/accountsReading'
import { slugProblem } from '../../workbook/domain/slug'
import { slugOf, storedFieldOfValue, textOf } from '../../../../shared/storage/domain/storedFields'
import { periodsText } from '../../../../shared/app/accountSource'
import { draftsOfPeriods, periodsOfDrafts } from '../../../../shared/app/periodDrafts'
import type { PeriodDraft, PeriodDraftProblem } from '../../../../shared/app/periodDrafts'
import { BY_HAND_SOURCES } from '../../workbook/domain/workbook'
import type { Account, CompanyPeriod, CompanySource } from '../../workbook/domain/workbook'
import type { StoredField, StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { StoredRecord } from '../../../../shared/storage/domain/recordsRead'
import { madeOfDrafts } from '../../workbook/domain/recordDrafts'
import type { MadeDraft } from '../../workbook/domain/recordDrafts'
import { currencyProblem } from './settings'
import { words as editorWords } from '../../workbook/domain/words'
import { words } from './words'

/** One row of the accounts editor, as text. */
export interface AccountDraft {
  /** Where the row this draft was read from stands among the rows the editor opened with, or null for a row added in the editor. */
  readonly saved: number | null
  /** The name the row had when the editor opened, which ledger rows may use. */
  readonly savedName: string
  readonly account: string
  /** What the screens call it. Blank shows the account name. */
  readonly label: string
  readonly iban: string
  readonly currency: string
  /** The bank that keeps it. Blank names none. */
  readonly bank: string
  /** Where its rows come from, each source from the day typed, the first from its own day or, blank, from the account's start. */
  readonly periods: readonly PeriodDraft<CompanySource>[]
}

/** The draft's periods, or null while one cannot be kept, with why each cannot. A first period of the mail needs its day, as the mail search starts on it. */
export function sourcesOfDraft(draft: Pick<AccountDraft, 'periods'>): { readonly periods: readonly CompanyPeriod[] | null; readonly problems: readonly (PeriodDraftProblem | null)[] } {
  return periodsOfDrafts(draft.periods, ['mail'])
}

/**
 * The drafts of the stored accounts, as the workbook holds their text, each with where its rows come from and its bank as the
 * workbook reads them by its name.
 */
export function accountDraftsOf(stored: readonly StoredRecord<unknown>[], accounts: readonly Pick<Account, 'slug' | 'sources' | 'bank'>[]): AccountDraft[] {
  const read = new Map(accounts.map((account) => [account.slug, account]))
  return stored.map(({ fields }, saved) => {
    const text = (name: string): string => textOf(fields[name])
    const account = read.get(slugOf(fields.account))
    return {
      saved,
      savedName: text('account'),
      account: text('account'),
      label: text('label'),
      iban: text('iban'),
      currency: text('currency'),
      bank: account?.bank ?? text('bank'),
      periods: draftsOfPeriods(account?.sources ?? BY_HAND_SOURCES),
    }
  })
}

/** A new account's draft: kept by hand, with nothing typed. */
export const NEW_ACCOUNT_DRAFT: AccountDraft = { saved: null, savedName: '', account: '', label: '', iban: '', currency: '', bank: '', periods: draftsOfPeriods(BY_HAND_SOURCES) }

/** The accounts the drafts make, each over the fields its stored record holds. */
export function accountsOfDrafts(stored: readonly StoredRecord<unknown>[], drafts: readonly AccountDraft[]): MadeDraft<AccountRecord>[] {
  const fields = drafts.map((draft) => accountFieldsOf(draft, draft.saved === null ? {} : (stored[draft.saved]?.fields ?? {})))
  return madeOfDrafts(drafts, fields, stored, accountOfFields)
}

export type AccountField = 'account' | 'currency' | 'sources'

export type AccountDraftErrors = ReadonlyMap<number, Partial<Record<AccountField, string>>>

/** Each account once, by name, a new name in the slug format. An account in use keeps its name. A currency, if given, is a real one. */
export function accountDraftErrors(drafts: readonly AccountDraft[], usedNames: ReadonlySet<string>): AccountDraftErrors {
  const errors = new Map<number, Partial<Record<AccountField, string>>>()
  const named = new Set<string>()
  drafts.forEach((draft, index) => {
    const found: Partial<Record<AccountField, string>> = {}
    const name = draft.account.trim().toLowerCase()
    const saved = draft.savedName.trim().toLowerCase()
    if (name === '') {
      found.account = editorWords.fields.required
    } else if (named.has(name)) {
      found.account = editorWords.fields.usedAbove
    } else if (saved !== '' && saved !== name && usedNames.has(saved)) {
      found.account = editorWords.fields.keepsName(draft.savedName)
    } else if (name !== saved && slugProblem(name, 'account') !== null) {
      found.account = editorWords.fields.slugFormat
    }
    if (name !== '') {
      named.add(name)
    }
    const problem = sourcesOfDraft(draft).problems.find((candidate) => candidate !== null)
    if (problem !== undefined && problem !== null) {
      found.sources = words.fields.period[problem]
    }
    const currency = draft.currency.trim().toUpperCase()
    const currencyFault = currency === '' ? null : currencyProblem(currency)
    if (currencyFault !== null) {
      found.currency = currencyFault
    }
    if (Object.keys(found).length > 0) {
      errors.set(index, found)
    }
  })
  return errors
}

/**
 * The draft's fields, over the fields of the account it was read from. A blank field is absent. Where its rows come from is always
 * written, so an account that did not say says it from then on, and the cells of a file from before periods go.
 */
function accountFieldsOf(draft: AccountDraft, stored: StoredFields): StoredFields {
  const periods = sourcesOfDraft(draft).periods
  const typed: Readonly<Record<string, string>> = {
    account: draft.account.trim().toLowerCase(),
    label: draft.label.trim(),
    iban: normaliseIban(draft.iban),
    currency: draft.currency.trim().toUpperCase(),
    bank: draft.bank.trim(),
    sources: periods === null ? draft.periods.map((period) => `${period.source} ${period.from}`.trim()).join(', ') : periodsText(periods),
    rows_from: '',
    starts_on: '',
    also_from: '',
  }
  const fields: Record<string, StoredField> = { ...stored }
  for (const [name, text] of Object.entries(typed)) {
    if (text === '') {
      delete fields[name]
    } else {
      fields[name] = storedFieldOfValue(text)
    }
  }
  return fields
}
