<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { words } from './words'
import type { AskedElement } from '../../../../shared/ai/presentation/chatDock'

/** The rear camera's file picker, whose photo starts a chat with the receipt's task, or joins one going on. */
const picker = useTemplateRef<HTMLInputElement>('picker')
/** The entry the photo is taken for, which the chat is then about, or null for a receipt of no entry yet. */
let takenFor: AskedElement | null = null

/** Opens the camera for a receipt of `entry`. It runs in the tap, since a browser opens a file picker only then. */
function take(entry: AskedElement | null): void {
  takenFor = entry
  picker.value?.click()
}

/** The chat's code loads only once a photo is taken. */
async function toChat(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (files.length === 0) return
  const { startChatWith } = await import('../../../../shared/ai/presentation/chatSession')
  await startChatWith({ files, element: takenFor, task: words.readTask }, 'page')
}

defineExpose({ take })
</script>

<template>
  <input ref="picker" type="file" accept="image/*" capture="environment" class="hidden" data-testid="spending-receipt-to-chat-input" @change="toChat" />
</template>
