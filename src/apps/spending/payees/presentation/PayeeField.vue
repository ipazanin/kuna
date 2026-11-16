<script setup lang="ts">
import { computed, ref } from 'vue'
import UInputMenu from '@nuxt/ui/components/InputMenu.vue'

import { words } from './words'
import { isNewPayee, knownPayees, payeeChoices } from '../domain/knownPayees'
import { useSpendingBooks } from '../../workbook/application/spendingStore'

/**
 * The payee of an entry as typed, with the book's payees that match it. The first choice is the one Enter takes: the known payee
 * the text names in full, or else the text itself, which the list marks as a new payee. A long name wraps, so the list shows all
 * of what Enter takes.
 */
const payee = defineModel<string>({ required: true })

const store = useSpendingBooks()
const payees = computed(() => knownPayees(store.state.workbook?.transactions ?? []))
const items = computed(() => payeeChoices(payees.value, payee.value))
const fresh = computed(() => isNewPayee(payees.value, payee.value))
/** Whether the person has the list open, which closes when focus leaves so a new payee leaves no list behind. */
const listOpen = ref(false)
/** Whether the list has a choice to offer, which a known payee already picked in full and matching nothing else does not. */
const offers = computed(() => items.value.length > 0 && !(items.value.length === 1 && !fresh.value && items.value[0] === payee.value))
</script>

<template>
  <UInputMenu
    v-model="payee"
    mode="autocomplete"
    :items="items"
    ignore-filter
    trailing-icon=""
    :open="listOpen && offers"
    autocomplete="off"
    class="w-full"
    :ui="{ itemLabel: 'text-clip whitespace-normal break-words' }"
    data-testid="spending-entry-payee"
    @update:open="listOpen = $event"
    @focusout="listOpen = false"
  >
    <template #item-label="{ item, index }">
      <span v-if="index === 0 && fresh" data-testid="spending-entry-new-payee">{{ words.newPayee(String(item)) }}</span>
      <template v-else>{{ item }}</template>
    </template>
  </UInputMenu>
</template>
