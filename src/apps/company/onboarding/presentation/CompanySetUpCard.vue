<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import GettingSetUpCard from '../../../../shared/ui/GettingSetUpCard.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useCategoriesLookRight } from './useCategoriesLookRight'
import { CATEGORIES_LINE, gettingSetUp } from './gettingSetUp'
import { words } from './words'

/** What new books still lack, on Overview above everything else. The categories line can be settled where it stands, since agreeing with them changes nothing else that would clear it. */
const { state } = useWorkbook()
const { lookRight, agree } = useCategoriesLookRight()

const lines = computed(() => (state.workbook === null ? [] : gettingSetUp(state.workbook, lookRight.value)))
</script>

<template>
  <GettingSetUpCard :lines="lines">
    <template #action="{ line }">
      <UButton
        v-if="line.key === CATEGORIES_LINE"
        :label="words.setUp.categoriesLookRight"
        color="neutral"
        variant="outline"
        size="sm"
        class="shrink-0"
        data-testid="set-up-categories-look-right"
        @click="agree"
      />
    </template>
  </GettingSetUpCard>
</template>
