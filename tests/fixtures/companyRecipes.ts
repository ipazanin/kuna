import { companyTableRecipeOf } from '../../src/apps/company/imports/domain/tableRecipes'
import type { Workbook } from '../../src/apps/company/workbook/domain/workbook'
import { RECIPE_RECORDS } from '../../src/apps/company/workbook/domain/coreKinds'
import { EURO } from '../../src/shared/money/currencyCode'
import type { SavedRecipe } from '../../src/shared/recipes/domain/savedRecipe'
import type { TableRecipeDraft } from '../../src/shared/recipes/domain/tableRecipeDraft'
import { recordIdOf } from '../../src/shared/storage/domain/recordId'

/** A Company table recipe of a draft, for the bank given, in euros. Throws for a draft the editor would not save. */
export function tableRecipe(draft: TableRecipeDraft, bank: string): SavedRecipe {
  const made = companyTableRecipeOf(recordIdOf(RECIPE_RECORDS, draft.name), draft, bank, EURO)
  if ('problems' in made) throw new Error(`the draft cannot be a recipe: ${JSON.stringify(made.problems)}`)
  return made.saved
}

/** The books with the account given at the bank given, so a recipe of that bank finds it. */
export function withAccountBank<Books extends Pick<Workbook, 'accounts'>>(workbook: Books, account: string, bank: string): Books {
  return { ...workbook, accounts: workbook.accounts.map((candidate) => (candidate.slug === account ? { ...candidate, bank } : candidate)) }
}
