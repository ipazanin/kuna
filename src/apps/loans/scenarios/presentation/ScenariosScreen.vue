<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import type { LoanScenario } from '../domain/loanScenario'
import NewScenarioDialog from './NewScenarioDialog.vue'
import ScenarioCompare from './ScenarioCompare.vue'
import ScenarioEditor from './ScenarioEditor.vue'
import type { ScenarioDraft } from './ScenarioEditor.vue'
import { scenarioKey, scenarioTabs, TRIED_EXTRA } from './scenariosView'
import type { ScenarioMarking } from './scenariosView'
import { OFFERS_TAB, useScenarioCompare } from './useScenarioCompare'
import { words } from './words'
import { nextPayment } from '../../bankLoans/domain/loanFigures'
import { scenariosLink, scenarioTabOf } from '../../overview/presentation/loanLinks'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { ScenarioBook } from '../../workbook/domain/readLoanBook'
import { today } from '../../../../shared/calendar/civilDate'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** Scenarios of each bank loan and offers you are weighing, compared side by side, with a tab per loan and one for offers. */
const { state } = useLoansBooks()
const router = useRouter()
const day = today()

const tabs = computed(() => (state.workbook === null ? [] : scenarioTabs(state.workbook, day)))
const compare = useScenarioCompare(
  () => tabs.value.map((tab) => tab.value),
  (value) => tabs.value.find((tab) => tab.value === value)?.scenarios.map((book) => scenarioKey(book.scenario)) ?? [],
)
const pageTabs = computed(() => tabs.value.map((tab) => ({ value: tab.value, label: tab.label, count: tab.scenarios.length })))
const active = computed(() => tabs.value.find((tab) => tab.value === compare.tab.value) ?? null)
/** The loans a new scenario can change: those with a plan still to come. */
const loans = computed(() => tabs.value.flatMap((tab) => (tab.kind === 'loan' && tab.book.plan !== null && tab.paidOff === null ? [tab.book.loan] : [])))

const startOpen = ref(false)
const editorOpen = ref(false)
const draft = ref<ScenarioDraft | null>(null)
const mark = ref<ScenarioMarking | null>(null)

function openEditor(started: ScenarioDraft, worn: ScenarioMarking | null = null): void {
  draft.value = started
  mark.value = worn
  editorOpen.value = true
}

function edit(book: ScenarioBook, worn: ScenarioMarking | null): void {
  const { scenario, changes } = book
  openEditor(
    { name: scenario.name, loan: scenario.start.kind === 'loan' ? scenario.start.loan : null, terms: scenario.start.kind === 'offer' ? scenario.start.terms : null, changes, editing: scenario },
    worn,
  )
}

function tryExtra(): void {
  const tab = active.value
  if (tab === null || tab.kind !== 'loan' || tab.book.plan === null) return
  const next = nextPayment(tab.book.plan, day)
  if (next === null) return
  openEditor({
    name: words.empty.tryName(formatMoney(TRIED_EXTRA)),
    loan: tab.book.loan.id,
    terms: null,
    changes: [{ kind: 'extra-payment', date: next.date, amount: TRIED_EXTRA, effect: 'shorter-term' }],
    editing: null,
  })
}

/** A new scenario is picked into a free slot of its tab, opening that tab when it is another. With no `?compare=`, the first scenarios may already hold it. */
async function saved(scenario: LoanScenario, added: boolean): Promise<void> {
  if (!added) return
  const { start } = scenario
  const loan = start.kind === 'loan' ? (state.workbook?.bankLoans.find((book) => book.loan.id === start.loan)?.loan ?? null) : null
  const key = scenarioKey(scenario)
  if ((loan === null ? OFFERS_TAB : scenarioTabOf(loan)) !== compare.tab.value) await router.push(scenariosLink(loan, key))
  else if (!compare.picked.value.some((entry) => entry.key === key)) compare.toggle(key)
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description">
      <template #actions>
        <UButton :label="words.newScenario" icon="i-lucide-plus" :disabled="state.workbook === null" data-testid="scenario-new" @click="startOpen = true" />
      </template>
    </PageHeader>
    <PageTabs v-if="state.workbook !== null" :tabs="pageTabs" :label="words.tabs">
      <template v-for="tab in tabs" :key="tab.value" #[tab.value]>
        <ScenarioCompare :tab="tab" :compare="compare" :today="day" @edit="edit" @create="startOpen = true" @try-extra="tryExtra" />
      </template>
    </PageTabs>
    <ScreenSkeleton v-else-if="state.status !== 'error'" :heading="false" :cards="2" />
    <NewScenarioDialog v-model:open="startOpen" :loans="loans" :start-loan="active?.kind === 'loan' ? active.book.loan.id : null" @next="openEditor" />
    <ScenarioEditor v-model:open="editorOpen" :draft="draft" :mark="mark" @saved="saved" />
  </section>
</template>
