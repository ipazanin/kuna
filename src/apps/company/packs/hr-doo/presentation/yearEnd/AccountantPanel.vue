<script setup lang="ts">
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../../../../shared/ui/ChartLegend.vue'
import DonutCard from '../../../../../../shared/ui/DonutCard.vue'
import DrillChartCard from '../../../../filters/presentation/DrillChartCard.vue'
import BridgeSteps from './BridgeSteps.vue'
import type { ClosedYearView } from './closedYearView'
import OpenItems from './OpenItems.vue'

/** How far a closed year is from the accountant's: the lines by status, the bridge from the cash net to profit, and what is left to settle. */
defineProps<{
  view: ClosedYearView
  year: number
}>()
</script>

<template>
  <div class="flex flex-col gap-6">
    <DonutCard
      title="Lines at a glance"
      :subtitle="`The accountant's lines for ${year}, by how ours stand against them. A status opens the statements.`"
      definition="Matched agrees with the accountant's own figure. Explained follows from the workbook and the rules through the adjustments. Judgement takes the accountant's figure for a choice the ledger cannot show. Open leaves a difference nothing explains."
      :description="view.lines.description"
      :parts="view.lines.parts"
      :total="String(view.lines.total)"
      :total-label="view.lines.total === 1 ? 'line' : 'lines'"
      :format-value="(value: number) => String(value)"
      opens="the statements"
      data-testid="line-statuses"
    />

    <DrillChartCard
      :chart="view.chart"
      :title="`From the cash net to profit, ${year}`"
      subtitle="One bar per adjustment, then the corporate tax, and last what nothing explains. A bar opens its rows."
      definition="The cash net is the bank rows and the owner's advances of the year, as the other screens count them. Each step turns part of it into the accrual view the accountant books."
      :height="view.chartHeight"
      :phone-height="view.chartHeight"
    >
      <template #legend><ChartLegend :entries="view.chart.legend" /></template>
    </DrillChartCard>

    <AppCard title="Open items" subtitle="What to settle with the accountant, and what would settle it." collapse-id="year.open-items" :summary="view.openItemsSummary">
      <div class="px-4 pt-3 pb-4 sm:px-5">
        <OpenItems :items="view.openItems" />
      </div>
    </AppCard>

    <AppCard
      title="The bridge, step by step"
      subtitle="Each adjustment with how it stands against the accountant and the rules behind it."
      collapse-id="year.bridge"
      :summary="`${view.steps.length} steps from the cash net to profit after tax`"
      start-collapsed
    >
      <div class="px-4 pt-2 pb-3 sm:px-5">
        <BridgeSteps :steps="view.steps" />
      </div>
    </AppCard>
  </div>
</template>
