<script setup lang="ts">
import type { DeepReadonly } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UChatShimmer from '@nuxt/ui/components/ChatShimmer.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { KUNA_ISSUES_ADDRESS } from '../application/catalogue'
import ChatMessageText from './ChatMessageText.vue'
import ProposalCard from './ProposalCard.vue'
import SentRow from './SentRow.vue'
import { chatFigure, shownOnScreen } from './chatSession'
import type { ChatLine } from './chatSession'
import { words } from './words'

/** One line of a chat: what it read, a message, what is coming back for it, the cards and links under it, or why nothing came. An answer shows with aliases back as what they stand for. */
defineProps<{
  line: DeepReadonly<ChatLine>
  /** True while a message is under way, which an empty line then waits for. */
  streaming: boolean
}>()

const emit = defineEmits<{ retry: [message: string] }>()
</script>

<template>
  <div v-if="line.sent.length > 0" class="mb-1 flex flex-col gap-0.5">
    <SentRow v-for="(sent, at) in line.sent" :key="at" :sent="sent" />
  </div>
  <p v-if="line.note" class="type-caption" data-testid="chat-note">{{ line.text }}</p>
  <UChatShimmer v-else-if="line.text === '' && line.failure === null && streaming" :text="words.chat.thinking" class="type-body" data-testid="chat-thinking" />
  <template v-else-if="line.role === 'user'">
    <ChatMessageText v-if="line.text !== ''" :text="line.text" data-testid="chat-question" />
    <ul v-if="line.attachments.length > 0" class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5" :aria-label="words.files.sentWith" data-testid="chat-question-files">
      <li v-for="(name, at) in line.attachments" :key="at" class="flex min-w-0 items-center gap-1 type-caption">
        <UIcon name="i-lucide-paperclip" class="size-3.5 shrink-0" aria-hidden="true" />
        <span class="wrap-anywhere">{{ name }}</span>
      </li>
    </ul>
  </template>
  <ChatMessageText v-else-if="line.text !== ''" :text="shownOnScreen(line.text)" :figure="chatFigure" data-testid="chat-answer" />
  <p v-if="line.strayFigure" class="mt-1.5 flex items-start gap-1.5 type-caption text-warning" data-testid="chat-stray">
    <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    {{ words.answer.strayFigure }}
  </p>
  <ProposalCard v-for="proposal in line.proposals" :key="proposal.id" :proposal="proposal" />
  <div v-if="line.chips.length > 0" class="mt-2 flex flex-wrap gap-1.5">
    <template v-for="(chip, at) in line.chips" :key="at">
      <UButton v-if="chip.kind === 'screen'" :to="chip.to" :label="chip.label" trailing-icon="i-lucide-arrow-right" color="neutral" variant="outline" size="sm" data-testid="chat-chip" />
      <UButton
        v-else
        :to="KUNA_ISSUES_ADDRESS"
        target="_blank"
        rel="noopener"
        :label="words.chat.report"
        trailing-icon="i-lucide-external-link"
        color="neutral"
        variant="outline"
        size="sm"
        data-testid="chat-issues"
      />
    </template>
  </div>
  <div v-if="line.failure" class="flex flex-col items-start gap-1.5">
    <p class="flex items-start gap-1.5 type-body text-error" data-testid="chat-failure">
      <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span class="min-w-0 wrap-anywhere">{{ line.failure }}</span>
    </p>
    <UButton v-if="line.retry" :label="words.answer.tryAgain" color="neutral" variant="outline" size="sm" :disabled="streaming" data-testid="chat-retry" @click="emit('retry', line.retry)" />
  </div>
</template>
