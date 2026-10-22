import { normaliseIban } from '../../../shared/text/fold'
import { slugProblem } from '../../workbook/domain/slug'
import { currencyProblem } from './settings'

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
      found.account = 'Required'
    } else if (named.has(name)) {
      found.account = 'Already used above'
    } else if (saved !== '' && saved !== name && usedNames.has(saved)) {
      found.account = `${draft.savedName} is in use, so it keeps its name`
    } else if (name !== saved && slugProblem(name, 'account') !== null) {
      found.account = 'Lower-case letters, digits and single hyphens'
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

export function accountCellsOf(
  drafts: readonly AccountDraft[],
  savedCells: ReadonlyMap<number, Readonly<Record<string, string | number | boolean>>>,
): Record<string, string | number | boolean>[] {
  return drafts.map((draft) => ({
    ...(draft.saved === null ? {} : (savedCells.get(draft.saved) ?? {})),
    account: draft.account.trim().toLowerCase(),
    label: draft.label.trim(),
    iban: normaliseIban(draft.iban),
    currency: draft.currency.trim().toUpperCase(),
  }))
}
