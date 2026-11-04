<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import USelect from '@nuxt/ui/components/Select.vue'

import { foreignIncomeYear } from '../domain/foreignIncome'
import { FIRST_TAX_YEAR } from '../domain/taxRules'
import { capitalGainsYear, taxYearsOf, yearsWithoutRules } from '../domain/taxYear'
import ForeignIncomeTab from './ForeignIncomeTab.vue'
import SalesTab from './SalesTab.vue'
import { TAX_TABS, yearNamed } from './taxLinks'
import type { TaxTab } from './taxLinks'
import TaxFreeTab from './TaxFreeTab.vue'
import { words } from './words'
import YearTab from './YearTab.vue'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { hasTransactions } from '../../workbook/domain/investmentBook'
import { yearDueNext } from '../domain/taxDeadlines'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../../shared/ui/PageTabs.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/**
 * The tax on the investments, for the year picked: the year's figures with what to type into the JOPPD, its
 * sales by the lots they closed, its income from abroad, and the lots that turn tax-free, which reads no year.
 */
const { state } = useInvestmentsBooks()
const { sources, figures } = usePortfolio()
const route = useRoute()
const router = useRouter()

const TAB_LOOKS: Readonly<Record<TaxTab, Omit<PageTab, 'value'>>> = {
  year: { label: words.tabs.year, icon: 'i-lucide-landmark' },
  sales: { label: words.tabs.sales, icon: 'i-lucide-receipt' },
  foreign: { label: words.tabs.foreign, icon: 'i-lucide-globe' },
  'tax-free': { label: words.tabs.taxFree, icon: 'i-lucide-calendar-check' },
}

const TABS: readonly PageTab[] = TAX_TABS.map((value) => ({ value, ...TAB_LOOKS[value] }))

const loading = computed(() => (state.workbook === null && state.status !== 'error') || (state.workbook !== null && hasTransactions(state.workbook.book) && sources.value === null))
const years = computed(() => (sources.value === null ? [] : taxYearsOf(sources.value.book, sources.value.today)))
const year = computed(() => (sources.value === null ? null : yearNamed(years.value, route.query.year, sources.value.today)))
const leftOutYears = computed(() => (sources.value === null ? [] : yearsWithoutRules(sources.value.book)))
const yearChoices = computed(() => years.value.map((offered) => ({ value: String(offered), label: String(offered) })))
const onTaxFree = computed(() => route.query.tab === 'tax-free')

const gains = computed(() => (sources.value === null || year.value === null ? null : capitalGainsYear(sources.value.book, sources.value.rates, year.value)))
const foreign = computed(() => (sources.value === null || year.value === null ? null : foreignIncomeYear(sources.value.book, sources.value.rates, year.value)))
const empty = computed(() => gains.value !== null && foreign.value !== null && gains.value.sales.length === 0 && foreign.value.payments.length === 0)

/** The year whose JOPPD is due next is the default and stays out of the address. */
function pickYear(picked: string): void {
  const { year: _left, ...others } = route.query
  const isDefault = sources.value !== null && picked === String(yearDueNext(sources.value.today))
  void router.replace({ query: isDefault ? others : { ...others, year: picked } })
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="onTaxFree ? words.taxFreeDescription : words.description" />
    <ScreenSkeleton v-if="loading" :heading="false" :cards="2" data-testid="tax-loading" />
    <template v-else-if="sources !== null && year !== null && gains !== null && foreign !== null">
      <USelect
        v-if="!onTaxFree"
        :model-value="String(year)"
        :items="yearChoices"
        :aria-label="words.year"
        size="sm"
        class="w-28"
        data-testid="tax-year"
        @update:model-value="pickYear(String($event))"
      />
      <p v-if="leftOutYears.length > 0 && !onTaxFree" class="type-caption" data-testid="tax-years-without-rules">
        {{ words.yearsWithoutRules(leftOutYears, FIRST_TAX_YEAR) }}
      </p>
      <PageTabs :tabs="TABS" :label="words.tabs.label" data-testid="tax-tabs">
        <template #year>
          <EmptyState v-if="empty" icon="i-lucide-landmark" :title="words.empty.title(year)" :description="words.empty.description" data-testid="tax-empty" />
          <YearTab v-else :gains="gains" :foreign="foreign" :today="sources.today" />
        </template>
        <template #sales>
          <EmptyState v-if="empty" icon="i-lucide-receipt" :title="words.empty.title(year)" :description="words.empty.description" data-testid="tax-empty" />
          <EmptyState v-else-if="gains.sales.length === 0" icon="i-lucide-receipt" :title="words.noSales(year)" :description="words.empty.description" data-testid="tax-no-sales" />
          <SalesTab v-else :gains="gains" :sources="sources" />
        </template>
        <template #foreign>
          <EmptyState v-if="empty" icon="i-lucide-globe" :title="words.empty.title(year)" :description="words.empty.description" data-testid="tax-empty" />
          <EmptyState v-else-if="foreign.payments.length === 0" icon="i-lucide-globe" :title="words.noForeign(year)" :description="words.empty.description" data-testid="tax-no-foreign" />
          <ForeignIncomeTab v-else :foreign="foreign" />
        </template>
        <template #tax-free>
          <TaxFreeTab v-if="figures !== null" :figures="figures" :today="sources.today" />
          <ScreenSkeleton v-else :heading="false" :cards="1" />
        </template>
      </PageTabs>
    </template>
  </section>
</template>
