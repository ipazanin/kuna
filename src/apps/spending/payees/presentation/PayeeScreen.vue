<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { words } from './words'
import { payeeNamed } from '../domain/payeeDirectory'
import { keyOfPayee } from '../domain/payeeDetails'
import { PAYEE_PERIODS, periodNamed } from '../domain/payeePeriod'
import type { PayeePeriod } from '../domain/payeePeriod'
import { payeeEntryLines, payeeSummary } from '../domain/payeeSummary'
import type { CategoryMonth } from '../../analytics/domain/categoryMonths'
import { countedRows } from '../../analytics/domain/countedRow'
import { categoryMonthsChart } from '../../analytics/presentation/categoryMonthsChart'
import EntryDialog from '../../entries/presentation/EntryDialog.vue'
import EntryList from '../../entries/presentation/EntryList.vue'
import { payeeLink, payeePageLink, payeesLink } from '../../overview/presentation/spendingLinks'
import ReceiptPhotoPicker from '../../receipts/presentation/ReceiptPhotoPicker.vue'
import { useReceiptRows } from '../../receipts/presentation/useReceiptRows'
import { unratedNote } from '../../rates/presentation/unratedNote'
import { waitsForRates } from '../../rates/presentation/waitsForRates'
import { words as rateWords } from '../../rates/presentation/words'
import { words as screenWords } from '../../screenWords'
import { dayOfLine, entriesAndSharedCosts } from '../../sharedCosts/domain/sharedCostEntries'
import SharedCostDialog from '../../sharedCosts/presentation/SharedCostDialog.vue'
import { sharedCostHomes } from '../../sharedCosts/presentation/sharedCostNames'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import type { Transaction } from '../../workbook/domain/transaction'
import { assistKeyKept } from '../../../../shared/ai/presentation/aiProvider'
import { today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { ZERO, negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatCount, formatMoney } from '../../../../shared/money/moneyFormat'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import { groupedIban } from '../../../../shared/text/iban'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

/**
 * One payee over the Payees period it was opened from: money out and in, which open the same entries on Entries, the average
 * month, the details you keep of them, each side's last 12 months and the entries newest first, each opening its dialog.
 */
const { state } = useSpendingBooks()
const rates = useRates()
const route = useRoute()
const router = useRouter()
const day = today()

const period = computed<PayeePeriod>({
  get: () => periodNamed(route.query.period),
  set: (picked) => void (payee.value === null ? undefined : router.replace(payeePageLink(payee.value.key, picked))),
})
const periodOptions = PAYEE_PERIODS.map((value) => ({ value, label: words.period[value] }))

const payee = computed(() => (state.workbook === null ? null : payeeNamed(state.workbook, route.query.payee)))
const record = computed(() => state.workbook?.payees.find((held) => payee.value !== null && keyOfPayee(held) === payee.value.key) ?? null)
const waiting = computed(() => waitsForRates(state.workbook?.accounts ?? [], rates.value))
const rows = computed(() => (state.workbook === null ? [] : countedRows(state.workbook, everydayRates(rates.value))))
const summary = computed(() => (state.workbook === null || payee.value === null ? null : payeeSummary(state.workbook, rows.value, payee.value.key, period.value, day)))

const description = computed(() => {
  const held = record.value
  if (held === null) return null
  const party = held.party === 'person' ? words.person : held.party === 'business' ? words.page.business : ''
  const others = held.names.slice(1).join(', ')
  return party === '' && others === '' ? null : words.page.about(party, others)
})

const entriesLink = computed(() => payeeLink(payee.value?.key ?? '', period.value))
const spent = computed(() => summary.value?.totals?.spent ?? ZERO)
const received = computed(() => summary.value?.totals?.income ?? ZERO)
const unrated = computed(() => (waiting.value ? null : unratedNote(summary.value?.totals?.unrated ?? 0)))
const showsOut = computed(() => spent.value !== 0 || received.value === 0)
const showsIn = computed(() => received.value !== 0)
/** The side the average reads: money in for a payee who only pays you, money out otherwise. */
const averageSide = computed(() => (summary.value !== null && summary.value.average.out === 0 && (summary.value.average.in ?? 0) !== 0 ? 'in' : 'out'))
const average = computed(() => summary.value?.average[averageSide.value] ?? null)
const averageAmount = (amount: Money): Money => (averageSide.value === 'in' ? amount : negateMoney(amount))

const categoryName = (id: string | null): string => (id === null ? '' : (state.workbook?.categories.find((category) => category.id === id)?.name ?? ''))
const ibans = computed(() => (summary.value?.totals?.ibans ?? record.value?.ibans ?? []).map(groupedIban))
/** The entry facts read the lines the Entries card lists, so they agree with it. */
const facts = computed(() => {
  const shown = summary.value
  if (shown === null) return []
  const held = record.value
  const newest = lines.value[0]
  const oldest = lines.value.at(-1)
  return [
    { label: words.page.entryCount, value: lines.value.length === 0 ? '' : formatCount(lines.value.length) },
    { label: words.page.firstDay, value: oldest === undefined ? '' : dayLabel(dayOfLine(oldest)) },
    { label: words.page.lastDay, value: newest === undefined ? '' : dayLabel(dayOfLine(newest)) },
    { label: words.page.usualOut, value: categoryName(shown.usual.out) },
    { label: words.page.usualIn, value: categoryName(shown.usual.in) },
    { label: words.page.taxId, value: held?.taxId ?? '' },
    { label: words.page.website, value: held?.website ?? '' },
    { label: words.page.note, value: held?.note ?? '' },
  ].filter((fact) => fact.value !== '')
})

/** A chart for each side with money in the last 12 months. */
const charts = computed(() => {
  const shown = summary.value
  if (shown === null) return []
  const current = monthOf(day)
  const sides: readonly { readonly side: 'out' | 'in'; readonly name: string; readonly token: string; readonly months: readonly CategoryMonth[] }[] = [
    { side: 'out', name: words.page.out, token: '--chart-ink-muted', months: shown.months.out },
    { side: 'in', name: words.page.in, token: '--tone-positive-soft', months: shown.months.in },
  ]
  return sides
    .filter(({ months }) => months.some((month) => month.counted !== 0))
    .map(({ side, name, token, months }) => ({ side, name, chart: categoryMonthsChart(months, name, token, shown.average[side], current, chartTokens()) }))
})

const lines = computed(() => {
  const book = state.workbook
  const shown = payee.value
  if (book === null || shown === null) return []
  return payeeEntryLines(entriesAndSharedCosts(book, everydayRates(rates.value)), shown.key, book, period.value, day)
})
const expanded = ref(false)
watch(period, () => (expanded.value = false))
const listed = computed(() => (expanded.value ? lines.value : lines.value.slice(0, FIRST_SHOWN)))
const homes = computed(() => sharedCostHomes(state.workbook))

const entryOpen = ref(false)
const entry = ref<Transaction | null>(null)
const sharedCostOpen = ref(false)
const openedSharedCost = ref<SharedCost | null>(null)
const takesReceipt = useReceiptRows()
const receiptPicker = useTemplateRef('receiptPicker')

function openEntry(picked: Transaction): void {
  entry.value = picked
  entryOpen.value = true
}

function openSharedCost(picked: SharedCost): void {
  openedSharedCost.value = picked
  sharedCostOpen.value = true
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <UButton :to="payeesLink(period)" :label="words.page.allPayees" icon="i-lucide-arrow-left" color="neutral" variant="link" class="-mb-4 self-start px-0" data-testid="spending-back-to-payees" />
    <ScreenSkeleton v-if="state.workbook === null && state.status !== 'error'" />
    <template v-else-if="state.workbook !== null && payee !== null && summary !== null">
      <PageHeader :title="payee.name" v-bind="description === null ? {} : { description }" class="break-words" />
      <ChoiceButtons v-model="period" :options="periodOptions" :label="words.period.label" data-testid="spending-payee-period" />
      <DashboardGrid layout="tiles">
        <KpiTile
          v-if="showsOut"
          :label="words.page.out"
          :value="formatMoney(negateMoney(spent), 'always')"
          v-bind="unrated === null ? {} : { caption: unrated }"
          :to="entriesLink"
          data-testid="spending-payee-out"
        >
          <template #value>
            <span v-if="waiting" class="block type-body font-normal">{{ rateWords.loading }}</span>
            <MoneyText v-else :cents="negateMoney(spent)" tone="flow" :data-amount="spent" />
          </template>
        </KpiTile>
        <KpiTile v-if="showsIn" :label="words.page.in" :value="formatMoney(received, 'always')" v-bind="unrated === null ? {} : { caption: unrated }" :to="entriesLink" data-testid="spending-payee-in">
          <template #value>
            <span v-if="waiting" class="block type-body font-normal">{{ rateWords.loading }}</span>
            <MoneyText v-else :cents="received" tone="flow" :data-amount="received" />
          </template>
        </KpiTile>
        <KpiTile
          :label="averageSide === 'in' ? words.page.averageIn : words.page.averageOut"
          :value="average === null ? words.page.noAverage : formatMoney(averageAmount(average), 'always')"
          v-bind="summary.averagedMonths === 0 ? {} : { caption: plural(words.page.averageCaption(summary.averagedMonths), summary.averagedMonths) }"
          :to="null"
          data-testid="spending-payee-average"
        >
          <template #value>
            <span v-if="waiting || average === null" class="block type-body font-normal">{{ waiting ? rateWords.loading : words.page.noAverage }}</span>
            <MoneyText v-else :cents="averageAmount(average)" tone="flow" />
          </template>
        </KpiTile>
      </DashboardGrid>
      <AppCard v-if="facts.length > 0 || ibans.length > 0" :title="words.page.details" data-testid="spending-payee-details">
        <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
          <FactGrid v-if="facts.length > 0" :facts="facts">
            <template #value="{ fact }">
              <span class="type-body break-words">{{ fact.value }}</span>
            </template>
          </FactGrid>
          <dl v-if="ibans.length > 0">
            <dt class="type-caption">{{ words.page.ibans }}</dt>
            <dd v-for="iban in ibans" :key="iban" class="mt-0.5 figure type-body" data-testid="spending-payee-iban">{{ iban }}</dd>
          </dl>
        </div>
      </AppCard>
      <ChartCard
        v-for="shown in charts"
        :key="shown.side"
        :title="words.page.chartTitle(shown.name)"
        :description="shown.chart.description"
        :option="shown.chart.option"
        :loading="waiting"
        :height="240"
        :phone-height="220"
        :data-testid="`spending-payee-chart-${shown.side}`"
      >
        <template #legend><ChartLegend :entries="shown.chart.legend" /></template>
      </ChartCard>
      <EmptyState
        v-if="lines.length === 0"
        icon="i-lucide-receipt"
        :title="words.page.noEntries"
        :actions="[{ label: words.page.openEntries, to: entriesLink, trailingIcon: 'i-lucide-arrow-right', color: 'neutral', variant: 'link' }]"
        data-testid="spending-payee-no-entries"
      />
      <AppCard v-else :title="words.page.entries" :subtitle="words.page.entriesSubtitle" data-testid="spending-payee-entries">
        <EntryList
          :lines="listed"
          :categories="state.workbook.categories"
          :labels="state.workbook.labels"
          :homes="homes"
          heading="h3"
          :takes-receipt="takesReceipt"
          @open="openEntry"
          @open-shared-cost="openSharedCost"
          @receipt="receiptPicker?.take($event)"
        />
        <ShowAllButton v-if="lines.length > FIRST_SHOWN" v-model:expanded="expanded" :total="lines.length" class="px-4 pb-4 sm:px-5" />
        <div class="px-4 pt-1 pb-4 sm:px-5">
          <UButton :to="entriesLink" :label="words.page.openEntries" trailing-icon="i-lucide-arrow-right" color="neutral" variant="link" class="px-0" data-testid="spending-payee-open-entries" />
        </div>
      </AppCard>
      <EntryDialog v-model:open="entryOpen" :entry="entry" />
      <SharedCostDialog v-model:open="sharedCostOpen" :shared-cost="openedSharedCost" :rows="[]" />
      <ReceiptPhotoPicker v-if="assistKeyKept" ref="receiptPicker" />
    </template>
    <template v-else-if="state.workbook !== null">
      <PageHeader :title="screenWords.payee" />
      <EmptyState icon="i-lucide-user-round-x" :title="words.page.missing.title" :description="words.page.missing.description" data-testid="spending-payee-missing" />
    </template>
  </section>
</template>
