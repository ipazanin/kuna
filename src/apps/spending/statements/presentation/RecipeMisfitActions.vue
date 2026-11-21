<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { fittingRecipe, statementRecipesOf } from '../domain/recipeStatement'
import type { StatementRefusal } from '../domain/statementRows'
import StatementRecipeDialog from './StatementRecipeDialog.vue'
import { words } from './recipeWords'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { SavedRecipe } from '../../workbook/domain/savedRecipe'
import AskChatButton from '../../../../shared/ai/presentation/AskChatButton.vue'
import { likeliestHeaderRow } from '../../../../shared/recipes/domain/headerRow'

/**
 * What a person can do about a file no recipe reads, or one a saved recipe stopped reading: write a recipe or edit the saved
 * one in the editor, with the file's header row to pick columns from, or ask the chat, which gets the file and what Import said.
 */
const props = defineProps<{
  file: File
  cells: readonly (readonly string[])[]
  refusal: StatementRefusal
  /** What Import said of the file, which the chat hears too. */
  said: string
}>()

const store = useSpendingBooks()

/** The saved recipe whose columns head the file but which could not read a row of it, or null. */
const failing = computed((): SavedRecipe | null => {
  const book = store.state.workbook
  if (book === null || !['unreadable', 'no-kind', 'not-a-currency'].includes(props.refusal.kind)) return null
  const fitting = fittingRecipe(statementRecipesOf(book), props.cells)
  return book.recipes.find((saved) => saved.recipe.id === fitting?.recipe.id) ?? null
})
/** The saved recipes the file's columns may have outgrown, when no recipe's columns head the file. */
const outgrown = computed((): readonly SavedRecipe[] => {
  const book = store.state.workbook
  if (book === null) return []
  const { refusal } = props
  return refusal.kind === 'no-recipe' ? book.recipes.filter((saved) => refusal.misses.some((miss) => miss.recipe === saved.recipe.name)) : []
})
const nothingReads = computed(() => props.refusal.kind === 'no-recipe' || props.refusal.kind === 'no-column')
const shown = computed(() => failing.value !== null || nothingReads.value)

const header = computed(() => {
  const at = likeliestHeaderRow(props.cells)
  return at === null ? null : props.cells[at]!.filter((cell) => cell.trim() !== '')
})

const editing = ref<SavedRecipe | null>(null)
const dialogOpen = ref(false)

function edit(saved: SavedRecipe | null): void {
  editing.value = saved
  dialogOpen.value = true
}

const fixing = computed(() => failing.value ?? (outgrown.value.length === 1 ? outgrown.value[0]! : null))
const asking = ref(false)

async function ask(): Promise<void> {
  asking.value = true
  try {
    const { startChatWith } = await import('../../../../shared/ai/presentation/chatSession')
    const task = fixing.value === null ? words.import.writeTask(props.said) : words.import.fixTask(fixing.value.recipe.name, props.said)
    await startChatWith({ files: [props.file], task }, 'page')
  } finally {
    asking.value = false
  }
}
</script>

<template>
  <div v-if="shown" class="flex flex-wrap gap-2" data-testid="spending-import-recipe-actions">
    <UButton
      v-if="failing !== null"
      :label="words.import.edit(failing.recipe.name)"
      icon="i-lucide-pencil"
      color="neutral"
      variant="outline"
      size="sm"
      data-testid="spending-import-recipe-edit"
      @click="edit(failing)"
    />
    <template v-else>
      <UButton :label="words.import.write" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="spending-import-recipe-write" @click="edit(null)" />
      <UButton
        v-for="saved in outgrown"
        :key="saved.id"
        :label="words.import.edit(saved.recipe.name)"
        icon="i-lucide-pencil"
        color="neutral"
        variant="outline"
        size="sm"
        data-testid="spending-import-recipe-edit"
        @click="edit(saved)"
      />
    </template>
    <AskChatButton :text="fixing === null ? words.import.askWrite : words.import.askFix" :loading="asking" @ask="ask" />
    <StatementRecipeDialog v-model:open="dialogOpen" :recipe="editing" :columns="header" />
  </div>
</template>
