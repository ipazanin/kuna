<script setup lang="ts">
import { computed, reactive } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import ShowAllButton, { FIRST_SHOWN } from '../../../shared/ui/ShowAllButton.vue'
import { countsLine } from '../domain/mailSource'
import { mailCounts, notFiledLine } from '../application/mailFiling'
import type { MailPlan, PlanEntry, SourcePlan } from '../application/mailFiling'

/** What the last mail step found, one block per source: its search, then each attachment with where it went or would go, or why it did not. */
const props = defineProps<{
  plan: MailPlan | null
  /** Why the last mail step stopped before it had a plan, or null. */
  stopped: string | null
}>()

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** The kinds in the order a person reads them: what failed, what was or would be filed, what needs a look, then what is already there. */
const ORDER: readonly PlanEntry['kind'][] = ['not-filed', 'filed', 'file', 'correction', 'unchecked', 'unmatched', 'already']

const ICONS: Readonly<Record<PlanEntry['kind'], { readonly name: string; readonly tone: string; readonly words: string }>> = {
  'not-filed': { name: 'i-lucide-file-x', tone: 'text-error', words: 'Not filed' },
  filed: { name: 'i-lucide-file-check', tone: 'text-[var(--tone-positive)]', words: 'Filed' },
  file: { name: 'i-lucide-file-plus', tone: 'text-highlighted', words: 'Would file' },
  correction: { name: 'i-lucide-file-diff', tone: 'text-warning', words: 'Correction' },
  unchecked: { name: 'i-lucide-file-question-mark', tone: 'text-warning', words: 'Not compared' },
  unmatched: { name: 'i-lucide-mail-x', tone: 'text-warning', words: 'Unmatched' },
  already: { name: 'i-lucide-check', tone: 'text-[var(--tone-positive)]', words: 'Already there' },
}

const expanded = reactive<Record<string, boolean>>({})

const sources = computed(() =>
  (props.plan?.sources ?? []).map((source) => ({
    source,
    entries: source.kind === 'planned' ? [...source.entries].sort((first, second) => ORDER.indexOf(first.kind) - ORDER.indexOf(second.kind)) : [],
  })),
)

function headline(source: SourcePlan): string {
  return source.kind === 'failed' ? source.reason.replace(/\.?$/, '.') : [`${countsLine(mailCounts(source.entries))}.`, notFiledLine(source.entries) ?? ''].join(' ').trim()
}

function searched(source: Extract<SourcePlan, { kind: 'planned' }>): string {
  const from = dayFormat.format(new Date(source.window.from))
  return source.window.after === 'newest' ? `Searched from ${from}, a week before the newest file in its folder` : `Searched from ${from}, the mail-since day`
}

function shown(id: string, entries: readonly PlanEntry[]): readonly PlanEntry[] {
  return expanded[id] === true ? entries : entries.slice(0, FIRST_SHOWN)
}

/** The folders and the name of where an entry goes, each folder with its slash, so a narrow screen breaks the path after a slash. */
function target(entry: Exclude<PlanEntry, { kind: 'unmatched' }>): string[] {
  return [...entry.path.map((folder) => `${folder}/`), entry.name]
}

function mailWords(entry: PlanEntry): string {
  return `“${entry.mail.subject}”, ${dayFormat.format(new Date(entry.mail.date))}`
}

function note(entry: PlanEntry): string {
  switch (entry.kind) {
    case 'correction':
      return entry.filedByApp ? 'An older copy has other bytes. The app filed it, so it would replace it.' : 'An older copy has other bytes. Another app filed it, so swap it by hand.'
    case 'unchecked':
      return 'An older copy is there, and Drive gives no SHA-256 for it, so the bytes were not compared.'
    case 'unmatched':
    case 'not-filed':
      return entry.reason.replace(/\.?$/, '.')
    default:
      return ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-5" data-testid="mail-plan">
    <p v-if="stopped !== null" class="text-sm text-muted" data-testid="mail-stopped">{{ stopped }}</p>
    <p v-else-if="plan === null" class="text-sm text-muted">No sync on this page has looked at the mail yet. Sync to file the bank's new statements.</p>
    <p v-else-if="plan.sources.length === 0" class="text-sm text-muted">No kind of mail is on, so the last sync looked at none.</p>
    <section v-for="{ source, entries } in sources" :key="source.id" class="flex flex-col gap-2" :data-source="source.id" :data-state="source.kind">
      <div class="flex flex-col gap-0.5">
        <h3 class="text-sm font-medium text-highlighted">{{ source.label }}</h3>
        <p class="text-sm" :class="source.kind === 'failed' ? 'text-error' : 'text-toned'" data-testid="mail-source-line">{{ headline(source) }}</p>
        <template v-if="source.kind === 'planned'">
          <p class="figure text-xs text-muted" data-testid="mail-source-window">{{ searched(source) }}</p>
          <p class="identifier text-xs wrap-anywhere text-muted">{{ source.query }}</p>
        </template>
      </div>
      <ul v-if="entries.length" class="flex flex-col divide-y divide-default">
        <li v-for="(entry, index) in shown(source.id, entries)" :key="`${entry.mail.id}-${entry.attachment}-${index}`" class="flex items-start gap-2 py-2" :data-entry="entry.kind">
          <UIcon :name="ICONS[entry.kind].name" class="mt-0.5 size-4 shrink-0" :class="ICONS[entry.kind].tone" aria-hidden="true" />
          <div class="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
            <p class="min-w-0 text-toned">
              <span class="sr-only">{{ ICONS[entry.kind].words }}: </span>
              <span v-if="entry.kind === 'unmatched'" class="break-words text-highlighted">{{ entry.attachment }}</span>
              <span v-else class="identifier break-words text-highlighted"><template v-for="part in target(entry)" :key="part">{{ part }}<wbr /></template></span>
            </p>
            <p class="text-xs break-words text-muted">
              {{ ICONS[entry.kind].words }}. {{ entry.kind === 'unmatched' ? '' : `${entry.attachment}, from ` }}{{ mailWords(entry) }}
            </p>
            <p v-if="note(entry)" class="text-xs break-words text-toned">{{ note(entry) }}</p>
          </div>
        </li>
      </ul>
      <ShowAllButton v-if="entries.length > FIRST_SHOWN" :expanded="expanded[source.id] === true" :total="entries.length" @update:expanded="expanded[source.id] = $event" />
    </section>
  </div>
</template>
