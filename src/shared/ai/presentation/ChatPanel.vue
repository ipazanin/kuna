<script setup lang="ts">
import { computed, nextTick, onMounted, provide, ref, toRaw, useTemplateRef, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UChatMessages from '@nuxt/ui/components/ChatMessages.vue'
import UChatPrompt from '@nuxt/ui/components/ChatPrompt.vue'
import UChatPromptSubmit from '@nuxt/ui/components/ChatPromptSubmit.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { AppContribution } from '../../app/appContribution'
import type { AssistantQuickAction } from '../../app/assistantOperations'
import { usePhoneLayout } from '../../layout/viewport'
import AppMark from '../../ui/AppMark.vue'
import RemovableChip from '../../ui/RemovableChip.vue'
import { today } from '../../calendar/civilDate'
import { assistOn, switchAssist } from '../application/assistSettings'
import { ATTACHABLE } from '../domain/chatAttachments'
import { CHAT_APPS } from './chatApps'
import type { KunaChat } from './chatApps'
import GrantCard from './GrantCard.vue'
import ChatLineView from './ChatLineView.vue'
import PromptFiles from './PromptFiles.vue'
import { chatElement, closeChat, removeChatElement } from './chatDock'
import {
  allowThisChat,
  allowedThisChat,
  answerReadAsk,
  attachFiles,
  chatAsking,
  chatDraft,
  chatLines,
  chatPromptFiles,
  chatSpent,
  chatStatus,
  clearChat,
  loadCatalogue,
  promptPdfsRefused,
  promptSendsDocument,
  restoreChat,
  sendChatMessage,
  stopChatMessage,
} from './chatSession'
import { anonymisingNow, providerInUse } from './aiProvider'
import { words } from './words'

/**
 * The chat beside the page or in its place, labelled with the app on screen. It knows this version of Kuna, and it
 * asks once per chat before it sends, which also lets it read the app on screen, unless the app's switch says not to ask.
 * A read of another app asks again.
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
  /** Kuna itself, whose screens belong to no one app and whose settings of this device the chat may change. */
  kuna: KunaChat
}>()

const phone = usePhoneLayout()
const provider = computed(() => providerInUse())
const asking = ref<string | null>(null)
/** Whether the chat can read the app on screen, which the app's lazy assistant says. */
const readsHere = ref(false)
const quickActions = ref<readonly AssistantQuickAction[]>([])

provide(CHAT_APPS, [...props.apps, props.kuna])
onMounted(() => {
  void restoreChat()
  void loadCatalogue(props.apps, props.kuna)
})
const panel = useTemplateRef<HTMLElement>('panel')

/** The card's buttons leave with the card, so focus goes back to the prompt. A phone keeps its keyboard down. */
watch([asking, chatAsking], ([message, read]) => {
  if (message === null && read === null && !phone.value) void nextTick(() => panel.value?.querySelector('textarea')?.focus())
})

watch(
  () => props.app,
  async (app) => {
    const assistant = app === null ? null : await app.assistant()
    if (app !== props.app) return
    readsHere.value = assistant !== null && assistant.reader !== null
    quickActions.value = assistant?.quickActions ?? []
  },
  { immediate: true },
)

/** An app with no Assistant tab has no switch a person could see or take back, so outside Company and Spending only a yes for this chat stops the asking. */
const switchApp = computed(() => (props.app?.assist === undefined ? null : props.app.id))

const asksAlways = computed(() => props.apps.find((app) => app.id === chatAsking.value?.app)?.assist !== undefined)
const aliasLine = computed(() => (anonymisingNow() ? words.chat.aliases : words.chat.noAliases(provider.value?.name ?? '')))
const sendLines = computed(() => {
  const files = promptSendsDocument.value
  const sends = readsHere.value && props.app !== null ? (files ? words.chat.sendsAndReadsWithFiles : words.chat.sendsAndReads)(props.app.name) : files ? words.chat.sendsWithFiles : words.chat.sends
  return [words.consent.sends(sends), ...(readsHere.value && props.app !== null ? [aliasLine.value] : [])]
})
const readLines = computed(() => (chatAsking.value === null ? [] : [words.consent.sends(words.chat.reads(chatAsking.value.name)), aliasLine.value]))
const held = computed(() => asking.value !== null || chatAsking.value !== null)
const readingFiles = computed(() => chatPromptFiles.value.some((file) => file.state === 'reading'))
const placeholder = computed(() => {
  if (chatElement.value !== null) return words.chat.placeholderAbout(chatElement.value.label)
  return readsHere.value ? words.chat.placeholderReads : words.chat.placeholder
})

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

/** The tagged element goes as the object the screen gave, so the chat names it by the same ref with each message. */
function run(message: string): void {
  const tagged = chatElement.value
  void sendChatMessage(
    message,
    { app: props.app?.name ?? null, screen: props.screen, path: props.path, query: props.query, element: tagged === null ? null : toRaw(tagged.about), today: today() },
    () => loadCatalogue(props.apps, props.kuna),
  )
}

/** The question stays in the prompt until it goes, so Cancel on the card loses nothing. */
function submit(): void {
  const message = chatDraft.value.trim()
  if (message === '' || chatStatus.value !== 'ready' || readingFiles.value || promptPdfsRefused.value) return
  if (allowed()) chatDraft.value = ''
  send(message)
}

function allowInChat(): void {
  const message = asking.value
  asking.value = null
  if (provider.value !== null) allowThisChat(provider.value.id, readsHere.value && props.app !== null ? props.app.id : null)
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
  removeChatElement()
}

const picker = useTemplateRef<HTMLInputElement>('picker')
const camera = useTemplateRef<HTMLInputElement>('camera')

/** Takes what a picker gave and empties it, so the same file can be picked again. */
function picked(event: Event): void {
  const input = event.target as HTMLInputElement
  void attachFiles([...(input.files ?? [])])
  input.value = ''
}

/** How deep a drag is inside the panel, as each child it crosses fires its own enter and leave. */
const dragDepth = ref(0)
const holdsFiles = (event: DragEvent): boolean => event.dataTransfer?.types.includes('Files') === true

function dragEntered(event: DragEvent): void {
  if (holdsFiles(event) && !held.value) dragDepth.value += 1
}

function dragLeft(): void {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

/** Only a drag of files is taken, so text dragged into the prompt still lands there. */
function draggedOver(event: DragEvent): void {
  if (holdsFiles(event)) event.preventDefault()
}

function dropped(event: DragEvent): void {
  if (!holdsFiles(event)) return
  event.preventDefault()
  const wasOver = dragDepth.value > 0
  dragDepth.value = 0
  if (wasOver) void attachFiles([...(event.dataTransfer?.files ?? [])])
}
</script>

<template>
  <section
    ref="panel"
    class="relative flex h-full min-h-0 flex-col"
    :aria-label="words.chat.panel"
    data-testid="chat-panel"
    @dragenter="dragEntered"
    @dragover="draggedOver"
    @dragleave="dragLeft"
    @drop="dropped"
  >
    <div
      v-if="dragDepth > 0"
      class="pointer-events-none absolute inset-2 z-control flex flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-accented bg-default p-4 text-center"
      data-testid="chat-drop"
    >
      <UIcon name="i-lucide-paperclip" class="size-6 text-muted" aria-hidden="true" />
      <p class="type-label">{{ words.files.drop }}</p>
      <p class="type-caption">{{ words.files.dropKinds }}</p>
    </div>
    <header class="flex min-h-14 items-center gap-2 border-b border-default px-3 py-1.5">
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
        <div v-if="chatLines.length === 0" class="flex flex-col items-start gap-3">
          <p class="type-body text-muted" data-testid="chat-empty">{{ readsHere && app ? words.chat.emptyReads(app.name) : words.chat.empty }}</p>
          <div v-if="quickActions.length > 0" class="flex flex-wrap gap-1.5">
            <UButton
              v-for="action in quickActions"
              :key="action.label"
              :label="action.label"
              color="neutral"
              variant="outline"
              size="sm"
              data-testid="chat-quick-action"
              @click="send(action.prompt)"
            />
          </div>
        </div>
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
        <GrantCard
          v-if="asking !== null && provider"
          :provider="provider"
          :title="words.consent.title(provider.name)"
          :lines="sendLines"
          :caution="promptSendsDocument ? words.files.goesWhole : undefined"
          :offers-always="switchApp !== null"
          @allow="allowInChat"
          @always="allowAlways"
          @cancel="asking = null"
        />
        <GrantCard
          v-else-if="chatAsking !== null && provider"
          :key="chatAsking.app"
          :provider="provider"
          :title="words.chat.readTitle(chatAsking.name)"
          :lines="readLines"
          :offers-always="asksAlways"
          @allow="answerReadAsk('chat')"
          @always="answerReadAsk('always')"
          @cancel="answerReadAsk('no')"
        />
        <div v-if="chatElement" class="flex min-w-0 items-center gap-1" data-testid="chat-tag">
          <RemovableChip icon="i-lucide-sparkles" :label="chatElement.label" :remove-label="words.chat.removeTag(chatElement.label)" data-testid="chat-tag-remove" @remove="removeChatElement" />
        </div>
        <UChatPrompt v-model="chatDraft" :placeholder="placeholder" :autofocus="!phone" :disabled="held" variant="subtle" :maxrows="6" class="chat-prompt" data-testid="chat-prompt" @submit="submit">
          <template #header>
            <PromptFiles :says-goes-whole="asking === null" />
          </template>
          <template #footer>
            <div class="flex items-center gap-1">
              <UButton
                icon="i-lucide-paperclip"
                color="neutral"
                variant="ghost"
                size="sm"
                :disabled="held"
                :aria-label="words.files.attach"
                :title="words.files.attach"
                data-testid="chat-attach"
                @click="picker?.click()"
              />
              <UButton
                v-if="phone"
                icon="i-lucide-camera"
                color="neutral"
                variant="ghost"
                size="sm"
                :disabled="held"
                :aria-label="words.files.takePhoto"
                :title="words.files.takePhoto"
                data-testid="chat-camera"
                @click="camera?.click()"
              />
              <input ref="picker" type="file" multiple :accept="ATTACHABLE" class="hidden" data-testid="chat-attach-input" @change="picked" />
              <input v-if="phone" ref="camera" type="file" accept="image/*" capture="environment" class="hidden" data-testid="chat-camera-input" @change="picked" />
            </div>
            <UChatPromptSubmit
              :status="chatStatus"
              :disabled="(chatDraft.trim() === '' && chatStatus === 'ready') || asking !== null || readingFiles"
              color="neutral"
              data-testid="chat-send"
              @stop="stopChatMessage"
            />
          </template>
        </UChatPrompt>
        <p v-if="chatSpent" class="type-caption" data-testid="chat-spent">{{ words.chat.spent(chatSpent) }}</p>
      </div>
    </div>
  </section>
</template>
