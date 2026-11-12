<script setup lang="ts">
import { computed } from 'vue'

import { dateFormat } from '../../calendar/dateFormat'
import { words as filingWords } from '../application/words'
import { mailCounts, notFiledLine } from '../application/mailFiling'
import type { MailPlan, PlanEntry, SourcePlan } from '../application/mailFiling'
import MailSearchResults from './MailSearchResults.vue'
import type { MailResultRow, MailSearchShown } from './MailSearchResults.vue'
import { words } from './words'

/** What the last mail step found, one block per source: its search, then each attachment with where it went, or why it did not. */
const props = defineProps<{
  plan: MailPlan | null
  /** Why the last mail step stopped before it had a plan, or null. */
  stopped: string | null
  /** Why each search started where it did, in the words of the setting that sets its first day. */
  why: MailSearchShown['why']
}>()

const dayFormat = dateFormat({ day: 'numeric', month: 'short', year: 'numeric' })

/** The kinds in the order a person reads them: what failed, what was filed, what needs a look, then what is already there. */
const ORDER: readonly PlanEntry['kind'][] = ['not-filed', 'filed', 'unmatched', 'already']

const ICONS: Readonly<Record<PlanEntry['kind'], { readonly name: string; readonly tone: string }>> = {
  'not-filed': { name: 'i-lucide-file-x', tone: 'text-error' },
  filed: { name: 'i-lucide-file-check', tone: 'text-success' },
  unmatched: { name: 'i-lucide-mail-x', tone: 'text-warning' },
  already: { name: 'i-lucide-check', tone: 'text-success' },
}

const sources = computed(() =>
  (props.plan?.sources ?? []).map((source) => ({
    source,
    entries: source.kind === 'planned' ? [...source.entries].sort((first, second) => ORDER.indexOf(first.kind) - ORDER.indexOf(second.kind)) : [],
    search: source.kind === 'planned' ? ({ window: source.window, query: source.query, why: props.why } satisfies MailSearchShown) : null,
  })),
)

function headline(source: SourcePlan): string {
  return source.kind === 'failed' ? source.reason.replace(/\.?$/, '.') : [`${filingWords.counts(mailCounts(source.entries))}.`, notFiledLine(source.entries) ?? ''].join(' ').trim()
}

/** The folders and the name of where an entry goes, each folder with its slash, so a narrow screen breaks the path after a slash. */
function target(entry: Exclude<PlanEntry, { kind: 'unmatched' }>): string[] {
  return [...entry.path.map((folder) => `${folder}/`), entry.name]
}

function note(entry: PlanEntry): string {
  return entry.kind === 'unmatched' || entry.kind === 'not-filed' ? entry.reason.replace(/\.?$/, '.') : ''
}

function rowOf(entry: PlanEntry, index: number): MailResultRow {
  const mail = words.plan.mail(entry.mail.subject, dayFormat(new Date(entry.mail.date)))
  return {
    key: `${entry.mail.id}-${entry.attachment}-${index}`,
    kind: entry.kind,
    icon: ICONS[entry.kind].name,
    tone: ICONS[entry.kind].tone,
    first: entry.attachment,
    mailLine: `${words.plan.kinds[entry.kind]}. ${entry.kind === 'unmatched' ? '' : words.plan.fromMail(entry.attachment)}${mail}`,
    note: note(entry),
  }
}
</script>

<template>
  <div class="flex flex-col gap-5" data-testid="mail-plan">
    <p v-if="stopped !== null" class="type-body text-muted" data-testid="mail-stopped">{{ stopped }}</p>
    <p v-else-if="plan === null" class="type-body text-muted">{{ words.plan.noSyncYet }} {{ words.plan.syncToFile }}</p>
    <p v-else-if="plan.sources.length === 0" class="type-body text-muted">{{ words.plan.noneOn }}</p>
    <MailSearchResults v-for="{ source, entries, search } in sources" :key="source.id" :search="search" :entries="entries" :row-of="rowOf" :data-source="source.id" :data-state="source.kind">
      <template #heading>
        <h3 class="type-card-title">{{ source.label }}</h3>
        <p class="type-body" :class="{ 'text-error': source.kind === 'failed' }" data-testid="mail-source-line">{{ headline(source) }}</p>
      </template>
      <template #first="{ entry }">
        <span class="sr-only">{{ words.plan.kinds[entry.kind] }}: </span>
        <span v-if="entry.kind === 'unmatched'" class="break-words text-highlighted">{{ entry.attachment }}</span>
        <span v-else class="identifier break-words text-highlighted"
          ><template v-for="part in target(entry)" :key="part">{{ part }}<wbr /></template
        ></span>
      </template>
    </MailSearchResults>
  </div>
</template>
