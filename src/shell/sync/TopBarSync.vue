<script setup lang="ts">
import { computed } from 'vue'

import { exportReminderDue } from '../../shared/storage/domain/exportReminder'
import SyncStatus from '../../shared/sync/presentation/SyncStatus.vue'
import { usePageSync } from '../../shared/sync/presentation/pageSync'
import { listInWords } from '../../shared/text/listInWords'

/**
 * The top bar's control: the sync for the files on Drive, with a dot while a file kept in this
 * browser is due for an export, or the export of each file kept in this browser while none is on Drive.
 */
withDefaults(
  defineProps<{
    /** The narrow top-bar form. */
    compact?: boolean
  }>(),
  { compact: false },
)

const sync = usePageSync()

const onDrive = computed(() => sync.groups.some((group) => group.store.state.choice?.source === 'drive'))
const inBrowser = computed(() => sync.groups.filter((group) => group.store.state.choice?.source === 'browser'))
const exportReminder = computed(() => {
  const due = inBrowser.value.filter((group) => exportReminderDue(group.store.state.snapshot?.meta.unexportedSince ?? null, new Date()))
  return due.length === 0 ? null : `The ${listInWords(due.map((group) => group.name))} books in this browser hold changes in no exported file.`
})

/** Finds the books of the first app with no file chosen. */
function find(): void {
  void sync.groups.find((group) => group.store.state.choice === null)?.findDriveFile()
}
</script>

<template>
  <div v-if="!onDrive && inBrowser.length > 0" class="flex" :class="compact ? 'items-center justify-end gap-2' : 'flex-col gap-3'">
    <component :is="group.exportControl" v-for="group in inBrowser" :key="group.app" :compact="compact" />
  </div>
  <SyncStatus
    v-else
    :control="sync.control.value"
    :run="sync.run.value"
    :compact="compact"
    :export-reminder="exportReminder"
    @sync="sync.sync"
    @allow="sync.allowAccess"
    @find="find"
  />
</template>
