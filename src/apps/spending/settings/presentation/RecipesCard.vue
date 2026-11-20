<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { words } from './words'
import { deleteRecipe } from '../../statements/application/recipeWrites'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { SavedRecipe } from '../../workbook/domain/savedRecipe'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'

/** The recipes the Spending file keeps for banks' statement files, each by its name, bank and format, with Delete. It shows only while the file keeps a recipe. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

const recipes = computed(() => store.state.workbook?.recipes ?? [])

async function remove(saved: SavedRecipe): Promise<void> {
  await writes.write(words.recipes.deleted, (unit) => deleteRecipe(unit, saved), { key: `delete-${saved.id}`, failedTitle: words.recipes.notDeleted })
}
</script>

<template>
  <AppCard v-if="recipes.length > 0" :title="words.recipes.title" :subtitle="words.recipes.subtitle" data-testid="spending-recipes">
    <ul class="flex flex-col divide-y divide-default pt-1 pb-2">
      <ListRow
        v-for="saved in recipes"
        :key="saved.id"
        :title="saved.recipe.name"
        :caption="words.recipes.caption(saved.bank, words.recipes.formats[saved.recipe.file.format])"
        data-testid="spending-recipe"
      >
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
    </ul>
  </AppCard>
</template>
