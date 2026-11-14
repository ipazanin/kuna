<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { NO_RECORDS, recordWithId, recordsOf } from '../../../../shared/storage/domain/recordsRead'
import ProblemList from '../../workbook-files/presentation/ProblemList.vue'
import { installedPack, shownPack } from '../../packs/packContribution'
import type { CategoryToSort } from '../../packs/packContribution'
import { DISMISSAL_WRITES, dismissalOfNewerClass } from '../../rules/application/dismissalWrites'
import { useBookedWorkbook } from '../../transactions/application/useBookedWorkbook'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { Dismissal } from '../../workbook/domain/dismissals'
import { displayNamesOf } from '../../workbook/domain/displayName'
import { newestBookingOf, tabProblems } from '../../workbook/domain/workbook'
import type { WorkbookProblem } from '../../workbook/domain/workbook'
import { today } from '../../../../shared/calendar/civilDate'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { removeSettings } from '../application/settingWrites'
import { unreadSettingKeys } from '../domain/settings'
import GeneralSettingsForm from './GeneralSettingsForm.vue'
import { plural } from '../../../../shared/text/translation'
import { words } from './words'
import { useSettingsSave } from './useSettingsSave'

const { state } = useWorkbook()
const { settings, facts: packFacts, saving: savingSettings, refused, saveGeneral } = useSettingsSave()
const pack = computed(() => shownPack(settings.value))
const writes = useRecordWrites(useWorkbook())

/** The reader's problems and the splits the figures leave out, such as one of a row an asset claims. */
const booked = useBookedWorkbook()
const problems = computed(() => booked.value?.problems ?? [])

/** A line of Categories to sort, or a suggested class the person dismissed, which Restore shows again. */
type ToSortLine = WorkbookProblem & CategoryToSort & { readonly dismissal?: Dismissal }

/** The categories that do not count one way yet, or not as new books count them, and below them the suggested classes dismissed. They are no reading problem. */
const toSort = computed((): readonly ToSortLine[] => {
  const workbook = state.workbook
  if (workbook === null) return []
  const names = displayNamesOf(workbook)
  const dismissed = workbook.dismissals
    .filter((dismissal) => dismissal.kind === 'newer-class')
    .map((dismissal) => ({
      id: dismissal.id,
      label: names.category(dismissal.key),
      reason: dismissal.dismissedOn === null ? words.categoriesToSort.dismissed : words.categoriesToSort.dismissedOn(dayLabel(dismissal.dismissedOn)),
      dismissal,
    }))
  return [
    ...tabProblems('categories', installedPack().categoriesToSort(workbook.categories, newestBookingOf(workbook.transactions) ?? today(), workbook.dismissals)),
    ...tabProblems('dismissed', dismissed),
  ]
})

function dismissNewerClass(category: string, name: string): void {
  void writes.write(words.categoriesToSort.dismissedToast(name), (unit) => unit.of(DISMISSAL_WRITES).add(dismissalOfNewerClass(category, today())), {
    failedTitle: words.categoriesToSort.notDismissed,
    key: `dismiss-class-${category}`,
  })
}

function restoreNewerClass(dismissal: Dismissal): void {
  const stored = recordWithId(state.records?.dismissed ?? NO_RECORDS, dismissal.id)
  if (stored === null) return
  void writes.write(words.categoriesToSort.restored, (unit) => unit.of(DISMISSAL_WRITES).remove(stored.record), {
    failedTitle: words.categoriesToSort.notRestored,
    key: `restore-${dismissal.id}`,
  })
}

const settingRecords = computed(() => state.records?.settings ?? NO_RECORDS)
/** The keys the settings tab holds that no setting reads, unknown keys and import profiles, with how many rows hold each. */
const unreadKeys = computed(() => unreadSettingKeys(recordsOf(settingRecords.value), installedPack().workbook?.settings ?? null))

function removeKey(key: string): void {
  void writes.write(words.problems.removed, (unit) => removeSettings(unit, settingRecords.value, [key]), {
    description: words.problems.removedNote(key),
    failedTitle: words.problems.notRemoved,
    key: `delete-${key}`,
  })
}
</script>

<template>
  <div v-if="state.workbook" class="flex flex-col gap-6">
    <GeneralSettingsForm :settings="settings" :facts="packFacts" :saving="savingSettings" :refused="refused" @save="saveGeneral" />
    <component :is="card" v-for="(card, index) in pack.settingsCards" :key="index" />
    <AppCard
      :title="words.problems.title"
      :subtitle="problems.length > 0 ? words.problems.subtitle : undefined"
      collapse-id="settings.problems"
      :start-collapsed="problems.length === 0"
      :reveal="problems.length > 0"
      :summary="problems.length > 0 ? plural(words.problems.count(problems.length), problems.length) : words.problems.none"
    >
      <div class="px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
        <ProblemList v-if="problems.length > 0" :problems="problems">
          <template #action="{ problem }">
            <UButton
              v-if="problem.tab === 'settings' && unreadKeys.get(problem.label) === 1"
              :label="words.problems.removeKey"
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="sm"
              class="self-start sm:self-auto"
              :loading="writes.saving(`delete-${problem.label}`)"
              :disabled="writes.busy.value || writes.refused.value"
              :aria-label="words.problems.removeKeyNamed(problem.label)"
              data-testid="remove-setting"
              @click="removeKey(problem.label)"
            />
            <p v-else-if="problem.tab === 'settings' && (unreadKeys.get(problem.label) ?? 0) > 1" class="text-xs text-muted sm:max-w-56" data-testid="setting-on-rows">
              {{ plural(words.problems.onRows(unreadKeys.get(problem.label) ?? 0), unreadKeys.get(problem.label) ?? 0) }}
            </p>
          </template>
        </ProblemList>
        <p v-else class="text-sm text-muted">{{ words.problems.allRead }}</p>
      </div>
    </AppCard>
    <AppCard v-if="toSort.length > 0" :title="words.categoriesToSort.title" :subtitle="words.categoriesToSort.help" collapse-id="settings.categories-to-sort" data-testid="categories-to-sort">
      <div class="px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
        <ProblemList :problems="toSort">
          <template #action="{ problem }">
            <UButton
              v-if="problem.newerClassOf !== undefined"
              :label="words.categoriesToSort.dismiss"
              icon="i-lucide-eye-off"
              color="neutral"
              variant="ghost"
              size="sm"
              class="self-start sm:self-auto"
              :loading="writes.saving(`dismiss-class-${problem.newerClassOf}`)"
              :disabled="writes.busy.value || writes.refused.value"
              :aria-label="words.categoriesToSort.dismissNamed(problem.label)"
              data-testid="dismiss-newer-class"
              @click="dismissNewerClass(problem.newerClassOf, problem.label)"
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
              data-testid="restore-newer-class"
              @click="restoreNewerClass(problem.dismissal)"
            />
          </template>
        </ProblemList>
      </div>
    </AppCard>
  </div>
</template>
