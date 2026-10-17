import { normaliseIban } from '../../../shared/text/fold'
import { currencyProblem } from './settings'

/** One row of the accounts editor, as text. */
export interface AccountDraft {
  /** The row number this draft was read from, or null for a row added in the editor. */
  readonly sheetRow: number | null
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

/** Each account once, by name. An account the ledger uses keeps its name. A currency, if given, is a real one. */
export function accountDraftErrors(drafts: readonly AccountDraft[], usedNames: ReadonlySet<string>): AccountDraftErrors {
  const errors = new Map<number, Partial<Record<AccountField, string>>>()
  const firstAt = new Map<string, number>()
  drafts.forEach((draft, index) => {
    const found: Partial<Record<AccountField, string>> = {}
    const name = draft.account.trim().toLowerCase()
    const saved = draft.savedName.trim().toLowerCase()
    if (name === '') {
      found.account = 'Required'
    } else if (firstAt.has(name)) {
      found.account = `Already on row ${(firstAt.get(name) ?? 0) + 1}`
    } else if (saved !== '' && saved !== name && usedNames.has(saved)) {
      found.account = `Ledger rows use ${draft.savedName}, so it keeps its name`
    }
    if (name !== '' && !firstAt.has(name)) {
      firstAt.set(name, index)
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
    ...(draft.sheetRow === null ? {} : (savedCells.get(draft.sheetRow) ?? {})),
    account: draft.account.trim().toLowerCase(),
    label: draft.label.trim(),
    iban: normaliseIban(draft.iban),
    currency: draft.currency.trim().toUpperCase(),
  }))
}
