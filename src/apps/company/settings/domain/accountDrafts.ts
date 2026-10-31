import { normaliseIban } from '../../../../shared/text/fold'
import { accountOfFields } from '../../workbook/domain/accountsReading'
import type { AccountRecord } from '../../workbook/domain/accountsReading'
import { slugProblem } from '../../workbook/domain/slug'
import { storedFieldOfValue, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredField, StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { StoredRecord } from '../../../../shared/storage/domain/recordsRead'
import { madeOfDrafts } from './recordDrafts'
import type { MadeDraft } from './recordDrafts'
import { currencyProblem } from './settings'
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
}

/** The drafts of the stored accounts, as the workbook holds their text. */
export function accountDraftsOf(stored: readonly StoredRecord<unknown>[]): AccountDraft[] {
  return stored.map(({ fields }, saved) => {
    const text = (name: string): string => textOf(fields[name])
    return { saved, savedName: text('account'), account: text('account'), label: text('label'), iban: text('iban'), currency: text('currency') }
  })
}

/** The accounts the drafts make, each over the fields its stored record holds. */
export function accountsOfDrafts(stored: readonly StoredRecord<unknown>[], drafts: readonly AccountDraft[]): MadeDraft<AccountRecord>[] {
  const fields = drafts.map((draft) => accountFieldsOf(draft, draft.saved === null ? {} : (stored[draft.saved]?.fields ?? {})))
  return madeOfDrafts(drafts, fields, stored, accountOfFields)
}

export type AccountField = 'account' | 'currency'

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
      found.account = words.fields.required
    } else if (named.has(name)) {
      found.account = words.fields.usedAbove
    } else if (saved !== '' && saved !== name && usedNames.has(saved)) {
      found.account = words.fields.keepsName(draft.savedName)
    } else if (name !== saved && slugProblem(name, 'account') !== null) {
      found.account = words.fields.slugFormat
    }
    if (name !== '') {
      named.add(name)
    }
    const currency = draft.currency.trim().toUpperCase()
    const problem = currency === '' ? null : currencyProblem(currency)
    if (problem !== null) {
      found.currency = problem
    }
    if (Object.keys(found).length > 0) {
      errors.set(index, found)
    }
  })
  return errors
}

/** The draft's fields, over the fields of the account it was read from. A blank field is absent. */
function accountFieldsOf(draft: AccountDraft, stored: StoredFields): StoredFields {
  const typed: Readonly<Record<string, string>> = {
    account: draft.account.trim().toLowerCase(),
    label: draft.label.trim(),
    iban: normaliseIban(draft.iban),
    currency: draft.currency.trim().toUpperCase(),
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
