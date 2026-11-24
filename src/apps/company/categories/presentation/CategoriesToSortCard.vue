<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { today } from '../../../../shared/calendar/civilDate'
import { NO_RECORDS, recordWithId } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import ProblemList from '../../workbook-files/presentation/ProblemList.vue'
import { installedPack } from '../../packs/packContribution'
import type { CategoryToSort } from '../../packs/packContribution'
import { DISMISSAL_WRITES, dismissalOfMissingCategory, dismissalOfNewerClass } from '../../rules/application/dismissalWrites'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { Dismissal } from '../../workbook/domain/dismissals'
import { displayNamesOf } from '../../workbook/domain/displayName'
import type { MissingStartingCategory } from '../../workbook/domain/packPart'
import { newestBookingOf, tabProblems } from '../../workbook/domain/workbook'
import type { WorkbookProblem } from '../../workbook/domain/workbook'
import { addStartingCategory } from '../application/startingCategoryWrites'
import { words } from './words'

/**
 * Categories to sort: the categories that do not count one way yet, or not as new books count them, the starting categories the
 * books lack with Add, and below them the suggestions dismissed with Restore. Shown only while something is listed.
 */
const store = useWorkbook()
const { state } = store
const writes = useRecordWrites(store)

/** A line of the card, or a suggestion the person dismissed, which Restore shows again. */
type ToSortLine = WorkbookProblem & CategoryToSort & { readonly dismissal?: Dismissal }

const DISMISSED_KINDS: readonly Dismissal['kind'][] = ['newer-class', 'missing-category']

const toSort = computed((): readonly ToSortLine[] => {
  const workbook = state.workbook
  if (workbook === null) return []
  const names = displayNamesOf(workbook)
  const on = newestBookingOf(workbook.transactions) ?? today()
  const dismissed = workbook.dismissals
    .filter((dismissal) => DISMISSED_KINDS.includes(dismissal.kind))
    .map((dismissal) => ({
      id: dismissal.id,
      label: names.category(dismissal.key),
      reason: dismissal.dismissedOn === null ? words.categoriesToSort.dismissed : words.categoriesToSort.dismissedOn(dayLabel(dismissal.dismissedOn)),
      dismissal,
    }))
  return [
    ...tabProblems('categories', installedPack().categoriesToSort(workbook.categories, on, workbook.dismissals)),
    ...tabProblems('categories', installedPack().missingCategoriesToSort(workbook, on)),
    ...tabProblems('dismissed', dismissed),
  ]
})

function tagOf(line: ToSortLine): string {
  if (line.dismissal !== undefined) return words.categoriesToSort.dismissedTag
  return line.missing === undefined ? words.categoriesToSort.toSort : words.categoriesToSort.missingTag
}

function addMissing(missing: MissingStartingCategory, name: string): void {
  const workbook = state.workbook
  const records = state.records
  if (workbook === null || records === null) return
  void writes.write(words.categoriesToSort.added(name), (unit) => addStartingCategory(unit, records, workbook.rules, missing), {
    failedTitle: words.categoriesToSort.notAdded,
    key: `add-${missing.category.slug}`,
  })
}

function dismiss(dismissal: Dismissal, name: string): void {
  void writes.write(words.categoriesToSort.dismissedToast(name), (unit) => unit.of(DISMISSAL_WRITES).add(dismissal), {
    failedTitle: words.categoriesToSort.notDismissed,
    key: `dismiss-${dismissal.kind}-${dismissal.key}`,
  })
}

function restore(dismissal: Dismissal): void {
  const stored = recordWithId(state.records?.dismissed ?? NO_RECORDS, dismissal.id)
  if (stored === null) return
  void writes.write(words.categoriesToSort.restored, (unit) => unit.of(DISMISSAL_WRITES).remove(stored.record), {
    failedTitle: words.categoriesToSort.notRestored,
    key: `restore-${dismissal.id}`,
  })
}
</script>

<template>
  <AppCard v-if="toSort.length > 0" :title="words.categoriesToSort.title" :subtitle="words.categoriesToSort.help" collapse-id="company-sorting.categories-to-sort" data-testid="categories-to-sort">
    <div class="px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <ProblemList :problems="toSort">
        <template #tag="{ problem }">{{ tagOf(problem) }}</template>
        <template #action="{ problem }">
          <span v-if="problem.missing !== undefined" class="flex shrink-0 gap-1 self-start sm:self-auto">
            <UButton
              :label="words.categoriesToSort.add"
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="writes.saving(`add-${problem.missing.category.slug}`)"
              :disabled="writes.busy.value || writes.refused.value"
              :aria-label="words.categoriesToSort.addNamed(problem.label)"
              data-testid="add-missing-category"
              @click="addMissing(problem.missing, problem.label)"
            />
            <UButton
              :label="words.categoriesToSort.dismiss"
              icon="i-lucide-eye-off"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="writes.saving(`dismiss-missing-category-${problem.missing.category.slug}`)"
              :disabled="writes.busy.value || writes.refused.value"
              :aria-label="words.categoriesToSort.dismissNamed(problem.label)"
              data-testid="dismiss-missing-category"
              @click="dismiss(dismissalOfMissingCategory(problem.missing.category.slug, today()), problem.label)"
            />
          </span>
          <UButton
            v-else-if="problem.newerClassOf !== undefined"
            :label="words.categoriesToSort.dismiss"
            icon="i-lucide-eye-off"
            color="neutral"
            variant="ghost"
            size="sm"
            class="self-start sm:self-auto"
            :loading="writes.saving(`dismiss-newer-class-${problem.newerClassOf}`)"
            :disabled="writes.busy.value || writes.refused.value"
            :aria-label="words.categoriesToSort.dismissNamed(problem.label)"
            data-testid="dismiss-newer-class"
            @click="dismiss(dismissalOfNewerClass(problem.newerClassOf, today()), problem.label)"
          />
          <UButton
            v-else-if="problem.dismissal !== undefined"
            :label="words.categoriesToSort.restore"
            icon="i-lucide-eye"
            color="neutral"
            variant="ghost"
            size="sm"
            class="self-start sm:self-auto"
            :loading="writes.saving(`restore-${problem.dismissal.id}`)"
            :disabled="writes.busy.value || writes.refused.value"
            :aria-label="words.categoriesToSort.restoreNamed(problem.label)"
            :data-testid="problem.dismissal.kind === 'missing-category' ? 'restore-missing-category' : 'restore-newer-class'"
            @click="restore(problem.dismissal)"
          />
        </template>
      </ProblemList>
    </div>
  </AppCard>
</template>
