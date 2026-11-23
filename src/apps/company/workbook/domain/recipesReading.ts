import { savedRecipeCodec } from '../../../../shared/recipes/domain/savedRecipe'
import type { SavedRecipe } from '../../../../shared/recipes/domain/savedRecipe'
import { problemOf } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { RECIPE_RECORDS } from './coreKinds'

export const RECIPE_CODEC = savedRecipeCodec(RECIPE_RECORDS)

export function readRecipes(read: RecordsRead<SavedRecipe>): Reading<SavedRecipe> {
  return { facts: read.records.map((stored) => stored.record), problems: read.refused.map((refused) => problemOf(refused, refused.reason)) }
}
