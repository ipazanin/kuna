<script setup lang="ts">
import { computed, ref } from 'vue'

import { today } from '../../../../shared/calendar/civilDate'
import { NO_RECORDS, recordWithId } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { Dismissal, SuggestionKind } from '../../workbook/domain/dismissals'
import type { Transaction } from '../../workbook/domain/workbook'
import { DISMISSAL_WRITES, dismissalOfGroup } from '../application/dismissalWrites'
import { withoutDismissed } from '../domain/dismissedSuggestions'
import type { CoverageGroup } from '../domain/ruleCoverage'
import { ruleCoverage } from '../domain/ruleCoverage'
import { draftForRow } from '../domain/ruleDraft'
import { categorisationContextOf } from '../domain/transactionFacts'
import DismissedSuggestions from './DismissedSuggestions.vue'
import RuleCoverage from './RuleCoverage.vue'
import RuleEditor from './RuleEditor.vue'
import type { RuleEditorSource } from './RuleEditor.vue'
import RulesTab from './RulesTab.vue'
import { words } from './words'

/** The Category rules tab of Settings: the rules, the rows a person filed that no rule repeats, and the suggestions dismissed. */
const store = useWorkbook()
const { state } = store
const writes = useRecordWrites(store)
const busy = computed(() => writes.busy.value || state.writing)

/** The tab has no filters, so the rows no rule repeats come from the whole ledger. */
const coverage = computed(() => {
  const workbook = state.workbook
  return withoutDismissed(workbook === null ? { notCovered: [], exceptions: [] } : ruleCoverage(workbook.transactions, workbook.rules, categorisationContextOf(workbook)), workbook?.dismissals ?? [])
})
const hiddenGroups = computed(() => coverage.value.dismissed.filter((entry) => entry.group !== null).length)

const editorOpen = ref(false)
const editorSource = ref<RuleEditorSource | null>(null)

/** Drafted from the newest row in the group's most common category, so a split group starts where most of its rows are. */
function makeRuleForGroup(group: CoverageGroup<Transaction>): void {
  const workbook = state.workbook
  const mostCommon = group.categories[0]?.category
  const newest = group.rows.find((row) => row.category === mostCommon)
  if (workbook === null || newest === undefined) return
  editorSource.value = { title: words.suggestions.makeRuleFor(group.name), draft: draftForRow(newest, workbook, categorisationContextOf(workbook)), edited: null, split: group.categories }
  editorOpen.value = true
}

function dismiss(kind: SuggestionKind, group: CoverageGroup<Transaction>): void {
  void writes.write(words.suggestions.dismissed(group.name), (unit) => unit.of(DISMISSAL_WRITES).add(dismissalOfGroup(kind, group, today())), {
    failedTitle: words.suggestions.notDismissed,
  })
}

function restore(dismissal: Dismissal): void {
  const stored = recordWithId(state.records?.dismissed ?? NO_RECORDS, dismissal.id)
  if (stored === null) return
  void writes.write(words.suggestions.restored, (unit) => unit.of(DISMISSAL_WRITES).remove(stored.record), { failedTitle: words.suggestions.notRestored })
}
</script>

<template>
  <div v-if="state.workbook" class="flex flex-col gap-6">
    <RulesTab />
    <RuleCoverage :coverage="coverage.coverage" :categories="state.workbook.categories" :busy="busy" :dismissed-count="hiddenGroups" @make-rule="makeRuleForGroup" @dismiss="dismiss" />
    <DismissedSuggestions v-if="coverage.dismissed.length" :dismissed="coverage.dismissed" :categories="state.workbook.categories" :busy="busy" @restore="restore" />
    <RuleEditor v-model:open="editorOpen" :source="editorSource" />
  </div>
</template>
