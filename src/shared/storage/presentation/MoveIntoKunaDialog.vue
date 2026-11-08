<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { withGoogleAccess } from '../../google/withGoogleAccess'
import { usePageSync } from '../../sync/presentation/pageSync'
import { folderTrail } from '../../text/folderPath'
import { plural } from '../../text/translation'
import AppDialog from '../../ui/AppDialog.vue'
import type { BooksRead, WorkbookStore } from '../application/createWorkbookStore'
import { DriveMoveRefused } from '../application/driveMoveRefused'
import type { DriveFileBeside, DriveMovePlan } from '../application/workbookPorts'
import type { WorkbookDocument } from '../infrastructure/documentFormat'
import type { DocumentCopy } from '../infrastructure/documentRecordStorage'
import { useKunaFolderHome } from './useKunaFolderHome'
import { words } from './words'

/**
 * Moves the app's Drive file into its subfolder of the Kuna folder, after listing what goes and what stays. Only this press moves anything.
 * The file goes first, so a refusal moves nothing. A move that fails after that says the rest is still to come, and pressing again carries on.
 */
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  appId: string
  fileName: string
  store: Pick<WorkbookStore<BooksRead, DocumentCopy, WorkbookDocument>, 'hasKunaFolder' | 'pickDriveFolder' | 'planMoveIntoKuna' | 'moveIntoKuna'>
  beside: () => DriveFileBeside
  /** What the move changes in the app's settings, written before it counts as over. */
  afterMove?: (() => Promise<void>) | undefined
}>()
const emit = defineEmits<{ ended: [] }>()
const text = words.moveIntoKuna
const toast = useToast()
const sync = usePageSync()
const kunaFolder = useKunaFolderHome(props.store)

const plan = ref<DriveMovePlan | null>(null)
const moving = ref(false)
const failure = ref<string | null>(null)
const where = computed(() => kunaFolder.trail(props.appId))
const filedFolders = computed(() => plan.value?.folders.filter((folder) => folder.kuna > 0) ?? [])
const leftBehind = computed(() => plan.value?.folders.flatMap((folder) => (folder.fromPath === undefined ? [] : [folderTrail(folder.fromPath)])) ?? [])
const otherFiles = computed(() => plan.value?.folders.reduce((sum, folder) => sum + folder.others, 0) ?? 0)

function reasonOf(refused: unknown): string {
  return refused instanceof Error ? refused.message : String(refused)
}

watch(open, async (opened) => {
  if (!opened) return
  failure.value = null
  plan.value = null
  try {
    await withGoogleAccess(['drive.file'], async () => {
      await kunaFolder.read()
      plan.value = await props.store.planMoveIntoKuna(props.beside)
    })
  } catch (refused) {
    failure.value = reasonOf(refused)
  }
})

async function move(): Promise<void> {
  moving.value = true
  failure.value = null
  try {
    await sync.settled()
    const left = await withGoogleAccess(['drive.file'], () => props.store.moveIntoKuna(props.beside, kunaFolder.parent.value?.id ?? null, props.afterMove))
    open.value = false
    toast.add({
      title: text.moved(props.fileName, where.value),
      ...(left.length > 0 ? { description: text.left(left.join(', ')) } : {}),
      icon: 'i-lucide-check',
      color: 'success',
    })
  } catch (refused) {
    failure.value = refused instanceof DriveMoveRefused ? refused.message : text.unfinished(reasonOf(refused))
  } finally {
    moving.value = false
    emit('ended')
  }
}
</script>

<template>
  <AppDialog v-model:open="open" :title="text.title" :description="text.description" :dismissible="!moving">
    <div class="flex flex-col gap-4" data-testid="move-into-kuna">
      <p class="identifier text-sm font-medium break-words text-highlighted" data-testid="move-into-kuna-where">{{ where }}</p>
      <div v-if="plan" class="flex flex-col gap-1">
        <p class="text-sm font-medium text-highlighted">{{ text.goes }}</p>
        <ul class="list-disc space-y-1 ps-4 text-sm text-toned" data-testid="move-into-kuna-goes">
          <li class="identifier">{{ fileName }}</li>
          <li v-for="name in plan.files" :key="name" class="identifier">{{ name }}</li>
          <li v-if="plan.backups > 0">{{ plural(text.backups(plan.backups), plan.backups) }}</li>
          <li v-for="folder in filedFolders" :key="folder.name">
            <span class="identifier">{{ folder.name }}</span
            >{{ plural(text.kunaFiles(folder.kuna), folder.kuna) }}
          </li>
        </ul>
      </div>
      <div v-if="plan && (plan.stays.length > 0 || otherFiles > 0)" class="flex flex-col gap-1">
        <p class="text-sm font-medium text-highlighted">{{ text.stays }}</p>
        <ul class="list-disc space-y-1 ps-4 text-sm text-toned" data-testid="move-into-kuna-stays">
          <li v-for="name in plan.stays" :key="name" class="identifier">{{ name }}</li>
          <li v-if="otherFiles > 0" data-testid="move-into-kuna-others">{{ plural(text.others(otherFiles), otherFiles) }}</li>
        </ul>
      </div>
      <p v-for="trail in leftBehind" :key="trail" class="text-sm text-toned" data-testid="move-into-kuna-stops-reading">
        <span class="identifier">{{ trail }}</span
        >{{ text.stopsReading }}
      </p>
      <p class="text-sm text-muted">{{ text.keepsWorking }}</p>
      <p class="text-sm text-muted">{{ text.partWay }}</p>
      <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="text.failed" :description="failure" data-testid="move-into-kuna-failed" />
    </div>
    <template #end>
      <UButton :label="text.cancel" color="neutral" variant="ghost" :disabled="moving" @click="open = false" />
      <UButton
        v-if="kunaFolder.canChoose.value"
        :label="words.firstRun.folder.elsewhere"
        icon="i-lucide-folder-search"
        color="neutral"
        variant="outline"
        :loading="kunaFolder.picking.value"
        :disabled="moving"
        data-testid="move-into-kuna-elsewhere"
        @click="kunaFolder.chooseElsewhere().catch((refused) => (failure = reasonOf(refused)))"
      />
      <UButton :label="text.confirm" icon="i-lucide-folder-input" :loading="moving" :disabled="plan === null" data-testid="move-into-kuna-confirm" @click="move" />
    </template>
  </AppDialog>
</template>
