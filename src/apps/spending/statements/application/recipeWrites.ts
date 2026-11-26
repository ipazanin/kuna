import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { SavedRecipe } from '../../../../shared/recipes/domain/savedRecipe'
import { RECIPE_RECORDS } from '../../workbook/domain/spendingKinds'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A saved recipe reads as `readRecipe` says. Nothing else names one, so deleting it leaves its bank on any account that has it. */
export const RECIPE_WRITES: WriteRules<SavedRecipe> = {
  kind: RECIPE_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(RECIPE_RECORDS, read, records).readings.recipes,
  refusals: (_change, fresh, after) => dependentRefusals(['recipes'], fresh, after),
}

export function deleteRecipe(unit: UnitOfWork, recipe: SavedRecipe): void {
  unit.of(RECIPE_WRITES).remove(recipe)
}

/** The record id a recipe the file does not keep yet gets. */
export function newRecipeId(): RecordId {
  return recordIdOf(RECIPE_RECORDS, newRecordId())
}

/** Keeps a recipe, over the one it replaces when it is changed, so Import reads the next file with it. */
export function saveRecipe(unit: UnitOfWork, before: SavedRecipe | null, after: SavedRecipe): void {
  if (before === null) unit.of(RECIPE_WRITES).add(after)
  else unit.of(RECIPE_WRITES).change(before, after)
}
