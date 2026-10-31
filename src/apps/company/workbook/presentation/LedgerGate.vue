<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import UEmpty from '@nuxt/ui/components/Empty.vue'

import { usePageSync } from '../../../../shared/sync/presentation/pageSync'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import { useExport } from '../../workbook-files/presentation/useExport'
import { useWorkbook } from '../application/workbookStore'
import { words } from './words'

/** Shows its slot once a workbook with transactions is on screen, and says what is missing until then. */
const { state } = useWorkbook()
const { sync } = usePageSync()
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
  <EmptyState
    v-else-if="gate === 'error'"
    icon="i-lucide-triangle-alert"
    :title="inBrowser ? words.gate.browserUnread : words.gate.driveUnread"
    :description="state.error ?? ''"
    :actions="inBrowser ? [] : [{ label: words.gate.tryAgain, color: 'neutral', variant: 'outline', onClick: () => sync() }]"
    tone="error"
  />
  <EmptyState
    v-else-if="gate === 'empty-ledger' && inBrowser"
    icon="i-lucide-file-spreadsheet"
    :title="words.gate.noTransactions"
    :description="words.gate.browserEmpty"
    :actions="[
      { label: words.gate.importStatement, icon: 'i-lucide-file-up', onClick: () => router.push({ path: '/company/transactions', query: { tab: 'import' } }) },
      { label: words.gate.exportToExcel, icon: 'i-lucide-download', color: 'neutral', variant: 'outline', onClick: exportNow },
      { label: words.gate.openSettings, icon: 'i-lucide-settings', color: 'neutral', variant: 'outline', onClick: () => router.push('/company/settings') },
    ]"
  />
  <EmptyState
    v-else-if="gate === 'empty-ledger'"
    icon="i-lucide-hard-drive"
    :title="words.gate.noTransactions"
    :description="words.gate.driveEmpty"
    :actions="[{ label: words.gate.importStatement, icon: 'i-lucide-file-up', onClick: () => router.push({ path: '/company/transactions', query: { tab: 'import' } }) }]"
  />
  <UEmpty v-else-if="gate === 'syncing'" icon="i-lucide-refresh-cw" :title="words.gate.reading" :description="words.gate.onItsWay" variant="naked" />
  <EmptyState
    v-else-if="gate === 'ready'"
    icon="i-lucide-refresh-cw"
    :title="words.gate.syncToRead(state.choice?.name ?? null)"
    :description="words.gate.noCopy"
    :actions="[{ label: words.gate.sync, icon: 'i-lucide-refresh-cw', onClick: () => sync() }]"
  />
</template>
