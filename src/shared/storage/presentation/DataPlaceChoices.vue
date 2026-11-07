<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { withPlace } from '../application/appData'
import type { AppData, DataPlace } from '../application/appData'
import { words } from './words'

/** One app's part of a delete: its backup and a tick for each place it really has data. */
const chosen = defineModel<readonly DataPlace[]>('chosen', { required: true })

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
const copyNote = computed(() => {
  if (inBrowserOnly.value) return text.browserFileNote
  if (!onDrive.value) return text.missingCopyNote
  return driveChosen.value ? text.driveCopyGoes : text.driveCopyNote
})
const driveNote = computed(() => (held.value?.besideFileName ? text.driveFileBeside(held.value.besideFileName) : text.driveFileNote))

function tick(place: DataPlace, on: boolean | 'indeterminate'): void {
  chosen.value = withPlace(chosen.value, place, on === true)
}

const backingUp = ref(false)

async function backUp(): Promise<void> {
  backingUp.value = true
  try {
    toast.add({ title: text.backedUp, description: await props.data.backUp(), icon: 'i-lucide-download', color: 'success' })
  } catch (failure) {
    toast.add({ title: text.backUpFailed, description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error' })
  } finally {
    backingUp.value = false
  }
}
</script>

<template>
  <section v-if="held" class="flex flex-col gap-3" :data-testid="`delete-data-${data.id}`">
    <h3 v-if="named" class="type-label">{{ data.name }}</h3>
    <UButton
      icon="i-lucide-download"
      :label="text.backUp"
      color="neutral"
      variant="outline"
      size="sm"
      class="self-start"
      :loading="backingUp"
      :disabled="!held.canBackUp || backingUp"
      :data-testid="`delete-data-backup-${data.id}`"
      @click="backUp"
    />
    <UCheckbox
      v-if="onDrive"
      :model-value="driveChosen"
      :label="text.driveFile(held.fileName)"
      :description="driveNote"
      :disabled="disabled"
      :data-testid="`delete-data-drive-${data.id}`"
      @update:model-value="tick('drive-file', $event)"
    />
    <UCheckbox
      :model-value="chosen.includes('browser-copy')"
      :label="inBrowserOnly ? text.browserFile : text.driveCopy"
      :description="copyNote"
      :disabled="disabled || driveChosen"
      :data-testid="`delete-data-copy-${data.id}`"
      @update:model-value="tick('browser-copy', $event)"
    />
  </section>
</template>
