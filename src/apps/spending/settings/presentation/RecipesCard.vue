<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { words } from './words'
import { deleteRecipe } from '../../statements/application/recipeWrites'
import { STATEMENT_RECIPE_FIELDS } from '../../statements/domain/statementRecipeDraft'
import StatementRecipeDialog from '../../statements/presentation/StatementRecipeDialog.vue'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { SavedRecipe } from '../../workbook/domain/savedRecipe'
import { draftOfRecipe } from '../../../../shared/recipes/domain/tableRecipeDraft'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'

/**
 * The recipes the Spending file keeps for banks' statement files, each by its name, bank and format. A row opens the recipe
 * in its editor, and Add recipe a new one, with the columns typed, also on a file that keeps none yet. A recipe the editor
 * cannot hold keeps Delete on its row.
 */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

const recipes = computed(() => (store.state.workbook?.recipes ?? []).map((saved) => ({ saved, editable: draftOfRecipe(saved.recipe, STATEMENT_RECIPE_FIELDS) !== null })))

const editing = ref<SavedRecipe | null>(null)
const dialogOpen = ref(false)

function edit(saved: SavedRecipe | null): void {
  editing.value = saved
  dialogOpen.value = true
}

async function remove(saved: SavedRecipe): Promise<void> {
  await writes.write(words.recipes.deleted, (unit) => deleteRecipe(unit, saved), { key: `delete-${saved.id}`, failedTitle: words.recipes.notDeleted })
}
</script>

<template>
  <AppCard :title="words.recipes.title" :subtitle="words.recipes.subtitle" data-testid="spending-recipes">
    <ul v-if="recipes.length > 0" class="flex flex-col divide-y divide-default pt-1">
      <template v-for="{ saved, editable } in recipes" :key="saved.id">
        <li v-if="editable">
          <ListRow
            as="button"
            :title="saved.recipe.name"
            :caption="words.recipes.caption(saved.bank, words.recipes.formats[saved.recipe.file.format])"
            data-testid="spending-recipe"
            @click="edit(saved)"
          />
        </li>
        <ListRow v-else :title="saved.recipe.name" :caption="words.recipes.caption(saved.bank, words.recipes.formats[saved.recipe.file.format])" data-testid="spending-recipe">
          <UButton
            :label="words.recipes.delete"
            :aria-label="words.recipes.deleteNamed(saved.recipe.name)"
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="sm"
            class="self-start"
            :loading="writes.saving(`delete-${saved.id}`)"
            :disabled="writes.refused.value"
            data-testid="spending-recipe-delete"
            @click="remove(saved)"
          />
        </ListRow>
      </template>
    </ul>
    <div class="px-4 pt-2 pb-4 sm:px-5">
      <UButton :label="words.recipes.add" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="spending-recipe-add" @click="edit(null)" />
    </div>
    <StatementRecipeDialog v-model:open="dialogOpen" :recipe="editing" :columns="null" />
  </AppCard>
</template>
