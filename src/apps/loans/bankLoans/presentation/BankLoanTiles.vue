<script setup lang="ts">
import type { BankLoanFigures } from './bankLoanView'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import KpiTile from '../../../../shared/ui/KpiTile.vue'

/** What the bank loan's page leads with: owed today, the next payment, the subsidy's end, the payoff and the interest. */
defineProps<{
  figures: BankLoanFigures
}>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-3" data-testid="bank-loan-tiles">
    <KpiTile label="Owed today" :value="formatMoney(figures.owed)" :to="null" />
    <KpiTile
      label="Next payment"
      :value="figures.next === null ? 'None' : formatMoney(figures.next.yourShare)"
      :caption="figures.next === null ? 'The plan is paid.' : `On ${dayLabel(figures.next.date)}${figures.next.yourShare === figures.next.payment ? '' : `, of ${formatMoney(figures.next.payment)}`}`"
      :to="null"
    />
    <KpiTile label="Paid off" :value="figures.payoff === null ? '–' : dayLabel(figures.payoff)" :caption="`${figures.instalmentsLeft} instalments left`" :to="null" />
    <KpiTile
      :label="`Interest in ${figures.interestThisYear.year}`"
      :value="formatMoney(figures.interestThisYear.interest)"
      :caption="figures.interestThisYear.subsidy > 0 ? `of which the subsidy covers ${formatMoney(figures.interestThisYear.subsidy)}` : ''"
      definition="The bank's interest on the year's instalments. The subsidy pays part of the instalments it covers."
      :to="null"
    />
    <KpiTile
      label="Interest left"
      :value="formatMoney(figures.interestLeft.interest)"
      :caption="figures.interestLeft.subsidy > 0 ? `of which the subsidy covers ${formatMoney(figures.interestLeft.subsidy)}` : ''"
      :to="null"
    />
    <KpiTile
      v-if="figures.subsidy !== null"
      :label="figures.subsidy.ended ? 'Subsidy ended' : 'Subsidy ends'"
      :value="dayLabel(figures.subsidy.lastCovered)"
      :caption="figures.subsidy.ended || figures.subsidy.after === null ? '' : `then ${formatMoney(figures.subsidy.after)} a month`"
      :to="null"
    />
  </div>
</template>
