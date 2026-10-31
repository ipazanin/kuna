<script setup lang="ts">
import UInputTags from '@nuxt/ui/components/InputTags.vue'

import { ibanListOf } from '../../workbook/domain/iban'
import { words } from './words'

/**
 * A list of IBANs, each a tag with its own remove button. A comma, Enter or leaving the field adds
 * what was typed, and a pasted list splits at its commas. Each IBAN is kept without its grouping
 * spaces, and once.
 */
defineProps<{
  modelValue: readonly string[]
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
    :placeholder="words.general.addIban"
    :ui="{ item: 'identifier', input: 'identifier min-w-28' }"
    @update:model-value="update"
  />
</template>

<style scoped>
/* The field draws its focus ring around the tags and the input together, so the input needs none of its own. */
:deep(input:focus-visible) {
  outline: none;
}
</style>
