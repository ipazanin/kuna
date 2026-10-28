<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { balanceChart } from '../../balances/presentation/balanceChart'
import { informalLoanNamed, LOANS_OVERVIEW_ROUTE } from '../../overview/presentation/loanLinks'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { Movement } from '../../workbook/domain/movement'
import InformalLoanDialog from './InformalLoanDialog.vue'
import { MOVEMENT_KIND_NAMES, informalLoanFigures, informalLoanMonths, movementLines, whoOwes } from './informalLoanView'
import MovementDialog from './MovementDialog.vue'
import { today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

/** One informal loan: what is owed, the balance over time, and its movements newest first. */
const { state } = useLoansBooks()
const route = useRoute()
const day = today()

const book = computed(() => (state.workbook === null ? null : informalLoanNamed(state.workbook, route.query.loan)))
const figures = computed(() => (book.value === null ? null : informalLoanFigures(book.value, day)))
const chart = computed(() => (book.value === null ? null : balanceChart(informalLoanMonths(book.value, day), monthOf(day), chartTokens())))
const lines = computed(() => (book.value === null ? [] : movementLines(book.value)))
const showAll = ref(false)
const shown = computed(() => (showAll.value ? lines.value : lines.value.slice(0, FIRST_SHOWN)))

const editingLoan = ref(false)
const movementOpen = ref(false)
const editingMovement = ref<Movement | null>(null)

function openMovement(movement: Movement | null): void {
  editingMovement.value = movement
  movementOpen.value = true
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <UButton :to="LOANS_OVERVIEW_ROUTE" label="All loans" icon="i-lucide-arrow-left" color="neutral" variant="link" class="-mb-4 self-start px-0" data-testid="back-to-loans" />
    <template v-if="book !== null && figures !== null">
      <PageHeader :title="book.loan.name" :description="[book.loan.counterparty, 'No interest and no fixed plan', book.loan.note].filter((part) => part !== '').join('. ')">
        <template #actions>
          <UButton label="Change loan" icon="i-lucide-pencil" color="neutral" variant="outline" data-testid="informal-loan-edit" @click="editingLoan = true" />
          <UButton label="Add movement" icon="i-lucide-plus" data-testid="movement-add" @click="openMovement(null)" />
        </template>
      </PageHeader>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiTile :label="whoOwes(figures.owedByYou)" :value="formatMoney(Math.abs(figures.owedByYou))" :caption="`At the end of ${dayLabel(day)}`" :to="null" />
        <KpiTile
          label="Last movement"
          :value="figures.last === null ? 'None yet' : formatMoney(figures.last.amount)"
          :caption="figures.last === null ? `Started on ${dayLabel(book.loan.start)}` : `${MOVEMENT_KIND_NAMES[figures.last.kind]} on ${dayLabel(figures.last.date)}`"
          :to="null"
        />
      </div>
      <ChartCard
        v-if="chart !== null"
        title="Owed over time"
        subtitle="What you owe at each month end. Below zero, they owe you."
        :option="chart.option"
        :description="chart.description"
        :height="260"
        :phone-height="220"
        data-testid="loan-balance-chart"
      />
      <AppCard title="Movements" subtitle="Newest first, with what you owe after each." collapse-id="loans.movements" :summary="`${lines.length} movements`" data-testid="movement-list">
        <p v-if="lines.length === 0" class="px-4 pb-4 text-sm text-muted sm:px-5">No movements yet. The loan owes its opening balance of {{ formatMoney(book.loan.openingBalance) }}.</p>
        <ul v-else class="flex flex-col pb-2">
          <li v-for="line in shown" :key="line.movement.id" class="flex items-center gap-3 border-t border-default px-4 py-2 first:border-t-0 sm:px-5" data-testid="movement-line">
            <div class="min-w-0 flex-1">
              <p class="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span class="text-highlighted">{{ line.kind }}</span>
                <MoneyText :cents="line.change" sign="always" />
              </p>
              <p class="text-xs text-muted">{{ [dayLabel(line.movement.date), line.movement.note].filter((part) => part !== '').join(', ') }}</p>
            </div>
            <p class="text-end text-xs text-muted">
              {{ whoOwes(line.owedAfter) }}<br />
              <MoneyText :cents="Math.abs(line.owedAfter)" class="text-sm text-toned" />
            </p>
            <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" :aria-label="`Change the movement of ${dayLabel(line.movement.date)}`" data-testid="movement-edit" @click="openMovement(line.movement)" />
          </li>
        </ul>
        <div v-if="lines.length > FIRST_SHOWN" class="px-4 pb-4 sm:px-5">
          <ShowAllButton v-model:expanded="showAll" :total="lines.length" />
        </div>
      </AppCard>
      <InformalLoanDialog v-model:open="editingLoan" :book="book" />
      <MovementDialog v-model:open="movementOpen" :book="book" :editing="editingMovement" :today="day" />
    </template>
    <template v-else-if="state.workbook !== null">
      <PageHeader title="Informal loan" />
      <AppCard>
        <p class="px-4 py-6 text-sm text-muted sm:px-5" data-testid="loan-missing">The Loans file holds no informal loan by this link. It may have been deleted.</p>
      </AppCard>
    </template>
  </section>
</template>
