<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { plural } from '../../../../shared/text/translation'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { companyBooksOf } from '../../workbook/domain/readWorkbook'
import { moveProfilesToRecipes } from '../application/recipeWrites'
import { words } from './words'

/** Offers, while the settings hold import profiles, to move them to recipes in one write with one Undo. */
const store = useWorkbook()
const writes = useRecordWrites(store)

const count = computed(() => store.state.workbook?.settings.importProfiles.length ?? 0)

async function move(): Promise<void> {
  await writes.write(
    words.move.moved,
    (unit) => {
      const books = companyBooksOf(store.state)
      if (books !== null) moveProfilesToRecipes(unit, books)
    },
    { key: 'move-profiles', failedTitle: words.move.notMoved },
  )
}
</script>

<template>
  <UAlert v-if="count > 0" icon="i-lucide-info" color="info" variant="subtle" :title="words.move.title" :description="plural(words.move.body(count), count)" data-testid="profile-move">
    <template #actions>
      <UButton
        :label="words.move.move"
        icon="i-lucide-arrow-right-left"
        size="sm"
        :loading="writes.saving('move-profiles')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="profile-move-confirm"
        @click="move"
      />
    </template>
  </UAlert>
</template>
