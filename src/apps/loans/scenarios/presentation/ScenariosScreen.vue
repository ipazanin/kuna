<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { LoanScenario } from '../domain/loanScenario'
import ScenarioCompare from './ScenarioCompare.vue'
import ScenarioEditor from './ScenarioEditor.vue'
import type { ScenarioDraft } from './ScenarioEditor.vue'
import { scenarioKey } from '../domain/workedScenario'
import type { ScenarioMarking } from './scenariosView'
import { useScenarioCompare } from './useScenarioCompare'
import { words } from './words'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { ScenarioBook } from '../../workbook/domain/readLoanBook'
import { today } from '../../../../shared/calendar/civilDate'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** New loans and offers you are weighing, compared side by side. Tries on a loan you have live on its own page. */
const { state } = useLoansBooks()
const day = today()

const offers = computed(() => (state.workbook?.scenarios ?? []).filter(({ scenario }) => scenario.start.kind === 'offer'))
const compare = useScenarioCompare(() => offers.value.map((book) => scenarioKey(book.scenario)))

const editorOpen = ref(false)
const draft = ref<ScenarioDraft | null>(null)
const mark = ref<ScenarioMarking | null>(null)

function create(): void {
  draft.value = { name: '', terms: null, changes: [], editing: null }
  mark.value = null
  editorOpen.value = true
}

function edit(book: ScenarioBook, worn: ScenarioMarking | null): void {
  const { scenario, changes } = book
  if (scenario.start.kind !== 'offer') return
  draft.value = { name: scenario.name, terms: scenario.start.terms, changes, editing: scenario }
  mark.value = worn
  editorOpen.value = true
}

/** A new offer is picked into a free slot. With no `?compare=`, the first offers may already hold it. */
function saved(scenario: LoanScenario, added: boolean): void {
  const key = scenarioKey(scenario)
  if (added && !compare.picked.value.some((entry) => entry.key === key)) compare.toggle(key)
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description">
      <template #actions>
        <UButton :label="words.newScenario" icon="i-lucide-plus" :disabled="state.workbook === null" data-testid="scenario-new" @click="create" />
      </template>
    </PageHeader>
    <template v-if="state.workbook !== null">
      <ScenarioCompare v-if="offers.length > 0" :scenarios="offers" :compare="compare" :today="day" @edit="edit" />
      <EmptyState
        v-else
        icon="i-lucide-file-plus-2"
        :title="words.empty.title"
        :description="words.empty.description"
        :actions="[{ label: words.newScenario, icon: 'i-lucide-plus', onClick: create }]"
        data-testid="scenarios-empty"
      />
    </template>
    <ScreenSkeleton v-else-if="state.status !== 'error'" :heading="false" :cards="2" />
    <ScenarioEditor v-model:open="editorOpen" :draft="draft" :mark="mark" @saved="saved" />
  </section>
</template>
