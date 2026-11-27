<script setup lang="ts">
import { computed, ref } from 'vue'
import UInputMenu from '@nuxt/ui/components/InputMenu.vue'

import { words } from './words'
import { fold } from '../text/fold'
import { bankOfIban } from '../text/ibanBank'

/** How many known banks the list offers at once. */
const CHOICES = 8

/**
 * A bank's name as typed, with the known banks that match it and the bank the account's IBAN names, which leads the list. The first
 * choice is the one Enter takes: the known bank the text names in full, spelt as it is known, or else the text itself, which the list
 * marks as a new bank. A blank field names no bank.
 */
const props = withDefaults(
  defineProps<{
    /** The bank names to suggest, each once, in the order to offer them. */
    banks: readonly string[]
    /** The account's IBAN, whose bank code the list offers first when it names a Croatian bank. */
    iban?: string
  }>(),
  { iban: '' },
)
const bank = defineModel<string>({ required: true })

const ibanBank = computed(() => bankOfIban(props.iban))
/** The banks to offer, the IBAN's bank first as the book spells it, or as Kuna knows it when no account names it yet. */
const offered = computed(() => {
  const named = ibanBank.value
  if (named === null) return props.banks
  const spelt = props.banks.find((name) => fold(name) === fold(named)) ?? named
  return [spelt, ...props.banks.filter((name) => name !== spelt)]
})

const typed = computed(() => fold(bank.value))
const known = computed(() => offered.value.find((name) => fold(name) === typed.value))
const fresh = computed(() => typed.value !== '' && known.value === undefined)
const items = computed(() => {
  if (typed.value === '') return offered.value.slice(0, CHOICES)
  const matching = offered.value.filter((name) => fold(name).includes(typed.value) && name !== known.value)
  return [known.value ?? bank.value.trim(), ...matching].slice(0, CHOICES)
})
/** Whether the person has the list open, which closes when focus leaves so a new bank leaves no list behind. It opens on focus when the IBAN names a bank, so the suggestion shows before anything is typed. */
const listOpen = ref(false)
/** Whether the list has a choice to offer, which a known bank already picked in full and matching nothing else does not. */
const offers = computed(() => items.value.length > 0 && !(items.value.length === 1 && !fresh.value && items.value[0] === bank.value))
</script>

<template>
  <UInputMenu
    v-model="bank"
    mode="autocomplete"
    :items="items"
    ignore-filter
    trailing-icon=""
    :placeholder="words.bankName.hint"
    :open="listOpen && offers"
    :open-on-focus="ibanBank !== null"
    autocomplete="off"
    class="w-full"
    @update:open="listOpen = $event"
    @focusout="listOpen = false"
  >
    <template #item-label="{ item, index }">
      <span v-if="index === 0 && fresh">{{ words.bankName.fresh(String(item)) }}</span>
      <template v-else>
        {{ item }}
        <span v-if="ibanBank !== null && fold(String(item)) === fold(ibanBank)" class="type-caption ms-2">{{ words.bankName.fromIban }}</span>
      </template>
    </template>
  </UInputMenu>
</template>
