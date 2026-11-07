<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UChatMessages from '@nuxt/ui/components/ChatMessages.vue'
import UChatPrompt from '@nuxt/ui/components/ChatPrompt.vue'
import UChatPromptSubmit from '@nuxt/ui/components/ChatPromptSubmit.vue'

import type { AppContribution } from '../../app/appContribution'
import { usePhoneLayout } from '../../layout/viewport'
import AppMark from '../../ui/AppMark.vue'
import RemovableChip from '../../ui/RemovableChip.vue'
import type { CatalogueScreen } from '../application/catalogue'
import { assistOn, switchAssist } from '../application/assistSettings'
import ChatConsentCard from './ChatConsentCard.vue'
import ChatLineView from './ChatLineView.vue'
import { chatTag, closeChat, removeChatTag } from './chatDock'
import { allowThisChat, allowedThisChat, chatDraft, chatLines, chatSpent, chatStatus, clearChat, loadCatalogue, sendChatMessage, stopChatMessage } from './chatSession'
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
  /** The query, read only to tell which declared tab is open. */
  query: Readonly<Record<string, unknown>>
  apps: readonly AppContribution[]
  kunaScreens: readonly CatalogueScreen[]
}>()

const phone = usePhoneLayout()
const provider = computed(() => providerInUse())
const asking = ref<string | null>(null)
const panel = useTemplateRef<HTMLElement>('panel')

/** The card's buttons leave with the card, so focus goes back to the prompt. A phone keeps its keyboard down. */
watch(asking, (message) => {
  if (message === null && !phone.value) void nextTick(() => panel.value?.querySelector('textarea')?.focus())
})

/** An app with no Assistant tab has no switch a person could see or take back, so outside Company and Spending only a yes for this chat stops the asking. */
const switchApp = computed(() => (props.app?.assist === undefined ? null : props.app.id))

const messages = computed(() => chatLines.map((line) => ({ id: line.id, role: line.role, parts: [{ type: 'text' as const, text: line.text }], line })))
const lineOf = (id: string) => chatLines.find((line) => line.id === id)

/** Whether a send may go without asking: the app's switch is on, or this chat already has a yes for the provider. */
function allowed(): boolean {
  const app = switchApp.value
  const preset = provider.value
  return (app !== null && assistOn(app)) || (preset !== null && allowedThisChat(preset.id))
}

function send(message: string): void {
  if (allowed()) run(message)
  else asking.value = message
}

function run(message: string): void {
  const tag = chatTag.value
  void sendChatMessage(message, { app: props.app?.name ?? null, screen: props.screen, path: props.path, query: props.query, tag: tag === null ? null : { label: tag.label, screen: tag.screen } }, () =>
    loadCatalogue(props.apps, props.kunaScreens),
  )
}

/** The question stays in the prompt until it goes, so Cancel on the card loses nothing. */
function submit(): void {
  const message = chatDraft.value.trim()
  if (message === '' || chatStatus.value !== 'ready') return
  if (allowed()) chatDraft.value = ''
  send(message)
}

function allowInChat(): void {
  const message = asking.value
  asking.value = null
  if (provider.value !== null) allowThisChat(provider.value.id)
  if (message === null) return
  if (chatDraft.value.trim() === message) chatDraft.value = ''
  run(message)
}

function allowAlways(): void {
  if (switchApp.value !== null) switchAssist(switchApp.value, true)
  allowInChat()
}

function startOver(): void {
  asking.value = null
  clearChat()
  removeChatTag()
}
</script>

<template>
  <section ref="panel" class="flex h-full min-h-0 flex-col" :aria-label="words.chat.panel" data-testid="chat-panel">
    <header class="flex min-h-12 items-center gap-2 border-b border-default px-3 py-1.5">
      <AppMark v-if="app && !phone" :icon="app.homeCard.icon" :colour="app.colour" />
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
      <div class="mx-auto w-full max-w-2xl">
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
    </div>

    <div class="border-t border-default px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div class="mx-auto flex w-full max-w-2xl flex-col gap-1.5">
        <ChatConsentCard v-if="asking !== null && provider" :provider="provider" :offers-always="switchApp !== null" @allow="allowInChat" @always="allowAlways" @cancel="asking = null" />
        <div v-if="chatTag" class="flex min-w-0 items-center gap-1" data-testid="chat-tag">
          <RemovableChip :label="chatTag.label" :remove-label="words.chat.removeTag(chatTag.label)" data-testid="chat-tag-remove" @remove="removeChatTag" />
        </div>
        <UChatPrompt
          v-model="chatDraft"
          :placeholder="words.chat.placeholder"
          :autofocus="!phone"
          :disabled="asking !== null"
          variant="subtle"
          :maxrows="6"
          class="chat-prompt"
          data-testid="chat-prompt"
          @submit="submit"
        >
          <UChatPromptSubmit :status="chatStatus" :disabled="chatDraft.trim() === '' || asking !== null" color="neutral" data-testid="chat-send" @stop="stopChatMessage" />
        </UChatPrompt>
        <p v-if="chatSpent" class="type-caption" data-testid="chat-spent">{{ words.chat.spent(chatSpent) }}</p>
      </div>
    </div>
  </section>
</template>
