import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { SavedRecipe } from '../../../../shared/recipes/domain/savedRecipe'
import { placeOfProblem, tableRecipeOf } from '../../../../shared/recipes/domain/tableRecipeDraft'
import type { DraftPlace, DraftProblem, TableRecipeDraft, TableRecipeFields } from '../../../../shared/recipes/domain/tableRecipeDraft'
import { tableRows } from '../../../../shared/recipes/domain/tableRows'
import type { TableCells } from '../../../../shared/recipes/domain/tableRows'
import type { Recipe, TableFile } from '../../../../shared/recipes/domain/recipe'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recipeReadsInto } from '../../workbook/domain/accountBanks'
import { RECIPE_RECORDS } from '../../workbook/domain/coreKinds'
import type { Account } from '../../workbook/domain/workbook'

/** The kinds a row of a bank's table file can be: an entry, which comes in, or a row the recipe leaves out, which is only counted. */
export const TABLE_KINDS = ['entry', 'left-out'] as const

export type TableKind = (typeof TABLE_KINDS)[number]

/**
 * What a Company table recipe reads: the day, one signed amount or a debit and credit pair, and the balance, the other side, its
 * IBAN, the description and the bank's reference where the file has them.
 */
export const TABLE_RECIPE_FIELDS = {
  date: 'date',
  time: 'time',
  amount: 'amount',
  debit: 'debit',
  credit: 'credit',
  optional: [
    { field: 'balance', as: 'decimal' },
    { field: 'counterparty', as: 'text' },
    { field: 'counterpartyIban', as: 'text' },
    { field: 'description', as: 'text' },
    { field: 'reference', as: 'text' },
  ],
  kinds: TABLE_KINDS.map((kind) => ({ kind, reads: kind === 'entry' })),
} as const satisfies TableRecipeFields

/** A field a person picks a column for. The time reads the day's own column, so it has none. */
export type TableRecipeField = (typeof TABLE_RECIPE_FIELDS)['date' | 'amount' | 'debit' | 'credit'] | (typeof TABLE_RECIPE_FIELDS)['optional'][number]['field']

/** A table recipe of the Company file with the table format its runs need. */
export interface TableRecipe {
  readonly saved: SavedRecipe
  readonly recipe: Recipe<TableFile>
}

/** The recipes the Company file keeps that read table files, in its order. */
export function tableRecipesOf(recipes: readonly SavedRecipe[]): TableRecipe[] {
  return recipes.flatMap((saved) => (saved.recipe.file.format === 'table' ? [{ saved, recipe: { ...saved.recipe, file: saved.recipe.file } }] : []))
}

/** The recipes whose columns all head one row among a file's first rows, in the order the file keeps them. */
export function fittingRecipes(cells: TableCells, recipes: readonly TableRecipe[]): TableRecipe[] {
  return recipes.filter(({ recipe }) => tableRows(recipe, cells).kind === 'read')
}

/** The account a recipe's rows go to: the one account of its bank in its currency, or why there is none to take them. */
export type RecipeAccount =
  | { readonly kind: 'found'; readonly account: string }
  | { readonly kind: 'none'; readonly bank: string; readonly currency: string }
  | { readonly kind: 'many'; readonly bank: string; readonly currency: string; readonly accounts: readonly string[] }

/**
 * The one account the recipe reads into, where a recipe's missing currency means the books' own. Two such accounts refuse the
 * file, since the rows could be either's, and Settings warns beside both through `sharedBanks`.
 */
export function recipeAccount(saved: Pick<SavedRecipe, 'bank' | 'currency'>, accounts: readonly Pick<Account, 'slug' | 'bank' | 'currency'>[], booksCurrency: string): RecipeAccount {
  const currency = saved.currency ?? booksCurrency
  const fitting = accounts.filter((account) => recipeReadsInto(account, saved.bank, currency, booksCurrency))
  if (fitting.length === 1) return { kind: 'found', account: fitting[0]!.slug }
  return fitting.length === 0 ? { kind: 'none', bank: saved.bank, currency } : { kind: 'many', bank: saved.bank, currency, accounts: fitting.map((account) => account.slug) }
}

/** What a Company table recipe lacks beyond its draft: the bank of the account that takes its rows, or that account's currency. */
export type TableRecipeProblem = DraftProblem | { readonly kind: 'no-bank' } | { readonly kind: 'no-currency' }

/** Where a person fixes a problem of a Company table recipe: the bank and currency fields, or where the draft's own problem sits. */
export function placeOfTableProblem(problem: TableRecipeProblem): DraftPlace | 'bank' | 'currency' {
  if (problem.kind === 'no-bank') return 'bank'
  if (problem.kind === 'no-currency') return 'currency'
  return placeOfProblem(problem)
}

/** The recipe the Company file keeps for a draft, under the record id it has or gets, with its bank and currency, or everything it lacks. */
export function companyTableRecipeOf(
  id: RecordId,
  draft: TableRecipeDraft,
  bank: string,
  currency: CurrencyCode | null,
): { readonly saved: SavedRecipe } | { readonly problems: readonly TableRecipeProblem[] } {
  const own: TableRecipeProblem[] = [...(bank.trim() === '' ? [{ kind: 'no-bank' } as const] : []), ...(currency === null ? [{ kind: 'no-currency' } as const] : [])]
  const made = tableRecipeOf(keyOfRecordId(RECIPE_RECORDS, id), draft, TABLE_RECIPE_FIELDS)
  if ('problems' in made) return { problems: [...own, ...made.problems] }
  return own.length > 0 ? { problems: own } : { saved: { id, bank: bank.trim(), currency, recipe: made.recipe } }
}
