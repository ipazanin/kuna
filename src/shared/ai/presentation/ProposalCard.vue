<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import type { DeepReadonly } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { CheckedProposal, ProposalGroup } from '../../app/assistantOperations'
import { formatCount } from '../../money/moneyFormat'
import { language } from '../../text/language'
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
const allShown = ref<ReadonlySet<number>>(new Set())

const held = computed(() => props.proposal as ChatProposal)
const groups = computed(() => held.value.checked?.groups ?? [])
/** The lines stay while the card waits and once it is written, so a person still sees what Done and Undo are about. */
const shownGroups = computed(() => (props.proposal.state === 'open' || props.proposal.state === 'done' ? groups.value : []))
/** What Accept does outside the books, and whether it has no Undo, shown while the card waits and once it is written. */
const outside = computed(() => (props.proposal.state === 'open' || props.proposal.state === 'done' ? (held.value.checked?.outside ?? []) : []))
const noUndo = computed(() => held.value.checked?.undoable === false)
const summary = computed(() => plural(words.proposal.changes(props.proposal.count), props.proposal.count))
const title = computed(() => shownOnScreen(props.proposal.title))
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

function linesOf(group: ProposalGroup, at: number): ProposalGroup['lines'] {
  return allShown.value.has(at) || group.lines.length <= SHOWN + 1 ? group.lines : group.lines.slice(0, SHOWN)
}

function showAll(at: number): void {
  allShown.value = new Set([...allShown.value, at])
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
      <div v-for="(group, at) in shownGroups" :key="at" class="flex flex-col gap-1.5" data-testid="chat-proposal-group">
        <p class="type-caption">{{ countedNoun(group) }}</p>
        <ul class="flex flex-col gap-1.5">
          <li v-for="(line, lineAt) in linesOf(group, at)" :key="lineAt" class="flex min-w-0 flex-col" data-testid="chat-proposal-line">
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
          v-if="linesOf(group, at).length < group.lines.length"
          :label="words.proposal.showAll(formatCount(group.lines.length))"
          color="neutral"
          variant="link"
          size="sm"
          class="self-start px-0"
          data-testid="chat-proposal-all"
          @click="showAll(at)"
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
        {{ proposal.reason ?? words.proposal.refused }}
      </p>
      <p v-else class="type-caption" role="status" data-testid="chat-proposal-over">{{ endedWords }}</p>
    </div>
  </AppCard>
</template>
