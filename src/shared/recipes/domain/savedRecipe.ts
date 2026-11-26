import { currencyCodeOf } from '../../money/currencyCode'
import type { CurrencyCode } from '../../money/currencyCode'
import { labelWords, withIdField } from '../../storage/domain/recordCodec'
import type { RecordCodec } from '../../storage/domain/recordCodec'
import { filledFields } from '../../storage/domain/recordFields'
import { keyOfRecordId } from '../../storage/domain/recordId'
import type { RecordId } from '../../storage/domain/recordId'
import type { RecordKind } from '../../storage/domain/recordKind'
import { ownId, requiredChoice, requiredRead, requiredText, textOf } from '../../storage/domain/storedFields'
import type { StoredFields } from '../../storage/domain/storedFields'
import { fold } from '../../text/fold'
import { readRecipe } from './readRecipe'
import type { Recipe, RecipeFile } from './recipe'

/** A recipe an app's file keeps for a bank's statement files, which finds the account the rows go to by its bank and currency. */
export interface SavedRecipe {
  readonly id: RecordId
  /** The bank whose accounts take the rows, by the name its accounts give it. */
  readonly bank: string
  /** The currency of every row, for a file whose rows name none, or null when each row names its own. */
  readonly currency: CurrencyCode | null
  readonly recipe: Recipe
}

/** Whether two accounts, or an account and a recipe, name the same bank, ignoring case, accents and spacing. A blank and a missing bank are the same. */
export function sameBank(one: string | null, other: string | null): boolean {
  return fold(one ?? '') === fold(other ?? '')
}

const RECIPE_FORMATS = ['table', 'xml'] as const

/**
 * The codec of an app's saved recipes: each one's name, bank, currency where every row shares one, format, an XML file's root,
 * and its sections as JSON, which `readRecipe` checks.
 */
export function savedRecipeCodec(kind: RecordKind<SavedRecipe>): RecordCodec<SavedRecipe> {
  const make = (fields: StoredFields, id: RecordId | null): SavedRecipe => {
    const recipeId = ownId(id)
    const name = requiredText(fields, 'name')
    const bank = requiredText(fields, 'bank')
    const currency = textOf(fields.currency).trim() === '' ? null : requiredRead(fields, 'currency', currencyCodeOf)
    const file: RecipeFile = requiredChoice(fields, 'format', RECIPE_FORMATS) === 'xml' ? { format: 'xml', root: requiredText(fields, 'root') } : { format: 'table' }
    const recipe = requiredRead(fields, 'sections', (text) => readRecipe(keyOfRecordId(kind, recipeId), name, file, text))
    return { id: recipeId, bank, currency, recipe }
  }
  return withIdField(
    kind,
    (fields) => labelWords([textOf(fields.name)]),
    make,
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
}
