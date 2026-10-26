<script setup lang="ts">
import { computed, ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { chartTokens } from '../../../../shared/charts/chartTokens'
import { formatMoney, formatWholeMoney } from '../../../../shared/money/moneyFormat'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DonutCard from '../../../../shared/ui/DonutCard.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import DrillChartCard from '../../../../features/filters/presentation/DrillChartCard.vue'
import { bridgeChart } from '../bridgeChart'
import BuildUpButton from '../BuildUpButton.vue'
import FigureDialog from '../FigureDialog.vue'
import type { FigureDetail } from '../tracedFigureView'
import SalaryProblemList from './SalaryProblemList.vue'
import SalaryReconciliationCard from './SalaryReconciliationCard.vue'
import type { SalaryMonthView } from './salariesView'

/** One payday: what it cost and where the money went, gross to net, the problems to resolve and every line the sources state. */
const props = defineProps<{
  view: SalaryMonthView
}>()

const bridge = computed(() => bridgeChart(props.view.bridge, chartTokens(), { raises: 'Added to the pay', lowers: 'Leaves the pay' }))

const opened = ref<FigureDetail | null>(null)
const dialogOpen = computed({
  get: () => opened.value !== null,
  set: (open: boolean) => {
    if (!open) opened.value = null
  },
})
</script>

<template>
  <div class="flex flex-col gap-6" :data-payday="view.payday">
    <p v-if="view.unpaid" class="flex items-start gap-2 text-sm text-toned" data-testid="salaries-unpaid">
      <UIcon name="i-lucide-hourglass" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
      <span>{{ view.label }} is still running, so its payroll may not all be paid yet.</span>
    </p>

    <div class="salary-tiles grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="salaries-tiles">
      <KpiTile v-for="tile in view.tiles" :key="tile.label" v-bind="tile" />
    </div>

    <p v-if="view.strip" class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-toned" data-testid="salaries-strip">
      <span class="font-medium text-highlighted">{{ view.strip.name }}</span>
      <span>
        Gross <MoneyText :cents="view.strip.gross" /> to net
        <BuildUpButton v-if="view.strip.netDetail" :cents="view.strip.net" :label="`${view.strip.name}, net salary in ${view.label}`" @open="opened = view.strip.netDetail" />
        <MoneyText v-else :cents="view.strip.net" /><template v-if="view.strip.paidOn">, paid {{ view.strip.paidOn }}</template>
      </span>
    </p>

    <div class="grid gap-4 xl:grid-cols-2">
      <DonutCard
        title="Where the company’s money goes"
        :subtitle="`Paid in ${view.label}, out of the cost to the company.`"
        definition="Health insurance is paid on top of the gross salary, so the cost to the company is the only whole the parts add up to. Pillar II is the employee’s own pension savings, set beside what they were paid and kept out of the state’s share."
        :description="view.ring.description"
        :parts="view.ring.parts"
        :total="formatWholeMoney(view.ring.total)"
        total-label="cost to the company"
        :format-value="(value: number) => formatMoney(value)"
        data-testid="salaries-ring"
      >
        <template #below>
          <p v-if="view.ring.split || view.ring.outside !== 0" class="mt-2 border-t border-default pt-2 text-xs text-muted" data-testid="salaries-ring-split">
            <template v-if="view.ring.split">
              To the employee is the net salary of <MoneyText :cents="view.ring.split.net" /> and <MoneyText :cents="view.ring.split.beside" /> paid beside it.
            </template>
            <template v-if="view.ring.outside !== 0">
              Also paid with this payroll and not pay: <MoneyText :cents="view.ring.outside" /> of rent and refunds of costs.
            </template>
          </p>
        </template>
      </DonutCard>

      <DrillChartCard
        :chart="bridge"
        title="Gross to net"
        :subtitle="`Paid in ${view.label}. From the cost of the salary down to the net, then what was paid beside it. A bar paid to a payee opens its rows.`"
        definition="Gross II is the gross salary with the health insurance on top. The pension pillars and the income tax are withheld from the gross, which leaves the net. Tax-free payments are then added to what the employee is paid."
        :height="300"
        :phone-height="300"
        data-testid="salaries-bridge"
      >
        <template #legend><ChartLegend :entries="bridge.legend" /></template>
      </DrillChartCard>
    </div>

    <SalaryProblemList :problems="view.problems" :label="view.label" @open="opened = $event" />

    <SalaryReconciliationCard :view="view" @open="opened = $event" />

    <FigureDialog v-model:open="dialogOpen" :detail="opened" />
  </div>
</template>

<style scoped>
/* A phone sets the tiles two by two, and the last one takes its own row. */
.salary-tiles > :last-child {
  grid-column: 1 / -1;
}

@media (min-width: 1024px) {
  .salary-tiles > :last-child {
    grid-column: auto;
  }
}
</style>
