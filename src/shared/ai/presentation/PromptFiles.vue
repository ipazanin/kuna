<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { formatCount } from '../../money/moneyFormat'
import RemovableChip from '../../ui/RemovableChip.vue'
import { anonymisingNow } from './aiProvider'
import { chatPromptFiles, promptFilesCost, promptSendsDocument, removePromptFile } from './chatSession'
import type { FileRefusal, PromptFile } from './chatSession'
import { words } from './words'

/**
 * The files on the prompt as chips, with a line for each that does not go whole: refused with why, read by Kuna alone,
 * or sent as cells, with a warning when Anonymise is off. Under them it says that photos and PDFs go whole, and about what reading them costs.
 */
defineProps<{
  /** False while the card asking before a send says it instead. */
  saysGoesWhole: boolean
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
    case 'books-opening':
      return words.files.booksOpening
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

const notes = computed(() =>
  chatPromptFiles.value.flatMap((file) => {
    if (file.state === 'refused') return [{ key: file.key, tone: 'refused', icon: 'i-lucide-circle-alert', text: words.files.refused(file.name, refusalWords(file.refusal)) }]
    if (file.state !== 'ready') return []
    if (file.attachment.reading.kind === 'kuna') return [{ key: file.key, tone: 'plain', icon: 'i-lucide-hard-drive', text: words.files.readByKuna(file.name) }]
    if (file.attachment.reading.kind === 'cells') {
      return anonymisingNow()
        ? [{ key: file.key, tone: 'plain', icon: 'i-lucide-send', text: words.files.goesAsCells(file.name) }]
        : [{ key: file.key, tone: 'warning', icon: 'i-lucide-send', text: words.files.goesAsCellsPlain(file.name) }]
    }
    return []
  }),
)
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
    <p
      v-for="note in notes"
      :key="note.key"
      class="flex items-start gap-1 type-caption wrap-anywhere"
      :class="{ 'text-error': note.tone === 'refused', 'text-warning': note.tone === 'warning' }"
      data-testid="chat-file-note"
    >
      <UIcon :name="note.icon" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {{ note.text }}
    </p>
    <p v-if="saysGoesWhole && promptSendsDocument" class="flex items-start gap-1 type-caption text-warning" data-testid="chat-files-whole">
      <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {{ words.files.goesWhole }}
    </p>
    <p v-if="promptFilesCost !== null" class="type-caption" data-testid="chat-files-cost">{{ promptFilesCost }}</p>
  </div>
</template>
