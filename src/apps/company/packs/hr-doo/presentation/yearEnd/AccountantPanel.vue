<script setup lang="ts">
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../../../../shared/ui/ChartLegend.vue'
import DonutCard from '../../../../../../shared/ui/DonutCard.vue'
import DrillChartCard from '../../../../filters/presentation/DrillChartCard.vue'
import BridgeSteps from './BridgeSteps.vue'
import type { ClosedYearView } from './closedYearView'
import OpenItems from './OpenItems.vue'
import { words } from './words'

/** How far a closed year is from the accountant's: the lines by status, the bridge from the cash net to profit, and what is left to settle. */
defineProps<{
  view: ClosedYearView
  year: number
}>()
</script>

<template>
  <div class="flex flex-col gap-6">
    <DonutCard
      :title="words.accountant.linesTitle"
      :subtitle="words.accountant.linesSubtitle(year)"
      :definition="words.accountant.linesDefinition"
      :description="view.lines.description"
      :parts="view.lines.parts"
      :total="String(view.lines.total)"
      :total-label="words.accountant.line(view.lines.total)"
      :format-value="(value: number) => String(value)"
      :opens="words.accountant.opensStatements"
      data-testid="line-statuses"
    />

    <DrillChartCard
      :chart="view.chart"
      :title="words.accountant.bridgeTitle(year)"
      :subtitle="words.accountant.bridgeSubtitle"
      :definition="words.accountant.bridgeDefinition"
      :height="view.chartHeight"
      :phone-height="view.chartHeight"
    >
      <template #legend><ChartLegend :entries="view.chart.legend" /></template>
    </DrillChartCard>

    <AppCard :title="words.accountant.openItems" :subtitle="words.accountant.openItemsSubtitle" collapse-id="year.open-items" :summary="view.openItemsSummary">
      <div class="px-4 pt-3 pb-4 sm:px-5">
        <OpenItems :items="view.openItems" />
      </div>
    </AppCard>

    <AppCard :title="words.accountant.stepsTitle" :subtitle="words.accountant.stepsSubtitle" collapse-id="year.bridge" :summary="words.accountant.stepsSummary(view.steps.length)" start-collapsed>
      <div class="px-4 pt-2 pb-3 sm:px-5">
        <BridgeSteps :steps="view.steps" />
      </div>
    </AppCard>
  </div>
</template>
