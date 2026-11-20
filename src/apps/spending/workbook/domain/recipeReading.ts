import type { SavedRecipe } from './savedRecipe'
import { RECIPE_RECORDS } from './spendingKinds'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import { readRecipe } from '../../../../shared/recipes/domain/readRecipe'
import type { RecipeFile } from '../../../../shared/recipes/domain/recipe'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, requiredChoice, requiredRead, requiredText, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

const RECIPE_FORMATS = ['table', 'xml'] as const

/** A saved recipe from its fields: its name, bank, currency where every row shares one, format, an XML file's root, and its sections as JSON, which `readRecipe` checks. */
export function savedRecipeOf(fields: StoredFields, id: RecordId | null): SavedRecipe {
  const recipeId = ownId(id)
  const name = requiredText(fields, 'name')
  const bank = requiredText(fields, 'bank')
  const currency = textOf(fields.currency).trim() === '' ? null : requiredRead(fields, 'currency', currencyCodeOf)
  const file: RecipeFile = requiredChoice(fields, 'format', RECIPE_FORMATS) === 'xml' ? { format: 'xml', root: requiredText(fields, 'root') } : { format: 'table' }
  const recipe = requiredRead(fields, 'sections', (text) => readRecipe(keyOfRecordId(RECIPE_RECORDS, recipeId), name, file, text))
  return { id: recipeId, bank, currency, recipe }
}

export const RECIPE_CODEC: RecordCodec<SavedRecipe> = withIdField(
  RECIPE_RECORDS,
  (fields) => labelWords([textOf(fields.name)]),
  savedRecipeOf,
  (saved) =>
    filledFields({
      name: saved.recipe.name,
      bank: saved.bank,
      currency: saved.currency,
      format: saved.recipe.file.format,
      root: saved.recipe.file.format === 'xml' ? saved.recipe.file.root : null,
      sections: JSON.stringify(saved.recipe.sections),
    }),
)
