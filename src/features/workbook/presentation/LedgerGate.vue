<script setup lang="ts">
import { computed } from 'vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'

import { useWorkbook } from '../application/workbookStore'
import { syncStateOf } from './syncState'

/** Shows its slot once a workbook with transactions is on screen, and says what is missing until then. */
const { state, sync } = useWorkbook()

const gate = computed(() => {
  if (state.workbook !== null && state.workbook.transactions.length > 0) {
    return 'open'
  }
  if (state.status === 'opening') {
    return 'opening'
  }
  if (state.workbook !== null) {
    return 'empty-ledger'
  }
  return syncStateOf(state)
})
</script>

<template>
  <slot v-if="gate === 'open'" />
  <UEmpty
    v-else-if="gate === 'first-run'"
    icon="i-lucide-file-spreadsheet"
    title="Choose the Google Sheet that holds your ledger"
    description="Ledgerboard reads its ledger, categories and accounts tabs and keeps a copy in this browser. Nothing is written back."
    :actions="[{ label: 'Choose your Sheet', icon: 'i-lucide-file-spreadsheet', onClick: () => sync() }]"
    variant="outline"
    class="rounded-card border-dashed bg-raised/40"
  />
  <UEmpty
    v-else-if="gate === 'error'"
    icon="i-lucide-triangle-alert"
    title="The Sheet could not be read"
    :description="state.error ?? ''"
    :actions="[{ label: 'Try again', color: 'neutral', variant: 'outline', onClick: () => sync() }]"
    variant="outline"
    class="rounded-card border-error/40 bg-raised"
    :ui="{ avatar: 'text-error' }"
  />
  <UEmpty
    v-else-if="gate === 'empty-ledger'"
    icon="i-lucide-sheet"
    title="The ledger tab has no transactions yet"
    description="Once the morning import adds rows, sync again."
    variant="outline"
    class="rounded-card border-dashed bg-raised/40"
  />
  <UEmpty
    v-else-if="gate === 'syncing'"
    icon="i-lucide-refresh-cw"
    title="Reading the Sheet"
    description="The first copy is on its way."
    variant="naked"
  />
  <UEmpty
    v-else-if="gate === 'ready'"
    icon="i-lucide-refresh-cw"
    :title="`Sync to read ${state.sheet?.name ?? 'the Sheet'}`"
    description="This browser has no copy of it yet."
    :actions="[{ label: 'Sync', icon: 'i-lucide-refresh-cw', onClick: () => sync() }]"
    variant="outline"
    class="rounded-card border-dashed bg-raised/40"
  />
</template>
