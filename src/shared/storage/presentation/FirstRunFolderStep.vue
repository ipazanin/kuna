<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { withGoogleAccess } from '../../google/withGoogleAccess'
import { plural } from '../../text/translation'
import AskChatButton from '../../ai/presentation/AskChatButton.vue'
import { words as chatWords } from '../../ai/presentation/words'
import StepCard from '../../ui/StepCard.vue'
import { BooksAlreadyOnDrive } from '../application/booksAlreadyOnDrive'
import type { WorkbookDocument } from '../infrastructure/documentFormat'
import type { DriveFirstRun } from './fileFirstRun'
import { useKunaFolderHome } from './useKunaFolderHome'
import type { FirstRunMoves } from './useFirstRun'
import { words } from './words'

/**
 * The app's file goes in its subfolder of the one Kuna folder. Nothing is made until the person taps Create the file here, which makes the
 * folders it needs. A tap asks Google first when the page holds no token, and on a phone the route brings the person back here. Where the
 * Kuna folder goes is asked only until it exists. When Drive already holds the app's file, it offers to find it instead. Drive's search finds only
 * a file the app marked, so a file someone picked on another device stays unseen, and the step offers to open one before it makes one.
 */
const props = defineProps<{
  firstRun: DriveFirstRun
  steps: FirstRunMoves
  /**
   * Records the app already holds, from a file brought along or from this browser, which the new file keeps in place
   * of new contents and the toast counts as moved. Null once the page no longer holds them, which the `missing` slot explains.
   */
  moving?: WorkbookDocument | null | undefined
}>()
const store = props.firstRun.store
const appWords = computed(() => props.firstRun.words.folder)
const toast = useToast()
const kunaFolder = useKunaFolderHome(store)

const keeping = ref(false)
/** The keep under way goes on into the chat, so its button spins, not Create. */
const keepingWithChat = ref(false)
const failure = ref<string | null>(null)
const alreadyOnDrive = ref<BooksAlreadyOnDrive | null>(null)

const where = computed(() => kunaFolder.trail(props.firstRun.appId))
onMounted(() => void kunaFolder.read())

/** Opening the file on Drive deletes the one kept in this browser. */
const dropsBrowserFile = computed(() => store.state.choice?.source === 'browser')

function failed(refused: unknown): void {
  if (refused instanceof BooksAlreadyOnDrive) {
    alreadyOnDrive.value = refused
  } else {
    failure.value = refused instanceof Error ? refused.message : String(refused)
  }
}

async function chooseElsewhere(): Promise<void> {
  failure.value = null
  await kunaFolder.chooseElsewhere().catch(failed)
}

function keptToast(name: string, document: WorkbookDocument, moved: boolean): { title: string; description: string } {
  if (!moved) {
    return { title: words.firstRun.folder.created(name, where.value), description: words.firstRun.folder.createdNote }
  }
  const records = Object.values(document.records).reduce((sum, kind) => sum + kind.length, 0)
  return { title: plural(words.firstRun.folder.moved(records), records), description: words.firstRun.folder.movedNote(name, where.value) }
}

async function create(withChat = false): Promise<void> {
  // Read before the keep, since the page stops holding the moved records once the file is on Drive.
  const moved = props.moving !== undefined
  const document = props.moving === undefined ? props.firstRun.newContents() : props.moving
  if (document === null) return
  const before = store.state.choice
  keeping.value = true
  keepingWithChat.value = withChat
  failure.value = null
  alreadyOnDrive.value = null
  try {
    await withGoogleAccess(['drive.file'], async () => store.keepOnDrive(await store.driveHomeOfApp(kunaFolder.parent.value?.id ?? null), document))
  } catch (refused) {
    failed(refused)
  } finally {
    keeping.value = false
  }
  const chosen = store.state.choice
  if (chosen !== before && chosen?.source === 'drive') {
    toast.add({ ...keptToast(chosen.name, document, moved), icon: 'i-lucide-check', color: 'success' })
    await (withChat ? props.steps.finishIntoChat() : props.steps.finish())
  } else if (store.state.status === 'error') {
    failure.value = store.state.error
  }
}
</script>

<template>
  <StepCard :title="appWords.title" :subtitle="words.firstRun.folder.subtitle">
    <slot v-if="moving === null" name="missing" />
    <div v-else class="flex flex-col gap-2 rounded-control border border-default bg-elevated/40 px-3 py-3" :data-testid="`${firstRun.testId}-folder-confirm`">
      <p class="text-sm text-muted">{{ appWords.savedIn }}</p>
      <p class="identifier text-sm font-medium break-words text-highlighted">{{ where }}</p>
      <p class="flex items-center gap-2 text-sm text-toned">
        <UIcon name="i-lucide-file-json" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span class="min-w-0"
          ><span class="identifier">{{ firstRun.fileName }}</span
          >{{ words.firstRun.folder.withBackups }}</span
        >
      </p>
    </div>
    <p v-if="moving === undefined && !alreadyOnDrive" class="text-sm text-toned" :data-testid="`${firstRun.testId}-have-one`">{{ words.firstRun.folder.haveOne }}</p>
    <div v-if="!alreadyOnDrive && moving !== null && (moving === undefined || kunaFolder.canChoose.value)" class="flex flex-col items-start gap-1">
      <UButton
        v-if="moving === undefined"
        :label="words.firstRun.folder.openExisting"
        icon="i-lucide-file-search"
        color="neutral"
        variant="link"
        class="inline-target quiet-link px-0"
        :disabled="keeping"
        :data-testid="`${firstRun.testId}-open-existing`"
        @click="steps.go('find')"
      />
      <UButton
        v-if="kunaFolder.canChoose.value"
        :label="words.firstRun.folder.elsewhere"
        icon="i-lucide-folder-search"
        color="neutral"
        variant="link"
        class="inline-target quiet-link px-0"
        :loading="kunaFolder.picking.value"
        :disabled="keeping"
        :data-testid="`${firstRun.testId}-elsewhere`"
        @click="chooseElsewhere"
      />
    </div>
    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="words.firstRun.folder.failed" :description="failure" :data-testid="`${firstRun.testId}-failure`" />
    <UAlert
      v-if="alreadyOnDrive"
      icon="i-lucide-hard-drive"
      color="warning"
      variant="subtle"
      :title="appWords.onDriveTitle"
      :description="dropsBrowserFile ? appWords.onDriveDrops(alreadyOnDrive.message) : alreadyOnDrive.message"
      :data-testid="`${firstRun.testId}-on-drive`"
    />

    <template #actions>
      <UButton v-if="alreadyOnDrive" :label="appWords.openOnDrive" icon="i-lucide-folder-open" :data-testid="`${firstRun.testId}-open-on-drive`" @click="steps.go('find')" />
      <template v-else-if="moving !== null">
        <AskChatButton
          v-if="moving === undefined"
          :text="chatWords.ask.setUp"
          size="md"
          :loading="keeping && keepingWithChat"
          :disabled="keeping || kunaFolder.picking.value"
          :data-testid="`${firstRun.testId}-chat`"
          @ask="create(true)"
        />
        <UButton
          :label="words.firstRun.folder.create"
          icon="i-lucide-hard-drive-upload"
          :loading="keeping && !keepingWithChat"
          :disabled="keeping || kunaFolder.picking.value"
          :data-testid="`${firstRun.testId}-create`"
          @click="create()"
        />
      </template>
    </template>
  </StepCard>
</template>
