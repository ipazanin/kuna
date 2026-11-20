import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { SavedRecipe } from '../../workbook/domain/savedRecipe'
import { RECIPE_RECORDS } from '../../workbook/domain/spendingKinds'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
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
