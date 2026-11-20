<script setup lang="ts">
import { computed } from 'vue'

import { dateFormat } from '../../../../shared/calendar/dateFormat'
import MailSearchResults from '../../../../shared/mail/presentation/MailSearchResults.vue'
import type { MailResultRow, MailSearchShown } from '../../../../shared/mail/presentation/MailSearchResults.vue'
import { words as mailWords } from '../../../../shared/mail/presentation/words'
import type { StatementMailEntry, StatementMailPlan } from '../application/statementMail'
import { words } from './words'

/** What the last sync found in the bank's mail: where it searched, then each attachment with what it gave, statements first. */
const props = defineProps<{
  plan: StatementMailPlan | null
  /** Why the last mail step stopped before it had a plan, or null. */
  stopped: string | null
}>()

const dayFormat = dateFormat({ day: 'numeric', month: 'short', year: 'numeric' })

/** The kinds in the order a person reads them: what was not read, what was read, then what is passed over. */
const ORDER: readonly StatementMailEntry['kind'][] = ['not-read', 'read', 'passed-over']

const ICONS: Readonly<Record<StatementMailEntry['kind'], { readonly name: string; readonly tone: string }>> = {
  'not-read': { name: 'i-lucide-mail-x', tone: 'text-warning' },
  read: { name: 'i-lucide-file-check', tone: 'text-success' },
  'passed-over': { name: 'i-lucide-file-minus', tone: '' },
}

const entries = computed(() => [...(props.plan?.entries ?? [])].sort((first, second) => ORDER.indexOf(first.kind) - ORDER.indexOf(second.kind)))
const search = computed((): MailSearchShown | null => (props.plan === null ? null : { window: props.plan.window, query: props.plan.query, why: words.card.searchedFrom }))

function note(entry: StatementMailEntry): string {
  return entry.kind === 'read' ? '' : entry.kind === 'not-read' ? entry.reason.replace(/\.?$/, '.') : words.card.passedOver
}

function rowOf(entry: StatementMailEntry, index: number): MailResultRow {
  return {
    key: `${entry.mail.id}-${entry.attachment}-${index}`,
    kind: entry.kind,
    icon: ICONS[entry.kind].name,
    tone: ICONS[entry.kind].tone,
    first: entry.kind === 'read' ? entry.label : entry.attachment,
    mailLine: `${words.card.kinds[entry.kind]}. ${mailWords.plan.mail(entry.mail.subject, dayFormat(new Date(entry.mail.date)))}`,
    note: note(entry),
  }
}
</script>

<template>
  <div class="flex flex-col gap-5" data-testid="mail-plan">
    <p v-if="stopped !== null" class="type-aside" data-testid="mail-stopped">{{ stopped }}</p>
    <p v-else-if="plan === null" class="type-aside">{{ mailWords.plan.noSyncYet }} {{ words.card.syncToRead }}</p>
    <MailSearchResults v-else :search="search" :entries="entries" :row-of="rowOf" />
  </div>
</template>
