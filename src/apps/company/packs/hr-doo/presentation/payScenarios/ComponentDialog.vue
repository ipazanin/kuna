<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { recordsOfKindIn } from '../../../../workbook/domain/readWorkbook'
import { NO_RECORDS, recordWithId } from '../../../../../../shared/storage/domain/recordsRead'
import { SCENARIO_RECORDS } from '../../domain/hrDooKinds'
import { useWorkbook } from '../../../../workbook/application/workbookStore'
import { DIRECTOR_BASES } from '../../domain/scenarios/ownerPayScenarios'
import type { DirectorBasis, OwnerPayScenario, ScenarioComponent } from '../../domain/scenarios/ownerPayScenarios'
import { useRecordWrites } from '../../../../../../shared/storage/presentation/useRecordWrites'
import { parseCivilDate } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { typedAmount } from '../../../../../../shared/money/typedAmount'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import AppDialog from '../../../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../../../shared/ui/FormGrid.vue'
import { SCENARIO_WRITES } from '../../domain/hrDooWrites'
import { scenarioRowOfComponent } from '../../domain/scenarios/scenariosReading'
import type { ScenarioRow } from '../../domain/scenarios/scenariosReading'
import { componentInWords } from '../../domain/scenarios/scenarioGuards'
import type { ComponentDraft } from '../../domain/scenarios/startingScenarios'
import { BASIS_WORDS, yearlyItems } from './scenarioWording'

type Kind = ScenarioComponent['component']

const KINDS: readonly { readonly label: string; readonly value: Kind }[] = [
  { label: 'Salary', value: 'salary_gross' },
  { label: 'Tax-free item', value: 'nontaxable' },
  { label: 'Rent', value: 'rent_monthly' },
  { label: 'Dividend', value: 'dividend' },
  { label: 'Insurance basis', value: 'director_basis' },
]

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  scenario: OwnerPayScenario
  /** The component to edit, or null to add one. */
  component: ScenarioComponent | null
}>()

const store = useWorkbook()
const writes = useRecordWrites(store)

const kind = ref<Kind>('salary_gross')
const atFloor = ref(true)
const atMost = ref(true)
const amount = ref('')
const item = ref('')
const basis = ref<DirectorBasis>('employee')
const from = ref('')
const to = ref('')
const tried = ref(false)

const items = computed(() => yearlyItems(props.scenario.year))
const itemChoices = computed(() => items.value.map((entry) => ({ label: `${entry.label}, cap ${formatMoney(entry.cap)} a year`, value: entry.item })))
const basisChoices = DIRECTOR_BASES.map((value) => ({ label: `As ${BASIS_WORDS[value]}`, value }))

watch(
  open,
  (opened) => {
    if (!opened) return
    const component = props.component
    kind.value = component?.component ?? 'salary_gross'
    atFloor.value = component?.component !== 'salary_gross' || component.gross === 'floor'
    atMost.value = component?.component !== 'dividend' || component.amount === 'max'
    amount.value = shownAmount(component)
    item.value = component?.component === 'nontaxable' ? component.item : (items.value[0]?.item ?? '')
    basis.value = component?.component === 'director_basis' ? component.basis : 'employee'
    from.value = component?.from ?? ''
    to.value = component?.to ?? ''
    tried.value = false
  },
  { immediate: true },
)

function shownAmount(component: ScenarioComponent | null): string {
  if (component === null) return ''
  switch (component.component) {
    case 'salary_gross':
      return component.gross === 'floor' ? '' : plainAmount(component.gross)
    case 'dividend':
      return component.amount === 'max' ? '' : plainAmount(component.amount)
    case 'nontaxable':
    case 'rent_monthly':
      return plainAmount(component.amount)
    case 'director_basis':
      return ''
  }
}

/** A tax-free item starts at its cap, the most it can be tax free. */
watch([kind, item], ([chosen, picked]) => {
  if (open.value && chosen === 'nontaxable' && props.component?.component !== 'nontaxable') {
    const cap = items.value.find((entry) => entry.item === picked)?.cap
    if (cap !== undefined) amount.value = plainAmount(cap)
  }
})

const needsAmount = computed(() => (kind.value === 'salary_gross' && !atFloor.value) || (kind.value === 'dividend' && !atMost.value) || kind.value === 'nontaxable' || kind.value === 'rent_monthly')
const hasSpan = computed(() => kind.value !== 'dividend')
const hasEnd = computed(() => kind.value !== 'dividend' && kind.value !== 'nontaxable')

const parsedAmount = computed((): Money | null => {
  const cents = typedAmount(amount.value)
  return cents !== null && cents > 0 ? cents : null
})

function dayIn(text: string): CivilDate | null | 'bad' {
  if (text.trim() === '') return null
  const day = parseCivilDate(text.trim())
  return day === null || Number(day.slice(0, 4)) !== props.scenario.year ? 'bad' : day
}

const errors = computed(() => {
  const start = hasSpan.value ? dayIn(from.value) : null
  const end = hasEnd.value ? dayIn(to.value) : null
  const inYear = `A day in ${props.scenario.year}, or blank`
  return {
    amount: needsAmount.value && parsedAmount.value === null ? 'An amount above zero with at most two decimals' : null,
    item: kind.value === 'nontaxable' && item.value === '' ? 'Choose the item' : null,
    from: start === 'bad' ? inYear : null,
    to: end === 'bad' ? inYear : start !== 'bad' && end !== 'bad' && start !== null && end !== null && end < start ? 'On or after the first day' : null,
  }
})

const valid = computed(() => Object.values(errors.value).every((error) => error === null))

function draft(): ComponentDraft | null {
  const start = hasSpan.value ? dayIn(from.value) : null
  const end = hasEnd.value ? dayIn(to.value) : null
  if (!valid.value || start === 'bad' || end === 'bad') return null
  const span = { from: start, to: end }
  const money = parsedAmount.value
  switch (kind.value) {
    case 'salary_gross':
      return atFloor.value ? { component: 'salary_gross', gross: 'floor', ...span } : money === null ? null : { component: 'salary_gross', gross: money, ...span }
    case 'nontaxable':
      return money === null ? null : { component: 'nontaxable', item: item.value, amount: money, ...span }
    case 'rent_monthly':
      return money === null ? null : { component: 'rent_monthly', amount: money, ...span }
    case 'dividend':
      return atMost.value ? { component: 'dividend', amount: 'max', ...span } : money === null ? null : { component: 'dividend', amount: money, ...span }
    case 'director_basis':
      return { component: 'director_basis', basis: basis.value, ...span }
  }
}

/** The component's record as the app read it. */
function storedRow(component: ScenarioComponent): ScenarioRow | null {
  return recordWithId(store.state.records === null ? NO_RECORDS : recordsOfKindIn(store.state.records, SCENARIO_RECORDS), component.id)?.record ?? null
}

async function save(): Promise<void> {
  tried.value = true
  const typed = draft()
  if (typed === null) return
  const component = props.component
  if (component === null) {
    const added = scenarioRowOfComponent(props.scenario.slug, '', props.scenario.year, typed)
    if (await writes.write('Component added', (unit) => unit.of(SCENARIO_WRITES).add(added), { failedTitle: 'Not added' })) open.value = false
    return
  }
  const before = storedRow(component)
  if (before === null) return
  const after = scenarioRowOfComponent(before.slug, before.label, before.year, typed)
  const saved = await writes.write('Component saved', (unit) => unit.of(SCENARIO_WRITES).change(before, after), { description: `${componentInWords(component)}.`, failedTitle: 'Not saved' })
  if (saved) open.value = false
}

async function remove(): Promise<void> {
  const component = props.component
  const before = component === null ? null : storedRow(component)
  if (component === null || before === null) return
  const deleted = await writes.write('Component deleted', (unit) => unit.of(SCENARIO_WRITES).remove(before), { description: `${componentInWords(component)}.`, failedTitle: 'Not deleted' })
  if (deleted) open.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="component === null ? 'Add a component' : 'Edit the component'"
    :description="component === null ? `To ${scenario.label || scenario.slug}, for ${scenario.year}.` : `On the scenarios tab: ${componentInWords(component)}. Only the cells you change are written.`"
  >
    <FormGrid id="scenario-component" as="form" data-testid="scenario-component-form" @submit.prevent="save">
      <UFormField label="What it is" class="sm:col-span-2">
        <USelect v-model="kind" :items="[...KINDS]" class="w-full" data-testid="component-kind" />
      </UFormField>
      <UFormField v-if="kind === 'salary_gross'" class="sm:col-span-2" help="The floor is the lowest base a director employed by the company can be paid on, from the ruleset for the year.">
        <UCheckbox v-model="atFloor" label="At the director floor" data-testid="component-at-floor" />
      </UFormField>
      <UFormField v-if="kind === 'dividend'" class="sm:col-span-2" help="Paid out of the year's profit once its statements are adopted.">
        <UCheckbox v-model="atMost" label="The year's profit after tax, as far as it can be paid out" data-testid="component-at-most" />
      </UFormField>
      <UFormField v-if="kind === 'nontaxable'" label="Item" :error="(tried && errors.item) || false" class="sm:col-span-2">
        <USelect v-model="item" :items="itemChoices" class="w-full" data-testid="component-item" />
      </UFormField>
      <UFormField
        v-if="kind === 'director_basis'"
        label="Insured"
        class="sm:col-span-2"
        help="On a day with a salary the director is an employee. Without one he is a board member only, unless a job elsewhere insures him."
      >
        <USelect v-model="basis" :items="basisChoices" class="w-full" data-testid="component-basis" />
      </UFormField>
      <UFormField
        v-if="needsAmount"
        :label="kind === 'nontaxable' ? 'Amount for the year' : kind === 'dividend' ? 'Dividend' : 'Amount a month'"
        :error="(tried && errors.amount) || false"
        class="sm:col-span-2"
      >
        <UInput v-model="amount" inputmode="decimal" placeholder="0.00" class="w-full" data-testid="component-amount" />
      </UFormField>
      <UFormField
        v-if="hasSpan"
        :label="kind === 'nontaxable' ? 'Paid in the month of' : 'From'"
        :error="(tried && errors.from) || false"
        :help="kind === 'nontaxable' ? 'Blank pays it with the January salary.' : 'Blank is 1 January.'"
      >
        <UInput v-model="from" type="date" class="w-full" data-testid="component-from" />
      </UFormField>
      <UFormField v-if="hasEnd" label="To" :error="(tried && errors.to) || false" help="Blank is 31 December.">
        <UInput v-model="to" type="date" class="w-full" data-testid="component-to" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton v-if="component !== null" label="Delete component" icon="i-lucide-trash-2" color="error" variant="ghost" :disabled="writes.busy.value" data-testid="component-delete" @click="remove" />
    </template>
    <template #end>
      <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="scenario-component"
        :label="component === null ? 'Add component' : 'Save component'"
        :icon="component === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="component-save"
      />
    </template>
  </AppDialog>
</template>
