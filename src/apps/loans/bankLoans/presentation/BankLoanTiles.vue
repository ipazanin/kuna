<script setup lang="ts">
import type { BankLoanFigures } from './bankLoanView'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'

/** The tiles under the bank loan's hero: the next payment, the subsidy's end, the payoff and this year's interest. */
defineProps<{
  figures: BankLoanFigures
  /** Who pays the subsidy, empty when the loan does not say. */
  payer: string
}>()
</script>

<template>
  <DashboardGrid layout="tiles" data-testid="bank-loan-tiles">
    <KpiTile
      :label="words.tiles.nextPayment"
      :value="figures.next === null ? words.tiles.none : formatMoney(figures.next.yourShare)"
      :caption="
        figures.next === null
          ? words.tiles.planPaid
          : figures.next.yourShare === figures.next.payment
            ? words.tiles.on(dayLabel(figures.next.date))
            : words.tiles.onOf(dayLabel(figures.next.date), formatMoney(figures.next.payment))
      "
      :to="null"
    />
    <KpiTile
      v-if="figures.subsidy !== null"
      :label="figures.subsidy.ended ? words.tiles.subsidyEnded : words.tiles.subsidyEnds"
      :value="dayLabel(figures.subsidy.lastCovered)"
      :caption="
        figures.subsidy.ended || figures.subsidy.after === null
          ? ''
          : plural(words.tiles.subsidyThen(figures.subsidy.instalmentsLeft, formatMoney(figures.subsidy.after)), figures.subsidy.instalmentsLeft)
      "
      :to="null"
    />
    <KpiTile
      :label="words.tiles.paidOff"
      :value="figures.payoff === null ? '–' : dayLabel(figures.payoff)"
      :caption="plural(words.tiles.instalmentsLeft(figures.instalmentsLeft), figures.instalmentsLeft)"
      :to="null"
    />
    <KpiTile
      :label="words.tiles.interestIn(figures.interestThisYear.year)"
      :value="formatMoney(figures.interestThisYear.interest)"
      :caption="figures.interestThisYear.subsidy > 0 ? words.tiles.interestCovered(words.subsidyPays(payer), formatMoney(figures.interestThisYear.subsidy)) : ''"
      :definition="words.tiles.interestDefinition"
      :to="null"
    />
  </DashboardGrid>
</template>
