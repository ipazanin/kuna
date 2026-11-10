<script lang="ts">
import type { LoanChange, LoanScenario, OfferTerms } from '../domain/loanScenario'

/** What the editor starts on: a new offer or one to change. */
export interface ScenarioDraft {
  readonly name: string
  /** The offer's terms, or null for a new offer. */
  readonly terms: OfferTerms | null
  readonly changes: readonly LoanChange[]
  /** The kept offer the editor changes, or null to add one. */
  readonly editing: LoanScenario | null
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { newLoanScenario, saveScenario } from '../application/scenarioWrites'
import { eksAgreement } from '../domain/eksAgreement'
import { offerBase } from '../domain/scenarioPlan'
import { moveDates, oldLoanDues, scenarioDues } from '../domain/scenarioDues'
import ChangeBlock from './ChangeBlock.vue'
import { blankChange, changeTextsOf, typedChange } from './changeTexts'
import type { ChangeRules, ChangeTexts } from './changeTexts'
import OfferTermsFields from './OfferTermsFields.vue'
import { fillsMore, offerAutoName, offerTexts, typedOffer, wrongInMore } from './offerTexts'
import type { OfferTexts } from './offerTexts'
import { refusalText } from './scenarioComparison'
import { scenarioMonths } from './scenarioMonths'
import { workedScenario } from '../domain/workedScenario'
import { changeSummary } from './scenariosView'
import type { ScenarioMarking } from './scenariosView'
import { words } from './words'
import { fractionOf } from '../../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import { provideLoanWords } from '../../bankLoans/presentation/useLoanWords'
import { useLoansBooks } from '../../workbook/application/loansStore'
import { words as loansWords } from '../../words'
import { today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { typedCount } from '../../../../shared/text/typedCount'
import AppCard from '../../../../shared/ui/AppCard.vue'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import SparkLine from '../../../../shared/ui/SparkLine.vue'

/**
 * An offer's terms on one side and what they come to on the other, worked out as you type. Its extra
 * payments and later changes wait under More terms. Save writes the offer and its changes in one
 * write, so one Undo puts it back. On a phone the outcome follows the fields, and the foot repeats
 * its headline beside Save.
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  draft: ScenarioDraft | null
  /** The letter and colour the offer wears while compared, or null. */
  mark: ScenarioMarking | null
}>()

const emit = defineEmits<{
  saved: [scenario: LoanScenario, added: boolean]
}>()

/** The changes the Add row offers. A move a saved offer holds still opens. */
const ADDABLE = ['extra-payment', 'regular-extra-payment', 'rate-change'] as const

const store = useLoansBooks()
const writes = useRecordWrites(store)
const day = today()

const offer = ref<OfferTexts>(offerTexts('', null, [], day).texts)
const blocks = ref<ChangeTexts[]>([])
const openBlock = ref<number | null>(null)
const moreOpen = ref(false)
const tried = ref(false)
let nextId = 0

const loanWords = provideLoanWords(() => offer.value.repayment)

watch(open, (opened) => {
  const draft = props.draft
  if (!opened || draft === null) return
  const { texts, later } = offerTexts(draft.name, draft.terms, draft.changes, day)
  offer.value = texts
  blocks.value = later.map((change) => changeTextsOf((nextId += 1), change))
  openBlock.value = null
  moreOpen.value = fillsMore(texts) || later.length > 0
  tried.value = false
})

const typed = computed(() => typedOffer(offer.value))

const autoName = computed(() => offerAutoName(offer.value))
const name = computed(() => offer.value.name.trim() || autoName.value)

/** The offer's terms as a bank loan, which its changes apply to. */
const base = computed(() => (typed.value.terms === null ? null : offerBase(name.value, typed.value.terms)))

const dues = computed(() => {
  const loan = base.value?.loan ?? null
  if (loan === null) return []
  return scenarioDues(loan, Math.max(0, ...blocks.value.filter((block) => block.kind === 'move').map((block) => typedCount(block.instalments) ?? 0)))
})
const rules = computed((): ChangeRules | null => (base.value === null ? null : { drawdown: base.value.loan.drawdown, dues: new Set(dues.value.map((due) => due.date)) }))

const typedBlocks = computed(() => blocks.value.map((block) => (rules.value === null ? { change: null, errors: {} } : typedChange(block, rules.value))))

const changes = computed((): LoanChange[] => [...typed.value.rates, ...typedBlocks.value.flatMap(({ change }) => (change === null ? [] : [change]))])

const live = computed(() => (base.value === null ? null : workedScenario('draft', name.value, null, base.value, changes.value, null)))
const summaries = computed(() =>
  typedBlocks.value.map(({ change }) => (change === null ? null : changeSummary(change, loanWords.value.extraDialog.effects, change.kind === 'move' ? (live.value?.breakEven ?? null) : undefined))),
)

const oldDues = computed(() => (base.value === null ? null : oldLoanDues(base.value, changes.value)))
const movable = computed(() => (base.value === null ? null : moveDates(base.value, changes.value)))

/** The due dates a block can pick, and for a move only those it may fall on, keeping the one it holds. */
function dueItemsOf(block: ChangeTexts): { label: string; value: string }[] {
  const allowed = block.kind === 'move' ? movable.value : null
  return dues.value
    .filter((due) => due.date === block.due || allowed === null || allowed.has(due.date))
    .map((due) => ({ label: loanWords.value.ratePeriodDialog.dueDate(dayLabel(due.date), due.number), value: due.date }))
}

function leftAfterOf(block: ChangeTexts): number | null {
  return oldDues.value?.find((due) => due.date === block.due)?.left ?? null
}

function add(kind: (typeof ADDABLE)[number]): void {
  const block = blankChange((nextId += 1), kind, dues.value[0]?.date ?? null, null)
  blocks.value = [...blocks.value, block]
  openBlock.value = block.id
}

function remove(id: number): void {
  blocks.value = blocks.value.filter((block) => block.id !== id)
}

const facts = computed((): Fact[] => {
  const outcome = live.value?.outcome ?? null
  if (outcome === null) return []
  const eks = live.value?.eks ?? null
  const last = outcome.instalmentChanges && outcome.lastInstalment !== null ? { caption: loanWords.value.instalment.last(formatMoney(outcome.lastInstalment)) } : {}
  return [
    { label: loanWords.value.instalment.monthly, value: outcome.nextInstalment === null ? '–' : formatMoney(outcome.nextInstalment), ...last },
    { label: words.lines.payoff, value: outcome.payoff === null ? '–' : monthLabel(monthOf(outcome.payoff)) },
    { label: words.lines.interest, value: formatMoney(outcome.interest) },
    { label: words.lines.total, value: formatMoney(outcome.total) },
    { label: words.lines.eks, value: eks === null ? '–' : rateShown(eks) },
  ]
})

const rateShown = (rate: YearlyRate): string => formatRate(fractionOf(rate))

/** The warning the chat's offer card gives too, when Kuna's EKS strays from the one the bank printed. */
const eksWarning = computed(() => {
  const agreement = eksAgreement(live.value?.eks ?? null, typed.value.terms?.bankEks ?? null)
  return agreement.kind === 'differs' ? words.editor.eksDiffers(rateShown(agreement.estimated), rateShown(agreement.printed)) : null
})

const owed = computed(() => (live.value === null || 'refused' in live.value.plan ? [] : scenarioMonths(live.value.plan, null).map((month) => month.owed)))

/** "€1,012.45 a month, paid off Jan 2036", or the first and the last where the instalment changes. */
const headline = computed(() => {
  const outcome = live.value?.outcome ?? null
  if (outcome === null || outcome.payoff === null || outcome.nextInstalment === null) return null
  const month = monthLabel(monthOf(outcome.payoff))
  const first = formatMoney(outcome.nextInstalment)
  const last = outcome.lastInstalment
  if (!outcome.instalmentChanges || last === null) return words.editor.headline(first, month)
  return last < outcome.nextInstalment ? words.editor.headlineFalling(first, formatMoney(last), month) : words.editor.headlineRising(first, formatMoney(last), month)
})

/** After a Save, whether a field or a change under More terms still stops it. */
const moreWrong = computed(
  () => tried.value && ((typed.value.terms === null && wrongInMore(typed.value.errors)) || (typed.value.terms !== null && typedBlocks.value.some(({ change }) => change === null))),
)

const refusal = computed(() => (live.value !== null && 'refused' in live.value.plan ? refusalText(live.value.plan) : null))

async function save(): Promise<void> {
  tried.value = true
  const draft = props.draft
  const records = store.state.records
  const terms = typed.value.terms
  if (terms === null) {
    if (wrongInMore(typed.value.errors)) moreOpen.value = true
    return
  }
  const unfinished = blocks.value.find((_, index) => typedBlocks.value[index]?.change === null)
  if (unfinished !== undefined) {
    moreOpen.value = true
    openBlock.value = unfinished.id
    return
  }
  if (draft === null || records === null || name.value === '') return
  const start = { kind: 'offer', terms } as const
  const scenario: LoanScenario = draft.editing === null ? newLoanScenario({ name: name.value, start }) : { ...draft.editing, name: name.value, start }
  const written = await writes.write(draft.editing === null ? words.editor.added : words.editor.saved, (unit) => saveScenario(unit, records, scenario, changes.value, draft.editing), {
    failedTitle: draft.editing === null ? loansWords.form.notAdded : loansWords.form.notSaved,
  })
  if (!written) return
  open.value = false
  emit('saved', scenario, draft.editing === null)
}
</script>

<template>
  <AppDialog v-model:open="open" :title="draft?.editing ? words.editor.editTitle : words.editor.addTitle" :description="words.editor.description" width="3xl">
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start" data-testid="scenario-editor">
      <form id="scenario-editor" class="flex min-w-0 flex-col gap-4" @submit.prevent="save">
        <OfferTermsFields v-model="offer" v-model:more-open="moreOpen" :tried="tried" :errors="typed.errors" :auto-name="autoName" :more-wrong="moreWrong">
          <template #more>
            <section class="flex flex-col gap-2">
              <h3 class="type-label">{{ words.editor.changes }}</h3>
              <ChangeBlock
                v-for="(block, index) in blocks"
                :key="block.id"
                :model-value="block"
                :open="openBlock === block.id"
                :tried="tried"
                :errors="typedBlocks[index]?.errors ?? {}"
                :due-items="dueItemsOf(block)"
                :summary="summaries[index] ?? null"
                :current-rate="typed.rates[0]?.rate ?? null"
                :left-after="leftAfterOf(block)"
                @update:open="openBlock = $event ? block.id : null"
                @remove="remove(block.id)"
              />
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="kind in ADDABLE"
                  :key="kind"
                  :label="words.editor.kinds[kind]"
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :disabled="base === null"
                  :data-testid="`scenario-add-${kind}`"
                  @click="add(kind)"
                />
              </div>
            </section>
          </template>
        </OfferTermsFields>
      </form>
      <AppCard as="aside" :title="words.editor.outcome" :subtitle="words.editor.asYouType" heading="h3" data-testid="scenario-outcome">
        <div class="flex flex-col gap-3 px-4 pb-4 sm:px-5">
          <UAlert v-if="refusal" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="words.editor.refused" :description="refusal" />
          <template v-else-if="facts.length > 0">
            <SparkLine :points="owed" :colour="`var(${mark?.colour ?? '--scenario-1'})`" fill :height="56" />
            <FactGrid :facts="facts" />
            <UAlert v-if="eksWarning" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :description="eksWarning" data-testid="scenario-eks-differs" />
          </template>
          <p v-else class="type-caption">{{ words.editor.noPlan }}</p>
        </div>
      </AppCard>
    </div>
    <template #start>
      <p v-if="headline" class="basis-full text-xs text-toned lg:hidden" data-testid="scenario-headline">
        <span v-if="mark" class="font-semibold text-highlighted">{{ mark.letter }}</span> {{ headline }}
        <span v-if="eksWarning" class="ms-1 inline-flex items-center gap-1 font-medium text-warning" data-testid="scenario-eks-flag">
          <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0" aria-hidden="true" />{{ words.editor.eksFlag }}
        </span>
      </p>
    </template>
    <template #end>
      <UButton :label="loansWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="scenario-editor" :label="words.editor.save" icon="i-lucide-save" :loading="writes.busy.value" :disabled="writes.busy.value" data-testid="scenario-save" />
    </template>
  </AppDialog>
</template>
