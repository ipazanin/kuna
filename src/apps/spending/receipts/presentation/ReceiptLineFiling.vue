<script setup lang="ts">
import { computed } from 'vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { words } from './words'
import { entryCategoryChoices } from '../../entries/presentation/categoryChoices'
import type { Category } from '../../workbook/domain/category'

/** The category and words of one receipt line in the entry dialog, which Save files it under. Its amount stays the receipt's. */
const filing = defineModel<{ category: string; note: string }>({ required: true })

const props = defineProps<{
  categories: readonly Category[]
  /** How the line reads, which names its fields for a screen reader. */
  title: string
}>()

const held = computed(() => props.categories.find((category) => category.id === filing.value.category)?.id ?? null)
const choices = computed(() => entryCategoryChoices(props.categories, 'out', held.value))
</script>

<template>
  <span class="grid w-full gap-1.5 sm:grid-cols-2" data-testid="spending-entry-line-filing">
    <USelectMenu v-model="filing.category" :items="choices" value-key="value" :aria-label="words.lineCategory(title)" size="sm" class="w-full" data-testid="spending-entry-line-category" />
    <UInput v-model="filing.note" :aria-label="words.lineNote(title)" :placeholder="words.lineNotePlaceholder" size="sm" class="w-full" data-testid="spending-entry-line-note" />
  </span>
</template>
