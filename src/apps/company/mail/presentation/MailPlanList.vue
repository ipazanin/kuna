<script setup lang="ts">
import { computed, reactive } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { dateFormat } from '../../../../shared/calendar/dateFormat'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import { words as sourceWords } from '../domain/words'
import { mailCounts, notFiledLine } from '../application/mailFiling'
import type { MailPlan, PlanEntry, SourcePlan } from '../application/mailFiling'
import { words } from './words'

/** What the last mail step found, one block per source: its search, then each attachment with where it went, or why it did not. */
const props = defineProps<{
  plan: MailPlan | null
  /** Why the last mail step stopped before it had a plan, or null. */
  stopped: string | null
}>()

const dayFormat = dateFormat({ day: 'numeric', month: 'short', year: 'numeric' })

/** The kinds in the order a person reads them: what failed, what was filed, what needs a look, then what is already there. */
const ORDER: readonly PlanEntry['kind'][] = ['not-filed', 'filed', 'correction', 'unchecked', 'unmatched', 'already']

const ICONS: Readonly<Record<PlanEntry['kind'], { readonly name: string; readonly tone: string }>> = {
  'not-filed': { name: 'i-lucide-file-x', tone: 'text-error' },
  filed: { name: 'i-lucide-file-check', tone: 'text-success' },
  correction: { name: 'i-lucide-file-diff', tone: 'text-warning' },
  unchecked: { name: 'i-lucide-file-question-mark', tone: 'text-warning' },
  unmatched: { name: 'i-lucide-mail-x', tone: 'text-warning' },
  already: { name: 'i-lucide-check', tone: 'text-success' },
}

const expanded = reactive<Record<string, boolean>>({})

const sources = computed(() =>
  (props.plan?.sources ?? []).map((source) => ({
    source,
    entries: source.kind === 'planned' ? [...source.entries].sort((first, second) => ORDER.indexOf(first.kind) - ORDER.indexOf(second.kind)) : [],
  })),
)

function headline(source: SourcePlan): string {
  return source.kind === 'failed' ? source.reason.replace(/\.?$/, '.') : [`${sourceWords.counts(mailCounts(source.entries))}.`, notFiledLine(source.entries) ?? ''].join(' ').trim()
}

function searched(source: Extract<SourcePlan, { kind: 'planned' }>): string {
  const from = dayFormat(new Date(source.window.from))
  return source.window.after === 'newest' ? words.plan.searchedFromNewest(from) : words.plan.searchedFromSince(from)
}

function shown(id: string, entries: readonly PlanEntry[]): readonly PlanEntry[] {
  return expanded[id] === true ? entries : entries.slice(0, FIRST_SHOWN)
}

/** The folders and the name of where an entry goes, each folder with its slash, so a narrow screen breaks the path after a slash. */
function target(entry: Exclude<PlanEntry, { kind: 'unmatched' }>): string[] {
  return [...entry.path.map((folder) => `${folder}/`), entry.name]
}

function mailWords(entry: PlanEntry): string {
  return words.plan.mail(entry.mail.subject, dayFormat(new Date(entry.mail.date)))
}

function note(entry: PlanEntry): string {
  switch (entry.kind) {
    case 'correction':
      return words.plan.correction
    case 'unchecked':
      return words.plan.unchecked
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
    <p v-else-if="plan === null" class="text-sm text-muted">{{ words.plan.noSyncYet }}</p>
    <p v-else-if="plan.sources.length === 0" class="text-sm text-muted">{{ words.plan.noneOn }}</p>
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
              <span class="sr-only">{{ words.plan.kinds[entry.kind] }}: </span>
              <span v-if="entry.kind === 'unmatched'" class="break-words text-highlighted">{{ entry.attachment }}</span>
              <span v-else class="identifier break-words text-highlighted"
                ><template v-for="part in target(entry)" :key="part">{{ part }}<wbr /></template
              ></span>
            </p>
            <p class="text-xs break-words text-muted">{{ words.plan.kinds[entry.kind] }}. {{ entry.kind === 'unmatched' ? '' : words.plan.fromMail(entry.attachment) }}{{ mailWords(entry) }}</p>
            <p v-if="note(entry)" class="text-xs break-words text-toned">{{ note(entry) }}</p>
          </div>
        </li>
      </ul>
      <ShowAllButton v-if="entries.length > FIRST_SHOWN" :expanded="expanded[source.id] === true" :total="entries.length" @update:expanded="expanded[source.id] = $event" />
    </section>
  </div>
</template>
