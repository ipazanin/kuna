<script lang="ts">
import type { LoanChange, LoanScenario, OfferTerms } from '../domain/loanScenario'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What the editor starts on: a new scenario or one to change, of a bank loan or of an offer's own terms. */
export interface ScenarioDraft {
  readonly name: string
  /** The bank loan the scenario changes, or null for an offer. */
  readonly loan: RecordId | null
  /** An offer's terms, or null for a new offer or a scenario of a loan. */
  readonly terms: OfferTerms | null
  readonly changes: readonly LoanChange[]
  /** The kept scenario the editor changes, or null to add one. */
  readonly editing: LoanScenario | null
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { newLoanScenario, saveScenario } from '../application/scenarioWrites'
import { NO_COSTS, SCENARIO_CHANGE_KINDS } from '../domain/loanScenario'
import type { ScenarioStart } from '../domain/loanScenario'
import { offerBase, scenarioPlan } from '../domain/scenarioPlan'
import type { ScenarioBase } from '../domain/scenarioPlan'
import ChangeBlock from './ChangeBlock.vue'
import { blankChange, changeTextsOf, typedChange } from './changeTexts'
import type { ChangeRules, ChangeTexts } from './changeTexts'
import OfferTermsFields, { offerTexts, typedOffer } from './OfferTermsFields.vue'
import type { OfferTexts } from './OfferTermsFields.vue'
import { refusalText } from './scenarioComparison'
import { scenarioMonths } from './scenarioMonths'
import { changeSummary, moneyAgainst, payoffAgainst, standing, workedScenario } from './scenariosView'
import type { ScenarioMarking } from './scenariosView'
import { words } from './words'
import { dueDateOf } from '../../bankLoans/domain/loanPlan'
import { ratePeriodOn, subsidyRepaidUntil } from '../../bankLoans/domain/loanFigures'
import { fractionOf } from '../../bankLoans/domain/yearlyRate'
import { typedCount } from '../../bankLoans/presentation/typedCount'
import { words as bankWords } from '../../bankLoans/presentation/words'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import { words as loansWords } from '../../words'
import { parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { subtractMoney } from '../../../../shared/money/money'
import { formatCount, formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import SparkLine from '../../../../shared/ui/SparkLine.vue'

/**
 * A scenario's changes on one side and what they do against the loan as it stands on the other,
 * worked out as you type. An offer starts with its own terms. Save writes the scenario and its
 * changes in one write, so one Undo puts it back. On a phone the outcome follows the changes, and
 * the foot repeats its headline beside Save.
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  draft: ScenarioDraft | null
  /** The letter and colour the scenario wears while compared, or null. */
  mark: ScenarioMarking | null
}>()

const emit = defineEmits<{
  saved: [scenario: LoanScenario, added: boolean]
}>()

const store = useLoansBooks()
const writes = useRecordWrites(store)
const day = today()

const name = ref('')
const offer = ref<OfferTexts>(offerTexts(null, null))
const blocks = ref<ChangeTexts[]>([])
const openBlock = ref<number | null>(null)
const tried = ref(false)
let nextId = 0

const loanBook = computed(() => {
  const loan = props.draft?.loan ?? null
  return loan === null ? null : (store.state.workbook?.bankLoans.find((book) => book.loan.id === loan) ?? null)
})
const isOffer = computed(() => props.draft !== null && props.draft.loan === null)
const from = computed((): CivilDate | null => (isOffer.value ? null : day))

watch(open, (opened) => {
  const draft = props.draft
  if (!opened || draft === null) return
  name.value = draft.name
  const terms = draft.terms
  const firstRate = terms === null ? null : (draft.changes.find((change) => change.kind === 'rate-change' && change.from === terms.firstInstalment) ?? null)
  offer.value = offerTexts(terms, firstRate?.kind === 'rate-change' ? firstRate : null)
  blocks.value = draft.changes.filter((change) => change !== firstRate).map((change) => changeTextsOf((nextId += 1), change))
  openBlock.value = blocks.value.length === 1 ? (blocks.value[0]?.id ?? null) : null
  tried.value = false
})

const typedTerms = computed(() => (isOffer.value ? typedOffer(offer.value) : null))

/** The loan the changes apply to: the bank loan, or the offer's terms as one. */
const base = computed((): ScenarioBase | null => {
  if (loanBook.value !== null) return { ...loanBook.value, costs: NO_COSTS }
  const terms = typedTerms.value?.terms ?? null
  return terms === null ? null : offerBase(name.value, terms)
})
const baseLoan = computed((): BankLoan | null => base.value?.loan ?? null)

/** Every due date of the loan, and of the new loan after a move, numbered from the first. */
const dues = computed(() => {
  const loan = baseLoan.value
  if (loan === null) return []
  const moved = Math.max(0, ...blocks.value.filter((block) => block.kind === 'move').map((block) => typedCount(block.instalments) ?? 0))
  return Array.from({ length: loan.instalments + moved }, (_, offset) => ({ number: offset + 1, date: dueDateOf(loan, offset + 1) }))
})
const rules = computed((): ChangeRules | null => (baseLoan.value === null ? null : { drawdown: baseLoan.value.drawdown, dues: new Set(dues.value.map((due) => due.date)) }))

/** The due dates a block can pick: those still to come on a loan, every one on an offer, and the block's own. A move picks one the old loan still has instalments after. */
function dueItemsOf(block: ChangeTexts): { label: string; value: string }[] {
  const movable = block.kind === 'move' && oldInstalments.value !== null ? new Set(oldInstalments.value.slice(0, -1).map((row) => row.date)) : null
  const pickable = (date: CivilDate): boolean => (from.value === null || date > from.value) && (movable === null || movable.has(date))
  return dues.value.filter((due) => due.date === block.due || pickable(due.date)).map((due) => ({ label: bankWords.ratePeriodDialog.dueDate(dayLabel(due.date), due.number), value: due.date }))
}

const typedBlocks = computed(() => blocks.value.map((block) => (rules.value === null ? { change: null, errors: {} } : typedChange(block, rules.value))))
const summaries = computed(() => typedBlocks.value.map(({ change }) => (change === null ? null : changeSummary(change, change.kind === 'move' ? (live.value?.breakEven ?? null) : undefined))))

const changes = computed((): LoanChange[] => {
  const typed = typedBlocks.value.flatMap(({ change }) => (change === null ? [] : [change]))
  const firstRate = typedTerms.value?.firstRate ?? null
  return firstRate === null ? typed : [firstRate, ...typed]
})

const live = computed(() => (base.value === null ? null : workedScenario('draft', name.value, null, base.value, changes.value, from.value)))

/** The old loan's instalments with the draft's other changes, which a move counts its instalments left from, or null while they cannot be worked out. */
const oldInstalments = computed(() => {
  if (base.value === null) return null
  const plan = scenarioPlan(
    base.value,
    changes.value.filter((change) => change.kind !== 'move'),
    from.value,
  )
  return 'refused' in plan ? null : plan.rows.filter((row) => row.kind === 'instalment')
})
const stands = computed(() => (loanBook.value === null ? null : standing(loanBook.value, day)))

function currentRateOf(block: ChangeTexts) {
  if (isOffer.value) return typedTerms.value?.firstRate?.rate ?? null
  const due = parseCivilDate(block.due)
  return due === null ? null : (ratePeriodOn(loanBook.value?.ratePeriods ?? [], due)?.rate ?? null)
}

function leftAfterOf(block: ChangeTexts): number | null {
  const rows = oldInstalments.value ?? []
  const index = rows.findIndex((row) => row.date === block.due)
  return index === -1 ? null : rows.length - index - 1
}

function add(kind: LoanChange['kind']): void {
  const next = dues.value.find((due) => from.value === null || due.date > from.value)
  const block = blankChange((nextId += 1), kind, next?.date ?? null, null)
  blocks.value = [...blocks.value, kind === 'move' ? { ...block, instalments: String(leftAfterOf(block) ?? '') } : block]
  openBlock.value = block.id
}

function remove(id: number): void {
  blocks.value = blocks.value.filter((block) => block.id !== id)
}

const facts = computed((): Fact[] => {
  const outcome = live.value?.outcome ?? null
  if (outcome === null) return []
  const payoff = outcome.payoff === null ? '–' : monthLabel(monthOf(outcome.payoff))
  if (isOffer.value) {
    const eks = live.value?.eks ?? null
    return [
      { label: words.lines.firstInstalment, value: outcome.nextInstalment === null ? '–' : formatMoney(outcome.nextInstalment) },
      { label: words.card.paidOff, value: payoff },
      { label: words.lines.interest, value: formatMoney(outcome.interest) },
      { label: words.lines.eks, value: eks === null ? '–' : formatRate(fractionOf(eks)) },
    ]
  }
  const against = stands.value?.outcome ?? null
  const extras = live.value !== null && !('refused' in live.value.plan) ? live.value.plan.rows.filter((row) => row.kind === 'extra-payment' && row.date > day).length : 0
  const fewer = against === null ? 0 : against.instalments - outcome.instalments
  const caption = (text: string | null): Pick<Fact, 'caption'> => (text === null ? {} : { caption: text })
  return [
    { label: words.card.paidOff, value: payoff, ...caption(against === null ? null : payoffAgainst(outcome.payoff, against.payoff)) },
    { label: words.lines.interestLeft, value: formatMoney(outcome.interest), ...caption(against === null ? null : moneyAgainst(outcome.interest, against.interest)) },
    { label: words.lines.extra, value: formatMoney(outcome.extra), ...caption(extras === 0 ? null : plural(words.editor.payments(extras), extras)) },
    {
      label: words.lines.instalmentsLeft,
      value: formatCount(outcome.instalments),
      ...caption(fewer === 0 ? words.card.same : fewer > 0 ? words.editor.fewer(fewer) : words.editor.moreOf(-fewer)),
    },
  ]
})

const owed = computed(() => (live.value === null || 'refused' in live.value.plan ? [] : scenarioMonths(live.value.plan, from.value).map((month) => month.owed)))
const owedBefore = computed(() => (stands.value === null || 'refused' in stands.value.plan ? [] : scenarioMonths(stands.value.plan, from.value).map((month) => month.owed)))

const headline = computed(() => {
  const outcome = live.value?.outcome ?? null
  if (outcome === null || outcome.payoff === null) return null
  const month = monthLabel(monthOf(outcome.payoff))
  const against = stands.value?.outcome ?? null
  if (against === null) return words.editor.offerHeadline(month, formatMoney(outcome.total))
  const saved = subtractMoney(against.interest, outcome.interest)
  return saved >= 0 ? words.editor.headline(month, formatMoney(saved)) : words.editor.headlineMore(month, formatMoney(-saved))
})

/** Whether the scenario's early repayment means paying the subsidy back, or starts after it no longer does. */
const subsidyNote = computed((): { readonly back: boolean; readonly until: CivilDate } | null => {
  const loan = loanBook.value?.loan ?? null
  const until = loan === null ? null : subsidyRepaidUntil(loan)
  const plan = live.value?.plan ?? null
  if (until === null || plan === null || 'refused' in plan || plan.firstEarlyRepayment === null || until <= day) return null
  return { back: plan.firstEarlyRepayment <= until, until }
})

const refusal = computed(() => (live.value !== null && 'refused' in live.value.plan ? refusalText(live.value.plan) : null))

const nameError = computed(() => (name.value.trim() === '' ? words.start.nameError : null))

const title = computed(() => {
  const editing = props.draft?.editing ?? null
  if (isOffer.value) return editing === null ? words.editor.addOfferTitle : words.editor.editOfferTitle
  return editing === null ? words.editor.addTitle : words.editor.editTitle
})

/** What the scenario starts from: its bank loan, or the offer's terms once they and the first rate are typed. */
function startOf(draft: ScenarioDraft): ScenarioStart | null {
  if (draft.loan !== null) return { kind: 'loan', loan: draft.loan }
  const typed = typedTerms.value
  return typed === null || typed.terms === null || typed.firstRate === null ? null : { kind: 'offer', terms: typed.terms }
}

async function save(): Promise<void> {
  tried.value = true
  const draft = props.draft
  const records = store.state.records
  if (draft === null || records === null || nameError.value !== null || typedBlocks.value.some(({ change }) => change === null)) return
  const start = startOf(draft)
  if (start === null) return
  const scenario: LoanScenario = draft.editing === null ? newLoanScenario({ name: name.value, start }) : { ...draft.editing, name: name.value.trim(), start }
  const written = await writes.write(draft.editing === null ? words.editor.added : words.editor.saved, (unit) => saveScenario(unit, records, scenario, changes.value, draft.editing), {
    failedTitle: draft.editing === null ? loansWords.form.notAdded : loansWords.form.notSaved,
  })
  if (!written) return
  open.value = false
  emit('saved', scenario, draft.editing === null)
}
</script>

<template>
  <AppDialog v-model:open="open" :title="title" :description="isOffer ? words.editor.offerDescription : words.editor.loanDescription(loanBook?.loan.name ?? '')" width="3xl">
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start" data-testid="scenario-editor">
      <form id="scenario-editor" class="flex min-w-0 flex-col gap-4" @submit.prevent="save">
        <UFormField :label="words.start.name" :error="(tried && nameError) || false">
          <UInput v-model="name" :placeholder="words.start.namePlaceholder" class="w-full" data-testid="scenario-name" />
        </UFormField>
        <section v-if="isOffer" class="flex flex-col gap-2">
          <h3 class="type-label">{{ words.editor.terms }}</h3>
          <FormGrid>
            <OfferTermsFields v-model="offer" :tried="tried" />
          </FormGrid>
        </section>
        <section v-if="blocks.length > 0" class="flex flex-col gap-2">
          <h3 class="type-label">{{ isOffer ? words.editor.offerChanges : words.editor.changes }}</h3>
          <ChangeBlock
            v-for="(block, index) in blocks"
            :key="block.id"
            :model-value="block"
            :open="openBlock === block.id"
            :tried="tried"
            :errors="typedBlocks[index]?.errors ?? {}"
            :due-items="dueItemsOf(block)"
            :summary="summaries[index] ?? null"
            :current-rate="currentRateOf(block)"
            :left-after="leftAfterOf(block)"
            @update:open="openBlock = $event ? block.id : null"
            @remove="remove(block.id)"
          />
        </section>
        <section class="flex flex-col gap-2">
          <h3 class="type-label">{{ words.editor.addChange }}</h3>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-for="kind in SCENARIO_CHANGE_KINDS"
              :key="kind"
              :label="words.editor.kinds[kind]"
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              size="sm"
              :disabled="baseLoan === null"
              :data-testid="`scenario-add-${kind}`"
              @click="add(kind)"
            />
          </div>
        </section>
      </form>
      <AppCard as="aside" :title="isOffer ? words.editor.offerOutcome : words.editor.against('A', words.asItStands)" :subtitle="words.editor.asYouType" heading="h3" data-testid="scenario-outcome">
        <div class="flex flex-col gap-3 px-4 pb-4 sm:px-5">
          <UAlert v-if="refusal" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="words.card.refused" :description="refusal" />
          <template v-else-if="facts.length > 0">
            <SparkLine :points="owed" :against="owedBefore" :colour="`var(${mark?.colour ?? (isOffer ? '--scenario-1' : '--scenario-2')})`" against-colour="var(--scenario-1)" fill :height="56" />
            <FactGrid :facts="facts" />
            <UAlert
              v-if="subsidyNote"
              :icon="subsidyNote.back ? 'i-lucide-triangle-alert' : 'i-lucide-info'"
              :color="subsidyNote.back ? 'warning' : 'info'"
              variant="subtle"
              :description="subsidyNote.back ? words.editor.subsidyBack(dayLabel(subsidyNote.until)) : words.editor.subsidyFine(dayLabel(subsidyNote.until))"
              data-testid="scenario-subsidy-note"
            />
          </template>
          <p v-else class="type-caption">{{ words.editor.noPlan }}</p>
        </div>
      </AppCard>
    </div>
    <template #start>
      <p v-if="headline" class="basis-full text-xs text-toned lg:hidden" data-testid="scenario-headline">
        <span v-if="mark" class="font-semibold text-highlighted">{{ mark.letter }}</span> {{ headline }}
      </p>
    </template>
    <template #end>
      <UButton :label="loansWords.form.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="scenario-editor"
        :label="isOffer ? words.editor.saveOffer : words.editor.save"
        icon="i-lucide-save"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="scenario-save"
      />
    </template>
  </AppDialog>
</template>
