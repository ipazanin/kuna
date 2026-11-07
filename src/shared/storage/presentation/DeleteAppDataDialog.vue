<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { withGoogleAccess } from '../../google/withGoogleAccess'
import AppDialog from '../../ui/AppDialog.vue'
import type { AppData, DataPlace, HeldData, RemovalReport } from '../application/appData'
import DataPlaceChoices from './DataPlaceChoices.vue'
import { removalLines } from './removalLines'
import { words } from './words'

/** Asks before deleting an app's data, offering what it really has and a backup, and lists each step's outcome when one fails. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{ data: AppData }>()

const text = words.deleteData
const toast = useToast()
const held = computed(() => props.data.held())
const chosen = ref<readonly DataPlace[]>([])
const deleting = ref(false)
const failure = ref<readonly string[] | null>(null)

watch(open, (opened) => {
  if (!opened) return
  chosen.value = props.data.held()?.places ?? []
  failure.value = null
})

/** A file that fell into the bin during a failed delete offers only the copy from then on. */
watch(
  () => held.value?.places,
  (places) => {
    if (places !== undefined) chosen.value = chosen.value.filter((place) => places.includes(place))
  },
)

function sayDeleted(report: RemovalReport, was: HeldData, trashed: boolean): void {
  const { fileName, besideFileName } = was
  if (report.steps.some(({ outcome }) => outcome.kind === 'failed')) {
    toast.add({ title: text.besideLeft(props.data.name), description: removalLines(report).at(-1) ?? '', icon: 'i-lucide-triangle-alert', color: 'warning', duration: 10_000 })
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
  deleting.value = true
  failure.value = null
  try {
    const report = await withGoogleAccess(trashed ? ['drive.file'] : [], () => props.data.remove(places))
    if (report.removed) {
      open.value = false
      sayDeleted(report, was, trashed)
    } else {
      failure.value = removalLines(report)
    }
  } catch (refused) {
    failure.value = [refused instanceof Error ? refused.message : String(refused)]
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <AppDialog v-model:open="open" :title="text.title(data.name)" :description="text.description" :dismissible="!deleting">
    <div class="flex flex-col gap-4" data-testid="delete-data-dialog">
      <DataPlaceChoices v-model:chosen="chosen" :data="data" :disabled="deleting" />
      <p class="type-caption" data-testid="delete-data-stays">{{ held?.source === 'drive' ? text.staysDrive : text.staysBrowser }}</p>
      <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="text.failed" :description="text.stillHere" data-testid="delete-data-failed" />
      <ul v-if="failure" class="space-y-1 text-sm text-toned" data-testid="delete-data-steps">
        <li v-for="line in failure" :key="line">{{ line }}</li>
      </ul>
    </div>
    <template #end>
      <UButton :label="text.cancel" color="neutral" variant="ghost" :disabled="deleting" data-testid="delete-data-cancel" @click="open = false" />
      <UButton :label="text.confirm" icon="i-lucide-trash-2" color="error" :loading="deleting" :disabled="chosen.length === 0" data-testid="delete-data-confirm" @click="remove" />
    </template>
  </AppDialog>
</template>
