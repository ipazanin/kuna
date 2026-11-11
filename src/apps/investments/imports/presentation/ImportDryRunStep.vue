<script setup lang="ts">
import { computed } from 'vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { dryRunGroups, dryRunSummary } from './dryRunLines'
import type { ImportLine } from './dryRunLines'
import { accountNamer } from '../domain/importChoices'
import type { SettledImport } from '../domain/importChoices'
import ImportLines from './ImportLines.vue'
import type { WorkbookImport } from './useWorkbookImport'
import { words } from './words'
import { transactionCount } from '../../transactions/domain/listedTransactions'
import { formatCount } from '../../../../shared/money/moneyFormat'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { plural } from '../../../../shared/text/translation'

/** What Import would write, and what it holds back, skips, finds gone from the workbook or rounds, nothing of it written yet. */
const props = defineProps<{
  workbookImport: WorkbookImport
  settled: SettledImport
  /** How many records gone from the workbook are ticked to be deleted. */
  deleting: number
}>()

const groups = computed(() => {
  const book = props.workbookImport.book.value
  if (book === null) return null
  return dryRunGroups(props.settled.dryRun, book, props.workbookImport.rates.value, accountNamer(props.settled, book.accounts))
})

const summary = computed(() => {
  const { added } = props.settled.dryRun
  return dryRunSummary(added, transactionCount(added), props.settled.dryRun.matched.length, props.deleting)
})

const sections = computed((): { readonly id: string; readonly title: string; readonly intro: string; readonly lines: readonly ImportLine[]; readonly warns: boolean; readonly verbatim: boolean }[] => {
  const run = groups.value
  if (run === null) return []
  return [
    { id: 'new', title: words.dryRun.groups.new, intro: '', lines: run.fresh, warns: false, verbatim: false },
    { id: 'waiting', title: words.dryRun.groups.waiting, intro: words.dryRun.waitingIntro, lines: run.waiting, warns: true, verbatim: false },
    {
      id: 'asked',
      title: words.dryRun.groups.asked,
      intro: words.dryRun.askedIntro,
      lines: run.asked.filter((line) => props.workbookImport.choices.value.asked[line.key] !== 'leave-out'),
      warns: true,
      verbatim: true,
    },
    { id: 'skipped', title: words.dryRun.groups.skipped, intro: words.dryRun.skippedIntro, lines: run.skipped, warns: true, verbatim: false },
    { id: 'in-kuna', title: words.dryRun.groups.inKuna, intro: '', lines: run.inKuna, warns: false, verbatim: false },
  ].filter((section) => section.lines.length > 0)
})

const beforeStart = computed(() => props.settled.dryRun.report?.beforeStart ?? 0)

const ticked = (id: RecordId): boolean => props.workbookImport.deleting.value.has(id)
</script>

<template>
  <div class="flex flex-col gap-6" data-testid="import-dry-run">
    <div class="flex flex-col gap-1">
      <p class="type-body text-highlighted" data-testid="import-dry-run-summary">{{ summary }}</p>
      <p v-if="beforeStart > 0" class="type-caption" data-testid="import-before-start">{{ plural(words.dryRun.beforeStart(beforeStart), beforeStart) }}</p>
    </div>

    <section v-for="section in sections" :key="section.id" class="flex flex-col gap-1" :data-testid="`import-group-${section.id}`">
      <h3 class="flex items-baseline gap-2">
        <span class="type-card-title">{{ section.title }}</span>
        <span class="figure type-caption">{{ formatCount(section.lines.length) }}</span>
      </h3>
      <p v-if="section.intro !== ''" class="type-caption">{{ section.intro }}</p>
      <ImportLines :lines="section.lines" :warns="section.warns" :verbatim="section.verbatim" />
    </section>

    <section v-if="groups && groups.gone.length > 0" class="flex flex-col gap-1" data-testid="import-group-gone">
      <h3 class="flex items-baseline gap-2">
        <span class="type-card-title">{{ words.dryRun.groups.gone }}</span>
        <span class="figure type-caption">{{ formatCount(groups.gone.length) }}</span>
      </h3>
      <p class="type-caption">{{ words.dryRun.goneIntro }}</p>
      <ul class="flex flex-col">
        <li v-for="gone in groups.gone" :key="gone.line.key" class="flex flex-col gap-2 border-t border-default py-3 first:border-t-0" data-testid="import-gone">
          <p v-if="gone.now" class="flex items-center gap-2 type-label">
            <UIcon name="i-lucide-pencil-line" class="size-4 shrink-0 text-muted" aria-hidden="true" />
            {{ words.dryRun.edited }}
          </p>
          <div class="grid gap-x-6 gap-y-2" :class="{ 'sm:grid-cols-2': gone.now }">
            <div class="flex min-w-0 flex-col gap-1" data-testid="import-gone-record">
              <span v-if="gone.now" class="type-caption">{{ words.dryRun.inKunaNow }}</span>
              <ImportLines :lines="[gone.line]" />
            </div>
            <div v-if="gone.now" class="flex min-w-0 flex-col gap-1" data-testid="import-gone-now">
              <span class="type-caption">{{ words.dryRun.inWorkbookNow }}</span>
              <ImportLines :lines="[gone.now]" />
            </div>
          </div>
          <UCheckbox
            :model-value="ticked(gone.record.record.id)"
            :label="words.dryRun.delete"
            data-testid="import-gone-delete"
            @update:model-value="workbookImport.markDeleting(gone.record.record.id, $event === true)"
          />
          <p v-if="gone.now && !ticked(gone.record.record.id)" class="type-caption" data-testid="import-gone-kept">{{ words.dryRun.keptBeside }}</p>
        </li>
      </ul>
    </section>

    <section v-if="groups && (groups.reversals.length > 0 || groups.rounded.length > 0 || groups.commissions.length > 0)" class="flex flex-col gap-3" data-testid="import-group-look">
      <h3 class="type-card-title">{{ words.dryRun.groups.look }}</h3>
      <div v-if="groups.reversals.length > 0" class="flex flex-col gap-1" data-testid="import-reversals">
        <p class="type-label">{{ plural(words.dryRun.reversals(groups.reversals.length), groups.reversals.length) }}</p>
        <ul class="flex flex-col gap-1">
          <li v-for="line in groups.reversals" :key="line" class="type-caption break-words">{{ line }}</li>
        </ul>
      </div>
      <div v-if="groups.commissions.length > 0" class="flex flex-col gap-1" data-testid="import-commissions">
        <p class="type-label">{{ plural(words.dryRun.commissions(groups.commissions.length), groups.commissions.length) }}</p>
        <ul class="flex flex-col gap-1">
          <li v-for="line in groups.commissions" :key="line" class="type-caption break-words">{{ line }}</li>
        </ul>
      </div>
      <div v-if="groups.rounded.length > 0" class="flex flex-col gap-1" data-testid="import-rounded">
        <p class="type-label">{{ plural(words.dryRun.rounded(groups.rounded.length), groups.rounded.length) }}</p>
        <ul class="flex flex-col gap-1">
          <li v-for="line in groups.rounded" :key="line" class="type-caption break-words">{{ line }}</li>
        </ul>
      </div>
    </section>
  </div>
</template>
