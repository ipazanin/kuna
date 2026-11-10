<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import type { DeepReadonly } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { CheckedProposal, ProposalGroup } from '../../app/assistantOperations'
import { formatCount } from '../../money/moneyFormat'
import { language } from '../../text/language'
import { listInWords } from '../../text/listInWords'
import { plural } from '../../text/translation'
import AppCard from '../../ui/AppCard.vue'
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

const NOTE_ICONS = { info: 'i-lucide-message-circle-question', warning: 'i-lucide-triangle-alert', neutral: 'i-lucide-info' } as const

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
      <p v-if="readFiles !== null" class="flex items-start gap-1.5 type-caption wrap-anywhere" data-testid="chat-proposal-read-files">
        <UIcon name="i-lucide-file-search" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {{ readFiles }}
      </p>
      <div v-for="(group, at) in shownGroups" :key="at" class="flex flex-col gap-1.5" data-testid="chat-proposal-group">
        <p v-if="group.lines.length > 0" class="type-caption" data-testid="chat-proposal-group-count">{{ countedNoun(group) }}</p>
        <UAlert
          v-for="(note, noteAt) in group.notes"
          :key="noteAt"
          :icon="NOTE_ICONS[note.tone]"
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
            <ul class="mt-1.5 flex flex-col gap-1" data-testid="chat-proposal-note-items">
              <li v-for="(item, itemAt) in shownOf(note.items ?? [], `note-${at}-${noteAt}`)" :key="itemAt" class="wrap-anywhere">{{ item.row }} → {{ item.record }}</li>
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
            <p class="type-body wrap-anywhere text-highlighted">{{ line.label }}</p>
            <p v-if="line.warning !== null" class="flex items-start gap-1 type-caption text-warning" data-testid="chat-proposal-line-warning">
              <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {{ line.warning }}
            </p>
            <template v-for="field in line.fields" :key="field.name">
              <p class="type-caption wrap-anywhere" :class="{ 'text-warning': field.warns }" data-testid="chat-proposal-field">
                {{ field.name }}: <template v-if="field.before !== null">{{ field.before }} → </template>{{ field.after ?? words.proposal.empty }}
              </p>
              <p v-if="field.warns" class="flex items-start gap-1 type-caption text-warning" data-testid="chat-proposal-warning">
                <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {{ words.proposal.warns }}
              </p>
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
        <li v-for="line in outside" :key="line" class="flex items-start gap-1.5 type-caption wrap-anywhere">
          <UIcon name="i-lucide-info" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {{ line }}
        </li>
        <li v-if="noUndo && proposal.state === 'open'" class="flex items-start gap-1.5 type-caption text-warning" data-testid="chat-proposal-no-undo-note">
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {{ words.proposal.noUndoNote }}
        </li>
      </ul>
      <p v-if="proposal.state === 'open' && proposal.goesOn" class="flex items-start gap-1.5 type-caption wrap-anywhere" data-testid="chat-proposal-goes-on">
        <UIcon name="i-lucide-arrow-right" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {{ words.proposal.goesOn }}
      </p>
      <div v-if="proposal.state === 'open'" class="flex flex-wrap justify-end gap-2">
        <UButton :label="words.proposal.notNow" color="neutral" variant="ghost" size="sm" :disabled="working" data-testid="chat-proposal-decline" @click="settleProposal(held, 'declined')" />
        <UButton :label="words.proposal.accept" size="sm" :loading="working" :disabled="working" data-testid="chat-proposal-accept" @click="accept" />
      </div>
      <div v-else-if="proposal.state === 'done'" class="flex flex-wrap items-center justify-between gap-2">
        <p class="flex items-center gap-1.5 type-body text-success" role="status" data-testid="chat-proposal-done">
          <UIcon name="i-lucide-circle-check" class="size-4 shrink-0" aria-hidden="true" />
          {{ words.proposal.done }}
        </p>
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
          <p class="flex items-start gap-1.5 type-caption wrap-anywhere text-warning" role="status" data-testid="chat-proposal-done-warning">
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {{ proposal.warning.text }}
          </p>
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
        <p v-if="proposal.reason !== null" class="flex basis-full items-start gap-1.5 type-caption wrap-anywhere text-error" role="status" data-testid="chat-proposal-undo-refused">
          <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {{ proposal.reason }}
        </p>
      </div>
      <p v-else-if="proposal.state === 'refused'" class="flex items-start gap-1.5 type-body wrap-anywhere text-error" role="status" data-testid="chat-proposal-refused">
        <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {{ proposal.reason === null ? words.proposal.refusedBeforeReload : words.proposal.notWritten(proposal.reason) }}
      </p>
      <p v-else class="type-caption" role="status" data-testid="chat-proposal-over">{{ endedWords }}</p>
    </div>
  </AppCard>
</template>
