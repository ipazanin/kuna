<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { words } from './words'
import { OPENING_PERIOD } from '../domain/payeePeriod'
import { payeeNamed, rowPayeeKey } from '../domain/payeeDirectory'
import { payeePageLink } from '../../overview/presentation/spendingLinks'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Transaction } from '../../workbook/domain/transaction'

/**
 * A link to the page of a saved entry's payee, named as the page names them. A new entry and a transfer's leg get none, and
 * neither does the page of the payee the dialog was opened on. The dialog shows it only while it holds no changes.
 */
const props = defineProps<{
  entry: Transaction | null
  /** The key of the payee whose page the dialog was opened on, whose own link it leaves out. */
  fromPayee?: string
}>()

const emit = defineEmits<{ opened: [] }>()

const { state } = useSpendingBooks()

const payee = computed(() => {
  const book = state.workbook
  const entry = props.entry
  if (book === null || entry === null || entry.pair !== null || entry.payee.trim() === '') return null
  const key = rowPayeeKey(book, entry)
  return key === props.fromPayee ? null : payeeNamed(book, key)
})
</script>

<template>
  <UButton
    v-if="payee !== null"
    :to="payeePageLink(payee.key, OPENING_PERIOD)"
    :label="words.page.open(payee.name)"
    trailing-icon="i-lucide-arrow-right"
    color="neutral"
    variant="link"
    size="sm"
    class="inline-target quiet-link px-0"
    data-testid="spending-entry-payee-page"
    @click="emit('opened')"
  />
</template>
