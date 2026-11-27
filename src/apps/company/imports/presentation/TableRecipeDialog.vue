<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { deleteRecipe, newRecipeId, saveRecipe } from '../application/recipeWrites'
import { companyTableRecipeOf, placeOfTableProblem, TABLE_RECIPE_FIELDS } from '../domain/tableRecipes'
import { accountBankNames } from '../../workbook/domain/accountBanks'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { SavedRecipe } from '../../../../shared/recipes/domain/savedRecipe'
import { draftOfRecipe } from '../../../../shared/recipes/domain/tableRecipeDraft'
import type { TableRecipeDraft } from '../../../../shared/recipes/domain/tableRecipeDraft'
import { NO_RECIPE_ERRORS, recipeErrorsOf } from '../../../../shared/recipes/presentation/recipeErrors'
import RecipeDialog from '../../../../shared/recipes/presentation/RecipeDialog.vue'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { words } from './words'

/**
 * An import recipe the Company file keeps, or a new one started from `start`, in the recipe editor, with the header row of the
 * file Import holds. Save keeps it in one write with one Undo. A recipe the books do not keep yet has no Delete.
 */
const props = defineProps<{
  recipe: SavedRecipe | null
  /** Whether the books keep `recipe`, so it can be changed and deleted. */
  kept: boolean
  /** The draft a new recipe starts from, with the bank and currency of the account it most likely is for. */
  start: { readonly draft: TableRecipeDraft; readonly bank: string; readonly currency: string }
  /** The header row of the file Import holds. */
  columns: readonly string[] | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [recipe: SavedRecipe]; deleted: [] }>()

const store = useWorkbook()
const writes = useRecordWrites(store)

const draft = ref<TableRecipeDraft>(props.start.draft)
const bank = ref('')
const currency = ref('')
const newId = ref(newRecipeId())

watch(open, (opening) => {
  if (!opening) return
  newId.value = newRecipeId()
  const held = props.recipe === null ? null : draftOfRecipe(props.recipe.recipe, TABLE_RECIPE_FIELDS)
  draft.value = held ?? props.start.draft
  bank.value = props.recipe?.bank ?? props.start.bank
  currency.value = props.recipe?.currency ?? props.start.currency
})

const banks = computed(() => accountBankNames([...(store.state.workbook?.accounts ?? []), ...(store.state.workbook?.recipes ?? [])]))
const made = computed(() => companyTableRecipeOf(props.kept && props.recipe !== null ? props.recipe.id : newId.value, draft.value, bank.value, currencyCodeOf(currency.value.trim().toUpperCase())))
const errors = computed(() =>
  'problems' in made.value ? recipeErrorsOf(made.value.problems.map((problem) => ({ place: placeOfTableProblem(problem), text: words.recipe.problems[problem.kind] }))) : NO_RECIPE_ERRORS,
)

async function save(): Promise<void> {
  if (!('saved' in made.value)) return
  const { saved } = made.value
  const before = props.kept ? props.recipe : null
  const written = await writes.write(words.recipe.saved, (unit) => saveRecipe(unit, before, saved), { key: 'save', failedTitle: words.recipe.notSaved })
  if (written) {
    open.value = false
    emit('saved', saved)
  }
}

async function remove(): Promise<void> {
  const held = props.recipe
  if (held === null || !props.kept) return
  if (await writes.write(words.recipe.deleted, (unit) => deleteRecipe(unit, held), { key: 'delete', failedTitle: words.recipe.notDeleted })) {
    open.value = false
    emit('deleted')
  }
}
</script>

<template>
  <RecipeDialog
    v-model:open="open"
    v-model:draft="draft"
    v-model:bank="bank"
    v-model:currency="currency"
    :title="kept ? words.recipe.changeTitle : words.recipe.addTitle"
    :description="words.recipe.description"
    :fields="TABLE_RECIPE_FIELDS"
    :field-labels="words.recipe.fields"
    :kind-labels="words.recipe.kinds"
    :columns="columns"
    :banks="banks"
    :errors="errors"
    :save-label="words.recipe.save"
    :cancel-label="words.recipe.cancel"
    :delete-label="kept ? words.recipe.delete : null"
    :saving="writes.saving('save')"
    :deleting="writes.saving('delete')"
    :changes-refused="writes.busy.value || writes.refused.value"
    :row-currencies="false"
    @save="save"
    @delete="remove"
  />
</template>
