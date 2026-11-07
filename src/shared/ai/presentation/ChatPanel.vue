<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UChatMessages from '@nuxt/ui/components/ChatMessages.vue'
import UChatPrompt from '@nuxt/ui/components/ChatPrompt.vue'
import UChatPromptSubmit from '@nuxt/ui/components/ChatPromptSubmit.vue'

import type { AppContribution, AssistTaskSummary } from '../../app/appContribution'
import { usePhoneLayout } from '../../layout/viewport'
import AppMark from '../../ui/AppMark.vue'
import RemovableChip from '../../ui/RemovableChip.vue'
import type { CatalogueScreen } from '../application/catalogue'
import { assistOn, switchAssist } from '../infrastructure/assistSettings'
import AssistConsent from './AssistConsent.vue'
import ChatLineView from './ChatLineView.vue'
import { chatTag, closeChat, removeChatTag } from './chatDock'
import { allowThisChat, allowedThisChat, chatLines, chatSpent, chatStatus, clearChat, loadCatalogue, sendChatMessage, stopChatMessage } from './chatSession'
import { providerInUse } from './useAiTask'
import { words } from './words'

/**
 * The chat beside the page or in its place, labelled with the app on screen. It knows this version of Kuna and reads
 * nothing from a person's books, and it asks once per chat unless the app's switch says not to ask.
 */
const props = defineProps<{
  /** The app on screen, or null on the home and Kuna's own screens. */
  app: AppContribution | null
  /** The screen's name, or null on the home. */
  screen: string | null
  /** The address, without its query. */
  path: string
  apps: readonly AppContribution[]
  kunaScreens: readonly CatalogueScreen[]
}>()

const CHAT_SUMMARY: AssistTaskSummary = { id: 'chat.turn', title: words.chat.title, sends: words.chat.sends, employees: null }

const phone = usePhoneLayout()
const provider = computed(() => providerInUse())
const draft = ref('')
const asking = ref<string | null>(null)

/** An app with no Assistant tab has no switch a person could see or take back, so outside Company and Spending only a yes for this chat stops the asking. */
const switchApp = computed(() => (props.app?.assist === undefined ? null : props.app.id))

const messages = computed(() => chatLines.map((line) => ({ id: line.id, role: line.role, parts: [{ type: 'text' as const, text: line.text }], line })))
const lineOf = (id: string) => chatLines.find((line) => line.id === id)

function send(message: string): void {
  const app = switchApp.value
  const preset = provider.value
  if ((app !== null && assistOn(app)) || (preset !== null && allowedThisChat(preset.id))) run(message)
  else asking.value = message
}

function run(message: string): void {
  const tag = chatTag.value
  void sendChatMessage(message, { app: props.app?.name ?? null, screen: props.screen, path: props.path, tag: tag === null ? null : { label: tag.label, screen: tag.screen } }, () =>
    loadCatalogue(props.apps, props.kunaScreens),
  )
}

function submit(): void {
  const message = draft.value.trim()
  if (message === '' || chatStatus.value !== 'ready') return
  draft.value = ''
  send(message)
}

function sendOnce(): void {
  const message = asking.value
  asking.value = null
  if (provider.value !== null) allowThisChat(provider.value.id)
  if (message !== null) run(message)
}

function dontAskAgain(): void {
  if (switchApp.value !== null) switchAssist(switchApp.value, true)
  sendOnce()
}

function askingClosed(open: boolean): void {
  if (open || asking.value === null) return
  if (draft.value === '') draft.value = asking.value
  asking.value = null
}

function startOver(): void {
  clearChat()
  removeChatTag()
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col" :aria-label="words.chat.panel" data-testid="chat-panel">
    <header class="flex min-h-12 items-center gap-2 border-b border-default px-3 py-1.5">
      <AppMark v-if="app" :icon="app.homeCard.icon" :colour="app.colour" />
      <p class="min-w-0 flex-1 truncate type-label" data-testid="chat-label">{{ app ? words.chat.inApp(app.name) : words.chat.inKuna }}</p>
      <UButton
        v-if="chatLines.length > 0"
        icon="i-lucide-square-pen"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="words.chat.newChat"
        :title="words.chat.newChat"
        data-testid="chat-new"
        @click="startOver"
      />
      <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" :aria-label="words.chat.close" :title="words.chat.close" data-testid="chat-close" @click="closeChat" />
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3" data-testid="chat-messages">
      <p v-if="chatLines.length === 0" class="type-body text-muted" data-testid="chat-empty">{{ words.chat.empty }}</p>
      <UChatMessages
        v-else
        :messages="messages"
        :status="chatStatus"
        should-auto-scroll
        :user="{ side: 'right', variant: 'soft' }"
        :assistant="{ side: 'left', variant: 'naked' }"
        :spacing-offset="0"
        compact
      >
        <template #content="{ message }">
          <ChatLineView v-if="lineOf(message.id)" :line="lineOf(message.id)!" :streaming="chatStatus === 'streaming'" @retry="send" />
        </template>
      </UChatMessages>
    </div>

    <div class="flex flex-col gap-1.5 border-t border-default px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div v-if="chatTag" class="flex min-w-0 items-center gap-1" data-testid="chat-tag">
        <RemovableChip :label="words.chat.tagged(chatTag.label)" :remove-label="words.chat.removeTag(chatTag.label)" data-testid="chat-tag-remove" @remove="removeChatTag" />
      </div>
      <UChatPrompt v-model="draft" :placeholder="words.chat.placeholder" :autofocus="!phone" variant="subtle" :maxrows="6" data-testid="chat-prompt" @submit="submit">
        <UChatPromptSubmit :status="chatStatus" :disabled="draft.trim() === ''" color="neutral" data-testid="chat-send" @stop="stopChatMessage" />
      </UChatPrompt>
      <p v-if="chatSpent" class="type-caption" data-testid="chat-spent">{{ words.chat.spent(chatSpent) }}</p>
    </div>

    <AssistConsent
      v-if="asking !== null && provider"
      :open="true"
      :task="CHAT_SUMMARY"
      :provider="provider"
      :sends-employees="false"
      :offers-always="switchApp !== null"
      @update:open="askingClosed"
      @once="sendOnce"
      @always="dontAskAgain"
    />
  </section>
</template>
