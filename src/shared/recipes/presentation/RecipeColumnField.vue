<script setup lang="ts">
import { computed } from 'vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { words } from './words'

/**
 * A column a recipe reads: a pick from the file's header row while a file is open, and the column typed as the header writes
 * it while none is. An optional one can be left out of the file, which leaves it blank.
 */
const props = withDefaults(
  defineProps<{
    /** The header row of the open file, or null with no file. */
    columns: readonly string[] | null
    optional?: boolean
  }>(),
  { optional: false },
)
const column = defineModel<string>({ required: true })

/** A select's value for "the file has no such column", since an item takes no blank value. Headers are trimmed, so none is a single space. */
const NO_COLUMN = ' '

const items = computed(() => {
  const picks = [...new Set([...(props.columns ?? []).filter((header) => header.trim() !== ''), ...(column.value === '' ? [] : [column.value])])].map((header) => ({ label: header, value: header }))
  return props.optional ? [{ label: words.noColumn, value: NO_COLUMN }, ...picks] : picks
})
const picked = computed({
  get: () => (column.value === '' && props.optional ? NO_COLUMN : column.value),
  set: (value: string) => {
    column.value = value === NO_COLUMN ? '' : value
  },
})
</script>

<template>
  <USelect v-if="columns !== null" v-model="picked" :items="items" :placeholder="words.chooseColumn" class="w-full" />
  <UInput v-else v-model="column" :placeholder="optional ? words.noColumn : words.typeColumn" autocomplete="off" class="w-full" />
</template>
