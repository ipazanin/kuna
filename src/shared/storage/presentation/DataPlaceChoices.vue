<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { withPlace } from '../application/appData'
import type { AppData, DataPlace } from '../application/appData'
import DeleteRow from './DeleteRow.vue'
import { backupsLabel } from './removalLines'
import { words } from './words'

/** One app's part of a delete: its export, a tick for each place it really has data, and on Drive its backups, whose row keeps its place whatever the count. */
const chosen = defineModel<readonly DataPlace[]>('chosen', { required: true })
const withBackups = defineModel<boolean>('backups', { required: true })

const props = defineProps<{
  data: AppData
  /** Heads the part with the app's name, where the dialog lists several apps. */
  named?: boolean
  disabled?: boolean
}>()

const text = words.deleteData
const toast = useToast()
const held = computed(() => props.data.held())
const onDrive = computed(() => held.value?.places.includes('drive-file') === true)
const inBrowserOnly = computed(() => held.value?.source === 'browser')
const driveChosen = computed(() => chosen.value.includes('drive-file'))
const copyNote = computed(() => (onDrive.value ? text.driveCopyGoes : text.missingCopyGoes))
const driveNote = computed(() => (held.value?.besideFileName ? text.driveFileGoesBeside(held.value.besideFileName) : text.driveFileGoes))

function tick(place: DataPlace, on: boolean): void {
  chosen.value = withPlace(chosen.value, place, on)
}

const backupCount = ref<number | null>(null)

/** Read as the part opens and again after a delete, which may have binned some of them. */
watch(
  () => props.disabled,
  async (busy) => {
    if (busy || held.value?.source !== 'drive') return
    backupCount.value = await props.data.backupsOnDrive()
    if (backupCount.value === 0) withBackups.value = false
  },
  { immediate: true },
)

const exporting = ref(false)
const exported = ref(false)

async function exportFile(): Promise<void> {
  exporting.value = true
  try {
    await props.data.backUp()
    exported.value = true
  } catch (failure) {
    toast.add({ title: text.exportFailed, description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error' })
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <section v-if="held" class="flex flex-col gap-3" :data-testid="`delete-data-${data.id}`">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 v-if="named" class="type-label">{{ data.name }}</h3>
      <UButton
        :icon="exported ? 'i-lucide-check' : 'i-lucide-download'"
        :label="exported ? text.exported : text.exportFile"
        :aria-label="exported ? text.exportedOf(data.name) : text.exportFileOf(data.name)"
        color="neutral"
        variant="outline"
        size="sm"
        :loading="exporting"
        :disabled="!held.canBackUp || exporting || disabled"
        :data-testid="`delete-data-backup-${data.id}`"
        @click="exportFile"
      />
    </div>
    <DeleteRow
      v-if="onDrive"
      :model-value="driveChosen"
      :label="text.driveFile(held.fileName)"
      :goes="driveNote"
      :stays="text.staysOnDrive"
      :disabled="disabled"
      :data-testid="`delete-data-drive-${data.id}`"
      @update:model-value="tick('drive-file', $event)"
    />
    <DeleteRow
      v-if="inBrowserOnly"
      :model-value="chosen.includes('browser-copy')"
      :label="text.browserFile"
      :goes="text.browserFileGoes"
      :stays="text.staysHere"
      :for-good="text.forGood"
      :disabled="disabled"
      :data-testid="`delete-data-copy-${data.id}`"
      @update:model-value="tick('browser-copy', $event)"
    />
    <DeleteRow
      v-else-if="!driveChosen"
      :model-value="chosen.includes('browser-copy')"
      :label="text.driveCopy"
      :goes="copyNote"
      :stays="text.staysHere"
      :disabled="disabled"
      :data-testid="`delete-data-copy-${data.id}`"
      @update:model-value="tick('browser-copy', $event)"
    />
    <DeleteRow
      v-if="held.source === 'drive'"
      v-model="withBackups"
      :label="backupsLabel(backupCount)"
      :goes="text.backupsGo"
      :stays="backupCount === 0 ? '' : text.backupsStay"
      :disabled="disabled || backupCount === 0"
      :data-testid="`delete-data-backups-${data.id}`"
    />
  </section>
</template>
