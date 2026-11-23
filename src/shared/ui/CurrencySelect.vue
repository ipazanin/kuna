<script setup lang="ts">
import { computed } from 'vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { CURRENCY_CODES, EURO } from '../money/currencyCode'
import OptionalSelect from './OptionalSelect.vue'

/** A currency picked by its code from every code Kuna knows, with the ones a screen names first and a search over the rest. */
const currency = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    /** The search field's placeholder, such as "Find a currency". */
    search: string
    /** Codes listed before the rest, such as the ones a file already names. */
    first?: readonly string[]
    /** The words for no currency, for a field that may stay empty, which a cross in the field clears. */
    none?: string
    /** The label of a real choice stored as a blank currency, such as reading it from a column, which offers no cross. */
    blankChoice?: string
  }>(),
  { first: () => [EURO], none: '', blankChoice: '' },
)

/** Stands in for the blank choice, since the list allows no item with a blank value. */
const BLANK_CHOICE = '-'

const codes = computed(() => {
  const first = new Set(props.first)
  return [...first, ...CURRENCY_CODES.filter((code) => !first.has(code))].map((code) => ({ label: code, value: code }))
})
const items = computed(() => (props.blankChoice === '' ? codes.value : [{ label: props.blankChoice, value: BLANK_CHOICE }, ...codes.value]))

const picked = computed({
  get: () => (currency.value === '' && props.blankChoice !== '' ? BLANK_CHOICE : currency.value),
  set: (code: string) => {
    currency.value = code === BLANK_CHOICE ? '' : code
  },
})
</script>

<template>
  <OptionalSelect v-if="none !== ''" v-model="currency" :items="codes" :none="none" :search="search" />
  <USelectMenu v-else v-model="picked" :items="items" value-key="value" :search-input="{ placeholder: search }" />
</template>
