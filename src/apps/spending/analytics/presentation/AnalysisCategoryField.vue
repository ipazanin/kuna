<script setup lang="ts">
import { computed } from 'vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { useAnalysisCategory } from './useAnalysisCategory'
import { words } from './words'
import { filterCategoryChoices } from '../../entries/presentation/categoryChoices'
import type { Category } from '../../workbook/domain/category'

/** Picks the category of Over time and Year against year, every group, child and fixed category, or all spending. */
const props = defineProps<{
  categories: readonly Category[]
}>()

const picked = useAnalysisCategory(() => props.categories)

/** The stand-in value of All spending, since a select's item takes no blank value. */
const ALL = '-'
const items = computed(() => [[{ label: words.analysis.overTime.allSpending, value: ALL }], ...filterCategoryChoices(props.categories)])
const value = computed({
  get: (): string => picked.value?.id ?? ALL,
  set: (id: string) => (picked.value = props.categories.find((category) => category.id === id) ?? null),
})
</script>

<template>
  <USelectMenu
    v-model="value"
    :items="items"
    value-key="value"
    :filter-fields="['label', 'description']"
    :aria-label="words.analysis.overTime.category"
    class="w-full sm:w-64"
    data-testid="spending-analysis-category"
  />
</template>
