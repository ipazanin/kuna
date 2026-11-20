<script setup lang="ts">
import { computed, ref } from 'vue'
import UInputMenu from '@nuxt/ui/components/InputMenu.vue'

import { words } from './words'
import { fold } from '../text/fold'

/** How many known banks the list offers at once. */
const CHOICES = 8

/**
 * A bank's name as typed, with the known banks that match it. The first choice is the one Enter takes: the known bank the text
 * names in full, spelt as it is known, or else the text itself, which the list marks as a new bank. A blank field names no bank.
 */
const props = defineProps<{
  /** The bank names to suggest, each once, in the order to offer them. */
  banks: readonly string[]
}>()
const bank = defineModel<string>({ required: true })

const typed = computed(() => fold(bank.value))
const known = computed(() => props.banks.find((name) => fold(name) === typed.value))
const fresh = computed(() => typed.value !== '' && known.value === undefined)
const items = computed(() => {
  if (typed.value === '') return [...props.banks].slice(0, CHOICES)
  const matching = props.banks.filter((name) => fold(name).includes(typed.value) && name !== known.value)
  return [known.value ?? bank.value.trim(), ...matching].slice(0, CHOICES)
})
/** Whether the person has the list open, which closes when focus leaves so a new bank leaves no list behind. */
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
    autocomplete="off"
    class="w-full"
    @update:open="listOpen = $event"
    @focusout="listOpen = false"
  >
    <template #item-label="{ item, index }">
      <span v-if="index === 0 && fresh">{{ words.bankName.fresh(String(item)) }}</span>
      <template v-else>{{ item }}</template>
    </template>
  </UInputMenu>
</template>
