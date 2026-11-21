<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AllPayeesCard from './AllPayeesCard.vue'
import RankedPayeesCard from './RankedPayeesCard.vue'
import { words } from './words'
import { PAYEE_PERIODS, inPeriod, periodNamed } from '../domain/payeePeriod'
import type { PayeePeriod } from '../domain/payeePeriod'
import { payeeTotals } from '../domain/payeeTotals'
import { payeesLink } from '../../overview/presentation/spendingLinks'
import { countedRows } from '../../analytics/domain/countedRow'
import { unratedNote } from '../../rates/presentation/unratedNote'
import { waitsForRates } from '../../rates/presentation/waitsForRates'
import { words as rateWords } from '../../rates/presentation/words'
import { words as screenWords } from '../../screenWords'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import ItemsMoveNotice from '../../workbook/presentation/ItemsMoveNotice.vue'
import { today } from '../../../../shared/calendar/civilDate'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** Whom money goes to and who pays you over a period, counted as Overview counts: the largest payees on each side, then every payee with their IBANs, each opening their entries. */
const { state } = useSpendingBooks()
const rates = useRates()
const route = useRoute()
const router = useRouter()

const loading = computed(() => state.workbook === null && state.status !== 'error')
const waiting = computed(() => waitsForRates(state.workbook?.accounts ?? [], rates.value))

const period = computed<PayeePeriod>({
  get: () => periodNamed(route.query.period),
  set: (picked) => void router.replace(payeesLink(picked)),
})
const periodOptions = PAYEE_PERIODS.map((value) => ({ value, label: words.period[value] }))

const rows = computed(() => (state.workbook === null ? [] : countedRows(state.workbook, everydayRates(rates.value))))
const categories = computed(() => state.workbook?.categories ?? [])
const everyPayee = computed(() => payeeTotals(rows.value, categories.value))
const totals = computed(() => {
  const counted = inPeriod(period.value, today())
  return payeeTotals(
    rows.value.filter((row) => counted(row.day)),
    categories.value,
  )
})
const subtitle = computed(() => {
  if (waiting.value) return rateWords.loading
  return unratedNote(totals.value.reduce((sum, payee) => sum + payee.unrated, 0))
})
const people = computed(() => state.workbook?.settings.personPayees ?? [])
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="screenWords.payees" :description="words.description" />
    <ItemsMoveNotice />
    <ScreenSkeleton v-if="loading" :heading="false" :cards="2" data-testid="spending-payees-loading" />
    <template v-else-if="state.workbook !== null">
      <EmptyState v-if="everyPayee.length === 0" icon="i-lucide-users-round" :title="words.empty.title" :description="words.empty.description" data-testid="spending-payees-empty" />
      <template v-else>
        <ChoiceButtons v-model="period" :options="periodOptions" :label="words.period.label" data-testid="spending-payees-period" />
        <DashboardGrid>
          <RankedPayeesCard :totals="totals" side="paid" :period="period" :subtitle="subtitle" />
          <RankedPayeesCard :totals="totals" side="received" :period="period" :subtitle="subtitle" />
        </DashboardGrid>
        <AllPayeesCard :totals="totals" :period="period" :people="people" />
      </template>
    </template>
  </section>
</template>
