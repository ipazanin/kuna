<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { deleteRecipe, newRecipeId, saveRecipe } from '../application/recipeWrites'
import { placeOfStatementProblem, STATEMENT_RECIPE_FIELDS, statementRecipeOf } from '../domain/statementRecipeDraft'
import { words as recipeWords } from './recipeWords'
import { bankNamesOf } from '../../accounts/domain/bankNames'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { SavedRecipe } from '../../../../shared/recipes/domain/savedRecipe'
import { currencyCodeOf, EURO } from '../../../../shared/money/currencyCode'
import { draftOfRecipe } from '../../../../shared/recipes/domain/tableRecipeDraft'
import type { TableRecipeDraft } from '../../../../shared/recipes/domain/tableRecipeDraft'
import { NO_RECIPE_ERRORS, recipeErrorsOf } from '../../../../shared/recipes/presentation/recipeErrors'
import RecipeDialog from '../../../../shared/recipes/presentation/RecipeDialog.vue'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'

/**
 * A statement recipe the Spending file keeps, or a new one, in the recipe editor. Import opens it with the header row of the
 * file it could not read, and Settings with none, so columns are typed. Save keeps it in one write with one Undo.
 */
const props = defineProps<{
  recipe: SavedRecipe | null
  /** The header row of the file Import holds, or null to type the columns. */
  columns: readonly string[] | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const NEW_DRAFT: TableRecipeDraft = { name: '', date: { column: '', format: 'dd.MM.yyyy' }, amount: { column: '' }, mark: 'comma', columns: {}, kinds: [{ kind: 'payment', test: null }] }

const draft = ref<TableRecipeDraft>(NEW_DRAFT)
const bank = ref('')
const currency = ref<string>(EURO)
const newId = ref(newRecipeId())

watch(open, (opening) => {
  if (!opening) return
  newId.value = newRecipeId()
  draft.value = props.recipe === null ? NEW_DRAFT : (draftOfRecipe(props.recipe.recipe, STATEMENT_RECIPE_FIELDS) ?? NEW_DRAFT)
  bank.value = props.recipe?.bank ?? ''
  currency.value = props.recipe === null ? EURO : (props.recipe.currency ?? '')
})

const banks = computed(() => bankNamesOf([...(store.state.workbook?.accounts ?? []), ...(store.state.workbook?.recipes ?? [])]))
const made = computed(() => statementRecipeOf(props.recipe?.id ?? newId.value, draft.value, bank.value, currencyCodeOf(currency.value)))
const errors = computed(() =>
  'problems' in made.value ? recipeErrorsOf(made.value.problems.map((problem) => ({ place: placeOfStatementProblem(problem), text: recipeWords.problems[problem.kind] }))) : NO_RECIPE_ERRORS,
)

async function save(): Promise<void> {
  if (!('saved' in made.value)) return
  const { saved } = made.value
  const written = await writes.write(recipeWords.dialog.saved, (unit) => saveRecipe(unit, props.recipe, saved), { key: 'save', failedTitle: recipeWords.dialog.notSaved })
  if (written) {
    open.value = false
    emit('saved')
  }
}

async function remove(): Promise<void> {
  const held = props.recipe
  if (held === null) return
  if (await writes.write(recipeWords.dialog.deleted, (unit) => deleteRecipe(unit, held), { key: 'delete', failedTitle: recipeWords.dialog.notDeleted })) open.value = false
}
</script>

<template>
  <RecipeDialog
    v-model:open="open"
    v-model:draft="draft"
    v-model:bank="bank"
    v-model:currency="currency"
    :title="recipe === null ? recipeWords.dialog.addTitle : recipeWords.dialog.changeTitle"
    :description="recipeWords.dialog.description"
    :fields="STATEMENT_RECIPE_FIELDS"
    :field-labels="recipeWords.fields"
    :kind-labels="recipeWords.kinds"
    :columns="columns"
    :banks="banks"
    :errors="errors"
    :save-label="recipeWords.dialog.save"
    :cancel-label="recipeWords.dialog.cancel"
    :delete-label="recipe === null ? null : recipeWords.dialog.delete"
    :saving="writes.saving('save')"
    :deleting="writes.saving('delete')"
    :changes-refused="writes.busy.value || writes.refused.value"
    @save="save"
    @delete="remove"
  />
</template>
