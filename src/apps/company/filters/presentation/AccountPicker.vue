<script lang="ts">
export interface AccountOption {
  readonly value: string
  readonly label: string
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { words } from './words'

/** Account slugs from `accounts`. Empty means every account. */
const accounts = defineModel<readonly string[]>({ required: true })

const props = defineProps<{
  options: readonly AccountOption[]
}>()

const items = computed(() => props.options.map((account) => ({ ...account })))

const selected = computed({
  get: () => [...accounts.value],
  set: (chosen: string[]) => {
    accounts.value = chosen
  },
})
</script>

<template>
  <USelectMenu
    v-model="selected"
    :items="items"
    value-key="value"
    multiple
    :search-input="false"
    :placeholder="words.allAccounts"
    icon="i-lucide-landmark"
    size="sm"
    :aria-label="words.accounts"
    class="min-w-44"
  />
</template>
