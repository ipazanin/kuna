<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { useWorkbook } from '../../../../features/workbook/application/workbookStore'
import type { OwnerPayScenario } from '../../../../features/workbook/domain/ownerPayScenarios'
import type { PlanLine } from '../../../../features/workbook/domain/plan'
import type { Category } from '../../../../features/workbook/domain/workbook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { Money } from '../../../../shared/money/money'
import { dayLabel } from '../../ruleset/presentation/ruleWording'
import type { PlanDefault } from '../../domain/forecast/forecastYear'
import { isOwnerPayCost } from '../../domain/packRoles'
import CategoryPlanDialog from './CategoryPlanDialog.vue'
import DividendPlanDialog from './DividendPlanDialog.vue'
import OwnerPayPlanDialog from './OwnerPayPlanDialog.vue'
import PurchasePlanDialog from './PurchasePlanDialog.vue'
import { GROUP_WORDS } from './planWording'

type AmountLine = Extract<PlanLine, { readonly kind: 'amount' }>
type PurchaseLine = Extract<PlanLine, { readonly kind: 'purchase' }>
type OwnerPayLine = Extract<PlanLine, { readonly kind: 'owner-pay-scenario' }>

/** The plan tab's rows for one year, by what they plan: the owner pay, each category, the purchases and the dividend. */
const props = defineProps<{
  year: number
  lines: readonly PlanLine[]
  /** What each category takes in a month with no plan row. Empty when the ledger gives nothing to average. */
  defaults: readonly PlanDefault[]
  categories: readonly Category[]
  /** The scenarios of the year, to choose the owner pay from. */
  scenarios: readonly OwnerPayScenario[]
  /** Why the forecast does not count a row, by its row on the tab. */
  notCounted: ReadonlyMap<number, string>
  suggestedSwitch: CivilDate | null
  categoryName: (slug: string) => string
}>()

const store = useWorkbook()

const ownerPayLines = computed(() => props.lines.filter((line): line is OwnerPayLine => line.kind === 'owner-pay-scenario'))
const purchases = computed(() => props.lines.filter((line): line is PurchaseLine => line.kind === 'purchase').sort((earlier, later) => earlier.date.localeCompare(later.date)))
const dividend = computed(() => props.lines.find((line): line is AmountLine => line.kind === 'amount' && line.item === 'dividend') ?? null)
const ownerPaySet = computed(() => ownerPayLines.value.some((line) => line.from === null) && ownerPayLines.value.every((line) => !props.notCounted.has(line.sheetRow)))

const scenarioName = (slug: string) => {
  const scenario = props.scenarios.find((candidate) => candidate.slug === slug)
  return scenario === undefined ? slug : scenario.label || scenario.slug
}

const ownerPayWords = computed(() => {
  const opening = ownerPayLines.value.find((line) => line.from === null)
  const switched = ownerPayLines.value.find((line) => line.from !== null)
  if (opening === undefined && switched === undefined) return null
  const start = opening === undefined ? 'No scenario from 1 January' : `${scenarioName(opening.scenario)} from 1 January`
  return switched === undefined || switched.from === null ? start : `${start}, then ${scenarioName(switched.scenario)} from ${dayLabel(switched.from)}`
})
const ownerPayReasons = computed(() => [...new Set(ownerPayLines.value.flatMap((line) => props.notCounted.get(line.sheetRow) ?? []))])

interface CategoryEntry {
  readonly category: Category
  readonly name: string
  readonly lines: readonly AmountLine[]
  readonly average: Money | null
  readonly averageWords: string | null
  readonly caption: string
  readonly reasons: readonly string[]
}

const entries = computed((): CategoryEntry[] => {
  const amountLines = props.lines.filter((line): line is AmountLine => line.kind === 'amount' && line.item !== 'dividend')
  return props.categories
    .filter((category) => props.defaults.some((entry) => entry.category.slug === category.slug && entry.average.amount !== 0) || amountLines.some((line) => line.item === category.slug))
    .map((category): CategoryEntry => {
      const lines = amountLines.filter((line) => line.item === category.slug)
      const fallback = props.defaults.find((entry) => entry.category.slug === category.slug) ?? null
      const average = fallback?.average.amount ?? null
      const name = props.categoryName(category.slug)
      return {
        category,
        name,
        lines,
        average,
        averageWords: fallback?.average.label ?? null,
        caption: captionOf(category, lines, average, fallback?.lastMonth ?? false),
        reasons: [...new Set(lines.flatMap((line) => props.notCounted.get(line.sheetRow) ?? []))],
      }
    })
})

function money(cents: Money): string {
  return formatMoney(Math.abs(cents) as Money)
}

function captionOf(category: Category, lines: readonly AmountLine[], average: Money | null, lastMonth: boolean): string {
  if (ownerPaySet.value && isOwnerPayCost(category)) return 'Set by the owner pay scenario'
  const every = lines.find((line) => line.month === null)
  const own = lines.filter((line) => line.month !== null).length
  const ownWords = own === 0 ? '' : `, ${own === 1 ? 'one month' : `${own} months`} of its own`
  if (every !== undefined) return `Planned at ${money(every.amount)} a month${ownWords}`
  const rest = average === null ? 'nothing' : `${money(average)} a month, ${lastMonth ? 'as in the last month' : 'the average'}`
  return own === 0 ? `No plan row, so ${rest}` : `Planned in ${own === 1 ? 'one month' : `${own} months`}, the rest ${rest}`
}

const categoryOpen = ref(false)
const editingCategory = ref<CategoryEntry | null>(null)
const ownerPayOpen = ref(false)
const purchaseOpen = ref(false)
const editingPurchase = ref<PurchaseLine | null>(null)
const dividendOpen = ref(false)

function editCategory(entry: CategoryEntry): void {
  editingCategory.value = entry
  categoryOpen.value = true
}

function editPurchase(purchase: PurchaseLine | null): void {
  editingPurchase.value = purchase
  purchaseOpen.value = true
}

const summary = computed(() => {
  const count = props.lines.length
  return count === 0 ? 'No plan row yet' : `${count} ${count === 1 ? 'row' : 'rows'}${ownerPayWords.value === null ? '' : `, ${ownerPayWords.value}`}`
})
</script>

<template>
  <AppCard
    :title="`Plan for ${year}`"
    subtitle="Rows of the plan tab. A change is written at once, with Undo in the toast. Revenue is planned on the Billing plan."
    collapse-id="forecast.plan"
    :summary="summary"
    data-testid="plan-editor"
  >
    <div class="flex flex-col gap-5 px-4 pt-3 pb-4 sm:px-5">
      <section class="flex flex-col gap-2" data-testid="plan-owner-pay">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-medium text-highlighted">Owner pay</h3>
          <UButton
            v-if="scenarios.length > 0"
            :label="ownerPayLines.length === 0 ? 'Plan the owner pay' : 'Change'"
            :icon="ownerPayLines.length === 0 ? 'i-lucide-plus' : 'i-lucide-pencil'"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="store.state.writing"
            data-testid="plan-owner-pay-edit"
            @click="ownerPayOpen = true"
          />
        </div>
        <p class="text-sm text-toned">
          <template v-if="ownerPayWords">{{ ownerPayWords }}.</template>
          <template v-else-if="scenarios.length === 0">
            No scenario is for {{ year }} yet, so the owner pay categories take their averages. Add one on
            <DrillLink :to="{ path: '/pay-scenarios', query: { year: String(year) } }" in-prose class="text-highlighted">Pay scenarios</DrillLink>.
          </template>
          <template v-else>Not planned, so the owner pay categories take their averages.</template>
        </p>
        <p v-for="reason in ownerPayReasons" :key="reason" class="flex items-start gap-2 text-xs text-[var(--tone-warning)]">
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>Not counted. {{ reason }}</span>
        </p>
      </section>

      <section class="flex flex-col gap-1" data-testid="plan-categories">
        <h3 class="text-sm font-medium text-highlighted">Costs and other income, by category</h3>
        <p v-if="entries.length === 0" class="py-2 text-sm text-muted">No category has a month to average yet.</p>
        <ul v-else class="flex flex-col">
          <li v-for="entry in entries" :key="entry.category.slug">
            <button
              type="button"
              class="plan-row"
              :data-category="entry.category.slug"
              :aria-label="`${entry.name}: ${entry.caption}. Edit the plan`"
              :disabled="store.state.writing || (ownerPaySet && isOwnerPayCost(entry.category))"
              data-testid="plan-category"
              @click="editCategory(entry)"
            >
              <span class="min-w-0 text-start">
                <span class="block text-sm text-toned">{{ entry.name }}</span>
                <span class="block text-xs text-muted">{{ entry.caption }}</span>
                <span v-for="reason in entry.reasons" :key="reason" class="mt-0.5 block text-xs text-[var(--tone-warning)]">Not counted. {{ reason }}</span>
              </span>
              <UIcon v-if="!(ownerPaySet && isOwnerPayCost(entry.category))" name="i-lucide-pencil" class="size-4 shrink-0 text-dimmed" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-1" data-testid="plan-purchases">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-medium text-highlighted">Purchases</h3>
          <UButton label="Plan a purchase" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" :disabled="store.state.writing" data-testid="plan-add-purchase" @click="editPurchase(null)" />
        </div>
        <p v-if="purchases.length === 0" class="py-2 text-sm text-muted">None planned.</p>
        <ul v-else class="flex flex-col">
          <li v-for="purchase in purchases" :key="purchase.sheetRow">
            <button type="button" class="plan-row" :aria-label="`${purchase.note || 'Purchase'}, ${dayLabel(purchase.date)}: edit`" :disabled="store.state.writing" data-testid="plan-purchase" @click="editPurchase(purchase)">
              <span class="min-w-0 text-start">
                <span class="block text-sm text-toned">{{ purchase.note || 'Purchase' }}</span>
                <span class="block text-xs text-muted">{{ dayLabel(purchase.date) }}, {{ GROUP_WORDS[purchase.group].toLowerCase() }}</span>
                <span v-if="notCounted.get(purchase.sheetRow)" class="mt-0.5 block text-xs text-[var(--tone-warning)]">Not counted. {{ notCounted.get(purchase.sheetRow) }}</span>
              </span>
              <MoneyText :cents="purchase.amount" class="shrink-0 text-sm text-toned" />
            </button>
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-1" data-testid="plan-dividend">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-medium text-highlighted">Dividend</h3>
          <UButton
            v-if="dividend === null"
            label="Plan a dividend"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="store.state.writing"
            data-testid="plan-add-dividend"
            @click="dividendOpen = true"
          />
        </div>
        <p v-if="dividend === null" class="py-2 text-sm text-muted">None planned. Dividend capacity on this screen sets out what the year can pay.</p>
        <button v-else type="button" class="plan-row" :aria-label="`Dividend: edit`" :disabled="store.state.writing" data-testid="plan-dividend-row" @click="dividendOpen = true">
          <span class="min-w-0 text-start">
            <span class="block text-sm text-toned">Paid in {{ dividend.month === null ? year : monthLabel(monthKey(year, dividend.month)) }}</span>
            <span v-if="dividend.note" class="block text-xs text-muted">{{ dividend.note }}</span>
            <span v-if="notCounted.get(dividend.sheetRow)" class="mt-0.5 block text-xs text-[var(--tone-warning)]">Not counted. {{ notCounted.get(dividend.sheetRow) }}</span>
          </span>
          <MoneyText :cents="dividend.amount" class="shrink-0 text-sm text-toned" />
        </button>
      </section>
    </div>

    <CategoryPlanDialog
      v-if="editingCategory"
      v-model:open="categoryOpen"
      :year="year"
      :slug="editingCategory.category.slug"
      :name="editingCategory.name"
      :average="editingCategory.average"
      :average-words="editingCategory.averageWords"
      :lines="editingCategory.lines"
    />
    <OwnerPayPlanDialog v-model:open="ownerPayOpen" :year="year" :scenarios="scenarios" :lines="ownerPayLines" :suggested-switch="suggestedSwitch" />
    <PurchasePlanDialog v-model:open="purchaseOpen" :year="year" :purchase="editingPurchase" />
    <DividendPlanDialog v-model:open="dividendOpen" :year="year" :dividend="dividend" />
  </AppCard>
</template>

<style scoped>
.plan-row {
  display: flex;
  width: 100%;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.375rem 0.25rem;
  border-radius: var(--radius-control);
}

.plan-row:not(:disabled):hover {
  background: var(--surface-elevated);
}

.plan-row:disabled {
  cursor: default;
}

li + li > .plan-row {
  border-top: 1px solid var(--border-default);
}
</style>
