<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import type { DeepReadonly } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { CheckedProposal, ProposalGroup } from '../../app/assistantOperations'
import { formatCount } from '../../money/moneyFormat'
import { language } from '../../text/language'
import { listInWords } from '../../text/listInWords'
import { plural } from '../../text/translation'
import AppCard from '../../ui/AppCard.vue'
import NoteLine from '../../ui/NoteLine.vue'
import { TONE_ICONS } from '../../ui/toneText'
import { CHAT_APPS } from './chatApps'
import { settleProposal, shownOnScreen, undoProposal } from './chatSession'
import type { ChatProposal } from './chatSession'
import { words } from './words'

/**
 * What the chat proposes, in Kuna's words from the app's dry run, with the model's title apart. The only way a proposal
 * reaches a write: a person's tap here, one write with one Undo. It is the only file that reaches an app's acceptance.
 */
const props = defineProps<{
  proposal: DeepReadonly<ChatProposal>
}>()

const SHOWN = 3
const apps = inject(CHAT_APPS, [])
const working = ref(false)
const allShown = ref<ReadonlySet<string>>(new Set())

const held = computed(() => props.proposal as ChatProposal)
const groups = computed(() => held.value.checked?.groups ?? [])
/** The lines stay while the card waits and once it is written, so a person still sees what Done and Undo are about. */
const shownGroups = computed(() => (props.proposal.state === 'open' || props.proposal.state === 'done' ? groups.value : []))
/** What Accept does outside the books, and whether it has no Undo, shown while the card waits and once it is written. */
const outside = computed(() => (props.proposal.state === 'open' || props.proposal.state === 'done' ? (held.value.checked?.outside ?? []) : []))
const noUndo = computed(() => held.value.checked?.undoable === false)
const summary = computed(() => plural(words.proposal.changes(props.proposal.count), props.proposal.count))
const title = computed(() => shownOnScreen(props.proposal.title))
const readFiles = computed(() => (props.proposal.readFiles.length === 0 ? null : words.proposal.madeAfterReading(listInWords(props.proposal.readFiles))))
const endedWords = computed(() => {
  switch (props.proposal.state) {
    case 'undone':
      return words.proposal.undone
    case 'declined':
      return words.proposal.declined
    case 'undo-ended':
      return words.proposal.undoEnded
    default:
      return words.proposal.ended
  }
})

function countedNoun(group: ProposalGroup): string {
  const count = group.lines.length
  const { en, hr } = group.noun
  const noun = language === 'hr' ? plural({ one: hr.one, few: hr.few, other: hr.other }, count) : plural({ one: en.one, other: en.many }, count)
  return `${words.proposal.verb[group.verb]}: ${formatCount(count)} ${noun}`
}

/** The first few of a list, or all of it once a person asked or when hiding the rest would save a single row. */
function shownOf<Row>(rows: readonly Row[], place: string): readonly Row[] {
  return allShown.value.has(place) || rows.length <= SHOWN + 1 ? rows : rows.slice(0, SHOWN)
}

function showAll(place: string): void {
  allShown.value = new Set([...allShown.value, place])
}

/** An info note waits on the person's answer, so it shows a question. A neutral one only tells. */
function noteIcon(tone: ProposalGroup['notes'][number]['tone']): string {
  return tone === 'info' ? 'i-lucide-message-circle-question' : TONE_ICONS[tone === 'neutral' ? 'info' : tone]
}

/** A real tap only, so nothing a page script fires can accept. */
async function accept(event: Event): Promise<void> {
  const checked: CheckedProposal | null = held.value.checked
  if (!event.isTrusted || checked === null || working.value) return
  working.value = true
  try {
    const assistant = await apps.find((app) => app.id === props.proposal.app)?.assistant()
    const result = await assistant?.acceptance?.accept(checked)
    if (result === undefined) return
    if (result.kind === 'done') {
      settleProposal(held.value, 'done', null, result.undo, result.warning ?? null)
    } else {
      settleProposal(held.value, 'refused', result.reason)
    }
  } catch {
    settleProposal(held.value, 'refused', words.proposal.failed)
  } finally {
    working.value = false
  }
}

async function undo(event: Event): Promise<void> {
  if (!event.isTrusted || held.value.undo === null || working.value) return
  working.value = true
  try {
    await undoProposal(held.value)
  } finally {
    working.value = false
  }
}
</script>

<template>
  <AppCard as="section" class="mt-2" data-testid="chat-proposal" :data-state="proposal.state">
    <div class="flex flex-col gap-2 px-4 pt-3 pb-4 sm:px-5">
      <div class="flex flex-col">
        <p class="type-label" data-testid="chat-proposal-count">{{ summary }}</p>
        <p class="type-caption wrap-anywhere">{{ title }}</p>
      </div>
      <NoteLine v-if="readFiles !== null" icon="i-lucide-file-search" data-testid="chat-proposal-read-files">{{ readFiles }}</NoteLine>
      <div v-for="(group, at) in shownGroups" :key="at" class="flex flex-col gap-1.5" data-testid="chat-proposal-group">
        <p v-if="group.lines.length > 0" class="type-caption" data-testid="chat-proposal-group-count">{{ countedNoun(group) }}</p>
        <UAlert
          v-for="(note, noteAt) in group.notes"
          :key="noteAt"
          :icon="noteIcon(note.tone)"
          :color="note.tone"
          variant="subtle"
          :title="note.label"
          :description="note.text"
          :ui="{ title: 'wrap-anywhere', description: 'wrap-anywhere' }"
          data-testid="chat-proposal-note"
          :data-tone="note.tone"
        >
          <template v-if="(note.items ?? []).length > 0" #description>
            <p class="wrap-anywhere">{{ note.text }}</p>
            <ul class="mt-1.5 flex flex-col gap-2" data-testid="chat-proposal-note-items">
              <li v-for="(item, itemAt) in shownOf(note.items ?? [], `note-${at}-${noteAt}`)" :key="itemAt" class="flex flex-col wrap-anywhere" data-testid="chat-proposal-note-item">
                <span
                  ><strong class="font-medium">{{ words.proposal.lookAlikeCopied }}</strong> {{ item.row }}</span
                >
                <span
                  ><strong class="font-medium">{{ words.proposal.lookAlikeInKuna }}</strong> {{ item.record }}</span
                >
              </li>
            </ul>
            <UButton
              v-if="shownOf(note.items ?? [], `note-${at}-${noteAt}`).length < (note.items ?? []).length"
              :label="words.proposal.showAll(formatCount((note.items ?? []).length))"
              color="neutral"
              variant="link"
              size="sm"
              class="mt-1 px-0"
              data-testid="chat-proposal-note-all"
              @click="showAll(`note-${at}-${noteAt}`)"
            />
          </template>
        </UAlert>
        <ul class="flex flex-col gap-1.5">
          <li v-for="(line, lineAt) in shownOf(group.lines, `lines-${at}`)" :key="lineAt" class="flex min-w-0 flex-col" data-testid="chat-proposal-line">
            <p class="wrap-anywhere text-highlighted" :class="line.identifier === true ? 'identifier' : 'type-body'">{{ line.label }}</p>
            <NoteLine v-if="line.warning !== null" tone="warning" data-testid="chat-proposal-line-warning">{{ line.warning }}</NoteLine>
            <template v-for="field in line.fields" :key="field.name">
              <p class="type-caption wrap-anywhere" :class="{ 'text-warning': field.warns }" data-testid="chat-proposal-field">
                {{ field.name }}: <template v-if="field.before !== null">{{ field.before }} → </template>{{ field.after ?? words.proposal.empty }}
              </p>
              <NoteLine v-if="field.warns" tone="warning" data-testid="chat-proposal-warning">{{ words.proposal.warns }}</NoteLine>
            </template>
          </li>
        </ul>
        <UButton
          v-if="shownOf(group.lines, `lines-${at}`).length < group.lines.length"
          :label="words.proposal.showAll(formatCount(group.lines.length))"
          color="neutral"
          variant="link"
          size="sm"
          class="self-start px-0"
          data-testid="chat-proposal-all"
          @click="showAll(`lines-${at}`)"
        />
      </div>
      <ul v-if="outside.length > 0 || (noUndo && proposal.state === 'open')" class="flex flex-col gap-1" data-testid="chat-proposal-outside">
        <NoteLine v-for="line in outside" :key="line" as="li">{{ line }}</NoteLine>
        <NoteLine v-if="noUndo && proposal.state === 'open'" as="li" tone="warning" data-testid="chat-proposal-no-undo-note">{{ words.proposal.noUndoNote }}</NoteLine>
      </ul>
      <NoteLine v-if="proposal.state === 'open' && proposal.goesOn" icon="i-lucide-arrow-right" data-testid="chat-proposal-goes-on">{{ words.proposal.goesOn }}</NoteLine>
      <div v-if="proposal.state === 'open'" class="flex flex-wrap justify-end gap-2">
        <UButton :label="words.proposal.notNow" color="neutral" variant="ghost" size="sm" :disabled="working" data-testid="chat-proposal-decline" @click="settleProposal(held, 'declined')" />
        <UButton :label="words.proposal.accept" size="sm" :loading="working" :disabled="working" data-testid="chat-proposal-accept" @click="accept" />
      </div>
      <div v-else-if="proposal.state === 'done'" class="flex flex-wrap items-center justify-between gap-2">
        <NoteLine size="body" tone="success" role="status" data-testid="chat-proposal-done">{{ words.proposal.done }}</NoteLine>
        <UButton
          v-if="held.undo !== null"
          :label="words.proposal.undo"
          color="neutral"
          variant="outline"
          size="sm"
          :loading="working"
          :disabled="working"
          data-testid="chat-proposal-undo"
          @click="undo"
        />
        <p v-else-if="noUndo" class="type-caption" data-testid="chat-proposal-no-undo">{{ words.proposal.noUndo }}</p>
        <div v-if="proposal.warning !== null" class="flex basis-full flex-col items-start gap-1.5">
          <NoteLine tone="warning" role="status" data-testid="chat-proposal-done-warning">{{ proposal.warning.text }}</NoteLine>
          <UButton
            v-if="proposal.warning.link !== null"
            :to="proposal.warning.link.to"
            :label="proposal.warning.link.label"
            trailing-icon="i-lucide-arrow-right"
            color="neutral"
            variant="outline"
            size="sm"
            data-testid="chat-proposal-done-link"
          />
        </div>
        <NoteLine v-if="proposal.reason !== null" tone="error" class="basis-full" role="status" data-testid="chat-proposal-undo-refused">{{ proposal.reason }}</NoteLine>
      </div>
      <NoteLine v-else-if="proposal.state === 'refused'" size="body" tone="error" role="status" data-testid="chat-proposal-refused">{{
        proposal.reason === null ? words.proposal.refusedBeforeReload : words.proposal.notWritten(proposal.reason)
      }}</NoteLine>
      <p v-else class="type-caption" role="status" data-testid="chat-proposal-over">{{ endedWords }}</p>
    </div>
  </AppCard>
</template>
