<script lang="ts">
import type { MailWindow } from '../domain/mailSource'

/** One search of the mail as a list shows it: the window it searched, why it started there, and its query. */
export interface MailSearchShown {
  readonly window: MailWindow
  readonly query: string
  /** Why the window starts where it does, after a week before the newest one or on the first day, in the words of the app. */
  readonly why: { readonly newest: string; readonly since: string }
}

/** How one entry of a search shows: its mark, its first line unless the slot draws it, the line of its mail and a note. */
export interface MailResultRow {
  readonly key: string
  /** The entry's kind, which the row carries for the checks. */
  readonly kind: string
  readonly icon: string
  /** `text-success`, `text-warning` or `text-error`. */
  readonly tone: string
  readonly first: string
  readonly mailLine: string
  readonly note: string
}
</script>

<script setup lang="ts" generic="Entry">
import { computed, ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { dateFormat } from '../../calendar/dateFormat'
import ShowAllButton, { FIRST_SHOWN } from '../../ui/ShowAllButton.vue'
import { words } from './words'

/** What one search of the mail found: a heading the app gives, where the search started and its query, then a row per entry, the first ten until Show all. */
const props = defineProps<{
  /** Null for a search that stopped before it ran. */
  search: MailSearchShown | null
  entries: readonly Entry[]
  rowOf: (entry: Entry, index: number) => MailResultRow
}>()

defineSlots<{
  heading?: () => unknown
  first?: (scope: { entry: Entry }) => unknown
}>()

const dayFormat = dateFormat({ day: 'numeric', month: 'short', year: 'numeric' })

const searched = computed(() => {
  const search = props.search
  if (search === null) return ''
  return words.plan.searchedFrom(dayFormat(new Date(search.window.from)), search.window.after === 'newest' ? search.why.newest : search.why.since)
})

const expanded = ref(false)
const rows = computed(() => (expanded.value ? props.entries : props.entries.slice(0, FIRST_SHOWN)).map((entry, index) => ({ entry, row: props.rowOf(entry, index) })))
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex flex-col gap-0.5">
      <slot name="heading" />
      <template v-if="search !== null">
        <p class="figure type-caption" data-testid="mail-source-window">{{ searched }}</p>
        <p class="identifier type-caption wrap-anywhere">{{ search.query }}</p>
      </template>
    </div>
    <ul v-if="entries.length > 0" class="flex flex-col divide-y divide-default">
      <li v-for="{ entry, row } in rows" :key="row.key" class="flex items-start gap-2 py-2" :data-entry="row.kind" data-testid="mail-entry">
        <UIcon :name="row.icon" class="mt-0.5 size-4 shrink-0" :class="row.tone" aria-hidden="true" />
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <p class="min-w-0 type-body break-words">
            <slot name="first" :entry="entry">{{ row.first }}</slot>
          </p>
          <p class="type-caption break-words">{{ row.mailLine }}</p>
          <p v-if="row.note !== ''" class="type-caption break-words text-toned">{{ row.note }}</p>
        </div>
      </li>
    </ul>
    <ShowAllButton v-if="entries.length > FIRST_SHOWN" v-model:expanded="expanded" :total="entries.length" />
  </section>
</template>
