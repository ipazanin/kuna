<script setup lang="ts">
import { computed } from 'vue'

import { exportReminderDue } from '../../shared/storage/domain/exportReminder'
import SyncStatus from '../../shared/sync/presentation/SyncStatus.vue'
import { usePageSync } from '../../shared/sync/presentation/pageSync'
import { listInWords } from '../../shared/text/listInWords'
import { plural } from '../../shared/text/translation'
import { words } from '../ui/words'

/**
 * The top bar's control: the sync for the files on Drive, with a dot while a file kept in this
 * browser is due for an export, or the export of each file kept in this browser while none is on Drive.
 * Nothing shows while no app has a file chosen.
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
  return due.length === 0 ? null : plural(words.unexported(due.length, listInWords(due.map((group) => group.name))), due.length)
})
</script>

<template>
  <div v-if="!onDrive && inBrowser.length > 0" class="flex" :class="compact ? 'items-center justify-end gap-2' : 'flex-col gap-3'">
    <component :is="group.exportControl" v-for="group in inBrowser" :key="group.app" :compact="compact" />
  </div>
  <SyncStatus v-else-if="onDrive" :control="sync.control.value" :run="sync.run.value" :compact="compact" :export-reminder="exportReminder" @sync="sync.sync" @allow="sync.allowAccess" />
</template>
