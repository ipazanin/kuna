import { STATEMENT_KINDS } from './recipeStatement'
import type { SavedRecipe } from '../../../../shared/recipes/domain/savedRecipe'
import { RECIPE_RECORDS } from '../../workbook/domain/spendingKinds'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { placeOfProblem, tableRecipeOf } from '../../../../shared/recipes/domain/tableRecipeDraft'
import type { DraftPlace, DraftProblem, TableRecipeDraft, TableRecipeFields } from '../../../../shared/recipes/domain/tableRecipeDraft'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * What a statement recipe a person or the chat writes reads: the day and its time into `started`, one signed amount or a
 * debit and credit pair, and the payee, a fee and a currency where the file has them. A kind that comes in reads them all, and
 * a row the bank did not complete or of another product is only counted.
 */
export const STATEMENT_RECIPE_FIELDS = {
  date: 'started',
  time: 'startedTime',
  amount: 'amount',
  debit: 'debit',
  credit: 'credit',
  optional: [
    { field: 'description', as: 'text' },
    { field: 'fee', as: 'decimal' },
    { field: 'currency', as: 'text' },
  ],
  kinds: STATEMENT_KINDS.map((kind) => ({ kind, reads: kind !== 'not-completed' && kind !== 'other-product' })),
} as const satisfies TableRecipeFields

/** A field a person picks a column for. The time reads the day's own column, so it has none. */
export type StatementRecipeField = (typeof STATEMENT_RECIPE_FIELDS)['date' | 'amount' | 'debit' | 'credit'] | (typeof STATEMENT_RECIPE_FIELDS)['optional'][number]['field']

/** What a statement recipe lacks beyond its draft: the bank whose accounts take its rows, or a currency for a file whose rows name none. */
export type StatementRecipeProblem = DraftProblem | { readonly kind: 'no-bank' } | { readonly kind: 'no-currency' }

/** Where a person fixes a problem of a statement recipe: the bank and currency fields, or where the draft's own problem sits. */
export function placeOfStatementProblem(problem: StatementRecipeProblem): DraftPlace | 'bank' | 'currency' {
  if (problem.kind === 'no-bank') return 'bank'
  if (problem.kind === 'no-currency') return 'currency'
  return placeOfProblem(problem)
}

/**
 * The recipe the Spending file keeps for a draft, under the record id it has or gets, with the bank whose accounts take its
 * rows and the currency of every row where the file names none, or everything it lacks.
 */
export function statementRecipeOf(
  id: RecordId,
  draft: TableRecipeDraft,
  bank: string,
  currency: CurrencyCode | null,
): { readonly saved: SavedRecipe } | { readonly problems: readonly StatementRecipeProblem[] } {
  const own: StatementRecipeProblem[] = [
    ...(bank.trim() === '' ? [{ kind: 'no-bank' } as const] : []),
    ...(currency === null && (draft.columns['currency'] ?? '').trim() === '' ? [{ kind: 'no-currency' } as const] : []),
  ]
  const made = tableRecipeOf(keyOfRecordId(RECIPE_RECORDS, id), draft, STATEMENT_RECIPE_FIELDS)
  if ('problems' in made) return { problems: [...own, ...made.problems] }
  return own.length > 0 ? { problems: own } : { saved: { id, bank: bank.trim(), currency, recipe: made.recipe } }
}
