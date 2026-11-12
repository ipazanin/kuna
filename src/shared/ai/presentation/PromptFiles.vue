<script setup lang="ts">
import { computed } from 'vue'

import { formatCount } from '../../money/moneyFormat'
import NoteLine from '../../ui/NoteLine.vue'
import RemovableChip from '../../ui/RemovableChip.vue'
import { chatPromptFiles, promptFileNotes, promptFilesCost, removePromptFile } from './chatSession'
import type { FileRefusal, PromptFile } from './chatSession'
import { words } from './words'

/**
 * The files on the prompt as chips, with a line for each refused one saying why, and warnings of what goes to which AI
 * company and what Anonymise leaves as written. Under them it says what reading them costs.
 */
const props = defineProps<{
  /** False while the card asking before a send says how the files go instead. */
  saysHowFilesGo: boolean
}>()

const MEGABYTE = 1024 * 1024

function refusalWords(refusal: FileRefusal): string {
  switch (refusal.reason) {
    case 'unknown-kind':
      return words.files.unknownKind
    case 'too-many':
      return words.files.tooMany(formatCount(refusal.most))
    case 'too-large':
      return words.files.tooLarge(formatCount(refusal.most / MEGABYTE))
    case 'too-many-pages':
      return words.files.tooManyPages(formatCount(refusal.most))
    case 'encrypted':
      return words.files.encrypted
    case 'unreadable':
      return words.files.unreadable
    case 'unsafe':
      return words.files.unsafe
    case 'no-pdf':
      return words.result.noPdf(refusal.provider)
  }
}

function iconOf(file: PromptFile): string {
  if (file.state === 'refused') return 'i-lucide-circle-alert'
  if (file.state === 'reading') return 'i-lucide-file'
  if (file.attachment.kind === 'photo') return 'i-lucide-image'
  return file.attachment.kind === 'pdf' ? 'i-lucide-file-text' : 'i-lucide-file-spreadsheet'
}

const refusals = computed(() => chatPromptFiles.value.flatMap((file) => (file.state === 'refused' ? [{ key: file.key, text: words.files.refused(file.name, refusalWords(file.refusal)) }] : [])))
const going = computed(() => (props.saysHowFilesGo ? promptFileNotes.value : []))
</script>

<template>
  <div v-if="chatPromptFiles.length > 0" class="flex min-w-0 flex-col gap-1.5 px-2.5 pt-2" data-testid="chat-files">
    <div class="flex flex-wrap gap-1.5">
      <RemovableChip
        v-for="file in chatPromptFiles"
        :key="file.key"
        :label="file.name"
        :remove-label="words.files.remove(file.name)"
        :icon="iconOf(file)"
        :loading="file.state === 'reading'"
        :data-state="file.state"
        data-testid="chat-file"
        @remove="removePromptFile(file.key)"
      />
    </div>
    <NoteLine v-for="refusal in refusals" :key="refusal.key" tone="error" data-testid="chat-file-note">{{ refusal.text }}</NoteLine>
    <NoteLine v-for="note in going" :key="note" tone="warning" data-testid="chat-file-note">{{ note }}</NoteLine>
    <p v-if="promptFilesCost !== null" class="type-caption" data-testid="chat-files-cost">{{ promptFilesCost }}</p>
  </div>
</template>
