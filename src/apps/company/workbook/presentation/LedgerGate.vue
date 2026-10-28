<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import UEmpty from '@nuxt/ui/components/Empty.vue'

import { useExport } from '../../workbook-files/presentation/useExport'
import { useSync } from '../../sync/presentation/useSync'
import { useWorkbook } from '../application/workbookStore'

/** Shows its slot once a workbook with transactions is on screen, and says what is missing until then. */
const { state } = useWorkbook()
const { sync } = useSync()
const router = useRouter()
const { exportNow } = useExport()

const inBrowser = computed(() => state.choice?.source === 'browser')

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
  return state.status === 'error' || state.status === 'syncing' ? state.status : 'ready'
})
</script>

<template>
  <slot v-if="gate === 'open'" />
  <UEmpty
    v-else-if="gate === 'error'"
    icon="i-lucide-triangle-alert"
    :title="inBrowser ? 'The workbook in this browser could not be read' : 'The file on Drive could not be read'"
    :description="state.error ?? ''"
    :actions="inBrowser ? [] : [{ label: 'Try again', color: 'neutral', variant: 'outline', onClick: () => sync() }]"
    variant="outline"
    class="rounded-card border-error/40 bg-raised"
    :ui="{ avatar: 'text-error' }"
  />
  <UEmpty
    v-else-if="gate === 'empty-ledger' && inBrowser"
    icon="i-lucide-file-spreadsheet"
    title="The ledger has no transactions yet"
    description="Import a bank statement, or export the workbook, add your bank rows to its ledger tab in Excel and import the file again. Categories and settings can be set up here first."
    :actions="[
      { label: 'Import a statement', icon: 'i-lucide-file-up', onClick: () => router.push({ path: '/company/transactions', query: { tab: 'import' } }) },
      { label: 'Export to Excel', icon: 'i-lucide-download', color: 'neutral', variant: 'outline', onClick: exportNow },
      { label: 'Open Settings', icon: 'i-lucide-settings', color: 'neutral', variant: 'outline', onClick: () => router.push('/settings') },
    ]"
    variant="outline"
    class="rounded-card border-dashed bg-raised/40"
  />
  <UEmpty
    v-else-if="gate === 'empty-ledger'"
    icon="i-lucide-hard-drive"
    title="The ledger has no transactions yet"
    description="Import a bank statement, or sync once the statements folder holds one."
    :actions="[{ label: 'Import a statement', icon: 'i-lucide-file-up', onClick: () => router.push({ path: '/company/transactions', query: { tab: 'import' } }) }]"
    variant="outline"
    class="rounded-card border-dashed bg-raised/40"
  />
  <UEmpty
    v-else-if="gate === 'syncing'"
    icon="i-lucide-refresh-cw"
    title="Reading the file"
    description="The first copy is on its way."
    variant="naked"
  />
  <UEmpty
    v-else-if="gate === 'ready'"
    icon="i-lucide-refresh-cw"
    :title="`Sync to read ${state.choice?.name ?? 'the file'}`"
    description="This browser has no copy of it yet."
    :actions="[{ label: 'Sync', icon: 'i-lucide-refresh-cw', onClick: () => sync() }]"
    variant="outline"
    class="rounded-card border-dashed bg-raised/40"
  />
</template>
