<script setup lang="ts">
import UInputTags from '@nuxt/ui/components/InputTags.vue'

import { ibanListOf } from '../text/iban'
import { words } from './words'

/**
 * A list of IBANs, each a tag with its own remove button. A comma, Enter or leaving the field adds
 * what was typed, and a pasted list splits at its commas. Each IBAN is kept without its grouping
 * spaces, and once.
 */
defineProps<{
  modelValue: readonly string[]
  /** A few words after an IBAN's tag, such as how many entries come from it, or none. */
  note?: (iban: string) => string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [ibans: string[]]
}>()

function update(tags: readonly unknown[]): void {
  emit('update:modelValue', [...new Set(tags.flatMap((tag) => ibanListOf(String(tag))))])
}
</script>

<template>
  <UInputTags
    :model-value="[...modelValue]"
    delimiter=","
    add-on-paste
    add-on-blur
    :placeholder="words.addIban"
    class="tags-field"
    :ui="{ item: 'identifier', input: 'identifier min-w-28 basis-28' }"
    @update:model-value="update"
  >
    <template #item-text="{ item }">
      {{ item }}<span v-if="note?.(String(item))" class="font-sans"> · {{ note(String(item)) }}</span>
    </template>
  </UInputTags>
</template>
