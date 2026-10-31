<script setup lang="ts">
import { computed, ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { chartTokens } from '../../../../../../shared/charts/chartTokens'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import ChartLegend from '../../../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../../../shared/ui/DashboardGrid.vue'
import DonutCard from '../../../../../../shared/ui/DonutCard.vue'
import KpiTile from '../../../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import DrillChartCard from '../../../../filters/presentation/DrillChartCard.vue'
import { bridgeChart } from '../bridgeChart'
import BuildUpButton from '../BuildUpButton.vue'
import FigureDialog from '../FigureDialog.vue'
import type { FigureDetail } from '../tracedFigureView'
import SalaryProblemList from './SalaryProblemList.vue'
import SalaryReconciliationCard from './SalaryReconciliationCard.vue'
import type { SalaryMonthView } from './salariesView'
import { words } from './words'

/** One payday: what it cost and where the money went, gross to net, the problems to resolve and every line the sources state. */
const props = defineProps<{
  view: SalaryMonthView
}>()

const bridge = computed(() => bridgeChart(props.view.bridge, chartTokens(), { raises: words.bridge.raises, lowers: words.bridge.lowers }))

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
      <UIcon name="i-lucide-hourglass" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <span>{{ words.month.stillRunning(view.label) }}</span>
    </p>

    <DashboardGrid layout="tiles" data-testid="salaries-tiles">
      <KpiTile v-for="tile in view.tiles" :key="tile.label" v-bind="tile" />
    </DashboardGrid>

    <p v-if="view.strip" class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-toned" data-testid="salaries-strip">
      <span class="font-medium text-highlighted">{{ view.strip.name }}</span>
      <span>
        {{ words.month.gross }}<MoneyText :cents="view.strip.gross" />{{ words.month.toNet }}
        <BuildUpButton v-if="view.strip.netDetail" :cents="view.strip.net" :label="words.month.netIn(view.strip.name, view.label)" @open="opened = view.strip.netDetail" />
        <MoneyText v-else :cents="view.strip.net" /><template v-if="view.strip.paidOn">{{ words.month.paidOn(view.strip.paidOn) }}</template>
      </span>
    </p>

    <DashboardGrid>
      <DonutCard
        :title="words.month.ringTitle"
        :subtitle="words.month.ringSubtitle(view.label)"
        :definition="words.month.ringDefinition"
        :description="view.ring.description"
        :parts="view.ring.parts"
        :total="formatMoney(view.ring.total)"
        :total-label="words.month.costToCompany"
        :format-value="(value: number) => formatMoney(value)"
        data-testid="salaries-ring"
      >
        <template #below>
          <p v-if="view.ring.split" class="mt-2 border-t border-default pt-2 text-xs text-muted" data-testid="salaries-ring-split">
            {{ words.month.splitBefore }}<MoneyText :cents="view.ring.split.net" />{{ words.month.splitAnd }}<MoneyText :cents="view.ring.split.beside" />{{ words.month.splitAfter }}
          </p>
        </template>
      </DonutCard>

      <DrillChartCard
        :chart="bridge"
        :title="words.month.bridgeTitle"
        :subtitle="words.month.bridgeSubtitle(view.label)"
        :definition="words.month.bridgeDefinition"
        :height="300"
        :phone-height="300"
        data-testid="salaries-bridge"
      >
        <template #legend><ChartLegend :entries="bridge.legend" /></template>
      </DrillChartCard>
    </DashboardGrid>

    <SalaryProblemList :problems="view.problems" :label="view.label" @open="opened = $event" />

    <SalaryReconciliationCard :view="view" @open="opened = $event" />

    <FigureDialog v-model:open="dialogOpen" :detail="opened" />
  </div>
</template>
