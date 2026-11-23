<script setup lang="ts">
import { computed } from 'vue'
import UInput from '@nuxt/ui/components/Input.vue'

import OptionalSelect from '../../ui/OptionalSelect.vue'
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

const items = computed(() =>
  [...new Set([...(props.columns ?? []).filter((header) => header.trim() !== ''), ...(column.value === '' ? [] : [column.value])])].map((header) => ({ label: header, value: header })),
)
</script>

<template>
  <OptionalSelect v-if="columns !== null" v-model="column" :items="items" :none="optional ? words.noColumn : words.chooseColumn" :search="false" :clearable="optional" class="w-full" />
  <UInput v-else v-model="column" :placeholder="optional ? words.noColumn : words.typeColumn" autocomplete="off" class="w-full" />
</template>
