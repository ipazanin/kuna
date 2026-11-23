import type { SavedRecipe } from '../../../../shared/recipes/domain/savedRecipe'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'
import { removeSettings } from '../../settings/application/settingWrites'
import { ACCOUNT_WRITES } from '../../settings/application/namedRecordWrites'
import { RECIPE_RECORDS } from '../../workbook/domain/coreKinds'
import type { CompanyBooks } from '../../workbook/domain/readWorkbook'
import { readRecipes } from '../../workbook/domain/recipesReading'
import { profileKey } from '../domain/importProfile'
import { profileMove } from '../domain/profileRecipe'

/** A saved recipe reads as `readRecipe` says. Nothing else names one, so deleting it leaves its bank on any account that has it. */
export const RECIPE_WRITES: WriteRules<SavedRecipe> = {
  kind: RECIPE_RECORDS,
  reads: [],
  undoable: true,
  read: (read) => readRecipes(read),
  refusals: () => [],
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

export function deleteRecipe(unit: UnitOfWork, recipe: SavedRecipe): void {
  unit.of(RECIPE_WRITES).remove(recipe)
}

/**
 * Moves the books' import profiles to recipes in one write: a recipe for each profile, the bank a profile gave each account onto
 * the account, and the profile rows off the settings, so one Undo puts all of it back.
 */
export function moveProfilesToRecipes(unit: UnitOfWork, books: CompanyBooks): void {
  const { records, workbook } = books
  const stored = recordsOf(records.accounts)
  const move = profileMove(workbook.settings.importProfiles, workbook.accounts, new Map(stored.map((account) => [account.slug, account.bank])), workbook.settings.currency)
  for (const recipe of move.recipes) unit.of(RECIPE_WRITES).add(recipe)
  for (const { account, bank } of move.banks) {
    const before = stored.find((candidate) => candidate.slug === account)
    if (before !== undefined) unit.of(ACCOUNT_WRITES).change(before, { ...before, bank })
  }
  removeSettings(
    unit,
    records.settings,
    workbook.settings.importProfiles.map((profile) => profileKey(profile.name)),
  )
}
