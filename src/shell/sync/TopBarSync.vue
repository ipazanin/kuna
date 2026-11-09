<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UPopover from '@nuxt/ui/components/Popover.vue'

import { exportReminderDue } from '../../shared/storage/domain/exportReminder'
import { writesInFlight } from '../../shared/storage/application/writesInFlight'
import { words as storageWords } from '../../shared/storage/presentation/words'
import SyncStatus from '../../shared/sync/presentation/SyncStatus.vue'
import { usePageSync } from '../../shared/sync/presentation/pageSync'
import { listInWords } from '../../shared/text/listInWords'
import { plural } from '../../shared/text/translation'
import { words } from '../ui/words'

/**
 * The top bar's control: the sync for the files on Drive, with a dot while a file kept in this
 * browser is due for an export, or the export of each file kept in this browser while none is on Drive.
 * In the top bar, two or more such files share one Export button that opens each file's export, so the screen's name keeps its room.
 * Nothing shows while no app has a file chosen.
 */
withDefaults(
  defineProps<{
    /** The narrow top-bar form. */
    compact?: boolean
    /** On the icon sidebar: the icon alone, with its name as a tooltip. */
    rail?: boolean
  }>(),
  { compact: false, rail: false },
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
  <UPopover v-if="!onDrive && compact && !rail && inBrowser.length > 1" :content="{ align: 'end', collisionPadding: 12 }">
    <UButton
      icon="i-lucide-download"
      :label="storageWords.localFile.export"
      :aria-label="[storageWords.localFile.export, exportReminder].filter(Boolean).join('. ')"
      color="neutral"
      variant="outline"
      size="sm"
      class="top-bar-action"
      :class="{ 'has-reminder': exportReminder }"
      data-testid="top-bar-exports"
    />
    <template #content>
      <div class="flex w-72 flex-col gap-3 p-3" data-testid="top-bar-exports-list">
        <component :is="group.exportControl" v-for="group in inBrowser" :key="group.app" :name="group.name" />
      </div>
    </template>
  </UPopover>
  <div v-else-if="!onDrive && inBrowser.length > 0" class="flex" :class="rail ? 'flex-col items-center gap-2' : compact ? 'items-center justify-end gap-2' : 'flex-col gap-3'">
    <component :is="group.exportControl" v-for="group in inBrowser" :key="group.app" :compact="compact" :rail="rail" />
  </div>
  <SyncStatus
    v-else-if="onDrive"
    :control="sync.control.value"
    :run="sync.run.value"
    :compact="compact"
    :rail="rail"
    :export-reminder="exportReminder"
    :saving="writesInFlight > 0"
    @sync="sync.sync"
    @allow="sync.allowAccess"
  />
</template>
