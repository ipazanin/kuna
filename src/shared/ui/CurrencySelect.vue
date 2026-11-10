<script setup lang="ts">
import { computed } from 'vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { CURRENCY_CODES, EURO } from '../money/currencyCode'

/** A currency picked by its code from every code Kuna knows, with the ones a screen names first and a search over the rest. */
const currency = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    /** The search field's placeholder, such as "Find a currency". */
    search: string
    /** Codes listed before the rest, such as the ones a file already names. */
    first?: readonly string[]
    /** The label of a choice of no currency, for a field that may stay empty. */
    none?: string
  }>(),
  { first: () => [EURO], none: '' },
)

/** Stands in for no currency, since the list allows no item with a blank value. */
const NO_CURRENCY = '-'

const items = computed(() => {
  const first = new Set(props.first)
  const codes = [...first, ...CURRENCY_CODES.filter((code) => !first.has(code))].map((code) => ({ label: code, value: code }))
  return props.none === '' ? codes : [{ label: props.none, value: NO_CURRENCY }, ...codes]
})

const picked = computed({
  get: () => (currency.value === '' && props.none !== '' ? NO_CURRENCY : currency.value),
  set: (code: string) => {
    currency.value = code === NO_CURRENCY ? '' : code
  },
})
</script>

<template>
  <USelectMenu v-model="picked" :items="items" value-key="value" :search-input="{ placeholder: search }" />
</template>
