<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { withGoogleAccess } from '../../google/withGoogleAccess'
import AppDialog from '../../ui/AppDialog.vue'
import { placesStillHeld, placesTickedFirst, removalCanRetry, removalWent } from '../application/appData'
import type { AppData, DataPlace, HeldData, RemovalReport } from '../application/appData'
import DataPlaceChoices from './DataPlaceChoices.vue'
import DeleteFailure from './DeleteFailure.vue'
import { removalLines } from './removalLines'
import type { RemovalLine } from './removalLines'
import { words } from './words'

/** Asks before deleting an app's data, offering what it really has and an export, and says first what failed when something does. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{ data: AppData }>()

const text = words.deleteData
const toast = useToast()
const held = computed(() => props.data.held())
const chosen = ref<readonly DataPlace[]>([])
const withBackups = ref(false)
const deleting = ref(false)
const failure = ref<{ readonly lines: readonly RemovalLine[]; readonly canRetry: boolean } | null>(null)
const description = computed(() => (held.value?.source === 'drive' ? `${text.description} ${text.binRule}` : text.description))
const stays = computed(() => {
  if (held.value?.source !== 'drive') return text.staysBrowser
  return chosen.value.includes('drive-file') ? `${text.staysDrive} ${text.otherBrowser}` : text.staysDrive
})

watch(open, (opened) => {
  if (!opened) return
  const nowHeld = props.data.held()
  chosen.value = nowHeld === null ? [] : placesTickedFirst(nowHeld, nowHeld.places)
  withBackups.value = false
  failure.value = null
})

/** A file that fell into the bin during a failed delete offers only the copy from then on. */
watch(
  () => held.value?.places,
  (places) => {
    if (places !== undefined) chosen.value = placesStillHeld(chosen.value, places)
  },
)

function sayDeleted(report: RemovalReport, was: HeldData, trashed: boolean): void {
  const { fileName, besideFileName } = was
  if (report.steps.some(({ outcome }) => outcome.kind === 'failed')) {
    toast.add({
      title: text.besideLeft(props.data.name),
      description: removalLines(report, was).find((line) => line.kind === 'failed')?.text ?? '',
      icon: 'i-lucide-triangle-alert',
      color: 'warning',
      duration: 10_000,
    })
    return
  }
  const description = trashed
    ? besideFileName
      ? text.inBinBeside(fileName, besideFileName)
      : text.inBin(fileName)
    : was.source === 'drive' && was.places.includes('drive-file')
      ? text.onDriveStill(fileName)
      : undefined
  toast.add({ title: text.deleted(props.data.name), ...(description === undefined ? {} : { description }), icon: 'i-lucide-trash-2', color: 'success', duration: 10_000 })
}

async function remove(): Promise<void> {
  const was = held.value
  if (was === null) return
  const places = chosen.value
  const trashed = places.includes('drive-file')
  const backups = withBackups.value
  deleting.value = true
  failure.value = null
  try {
    const report = await withGoogleAccess(trashed || backups ? ['drive.file'] : [], () => props.data.remove(places, backups))
    if (report.removed) {
      open.value = false
      sayDeleted(report, was, trashed)
    } else if (removalWent(report)) {
      open.value = false
      toast.add({ title: text.backupsBinned, icon: 'i-lucide-trash-2', color: 'success', duration: 10_000 })
    } else {
      failure.value = { lines: removalLines(report, was), canRetry: removalCanRetry(report) }
    }
  } catch (refused) {
    failure.value = { lines: [{ kind: 'failed', text: refused instanceof Error ? refused.message : String(refused) }], canRetry: true }
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <AppDialog v-model:open="open" :title="text.title(data.name)" :description="description" :dismissible="!deleting">
    <div class="flex flex-col gap-4" data-testid="delete-data-dialog">
      <DeleteFailure v-if="failure" :title="text.failed" :note="failure.canRetry ? `${text.stillHere} ${text.tryAgain}` : text.stillHere" :lines="failure.lines" data-testid="delete-data-failed" />
      <DataPlaceChoices v-model:chosen="chosen" v-model:backups="withBackups" :data="data" :disabled="deleting" />
      <p class="type-caption" data-testid="delete-data-stays">{{ stays }}</p>
    </div>
    <template #end>
      <UButton :label="text.cancel" color="neutral" variant="ghost" :disabled="deleting" data-testid="delete-data-cancel" @click="open = false" />
      <UButton :label="text.confirm" icon="i-lucide-trash-2" color="error" :loading="deleting" :disabled="chosen.length === 0 && !withBackups" data-testid="delete-data-confirm" @click="remove" />
    </template>
  </AppDialog>
</template>
