<script setup lang="ts">
import type { BankLoanFigures } from './bankLoanView'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import { useLoanWords } from './useLoanWords'

/** The tiles under the bank loan's hero: the next payment, the subsidy's end, the payoff and this year's interest. */
defineProps<{
  figures: BankLoanFigures
  /** Who pays the subsidy, empty when the loan does not say. */
  payer: string
}>()
const loanWords = useLoanWords()
</script>

<template>
  <DashboardGrid layout="tiles" data-testid="bank-loan-tiles">
    <KpiTile
      :label="loanWords.tiles.nextPayment"
      :value="figures.next === null ? loanWords.tiles.none : formatMoney(figures.next.yourShare)"
      :caption="
        figures.next === null
          ? loanWords.tiles.planPaid
          : figures.next.yourShare === figures.next.payment
            ? loanWords.tiles.on(dayLabel(figures.next.date))
            : loanWords.tiles.onOf(dayLabel(figures.next.date), formatMoney(figures.next.payment))
      "
      :to="null"
    />
    <KpiTile
      v-if="figures.subsidy !== null"
      :label="figures.subsidy.ended ? loanWords.tiles.subsidyEnded : loanWords.tiles.subsidyEnds"
      :value="dayLabel(figures.subsidy.lastCovered)"
      :caption="
        figures.subsidy.ended || figures.subsidy.after === null
          ? ''
          : plural(loanWords.tiles.subsidyThen(figures.subsidy.instalmentsLeft, formatMoney(figures.subsidy.after)), figures.subsidy.instalmentsLeft)
      "
      :to="null"
    />
    <KpiTile
      :label="loanWords.tiles.paidOff"
      :value="figures.payoff === null ? '–' : dayLabel(figures.payoff)"
      :caption="plural(loanWords.tiles.instalmentsLeft(figures.instalmentsLeft), figures.instalmentsLeft)"
      :to="null"
    />
    <KpiTile
      :label="loanWords.tiles.interestIn(figures.interestThisYear.year)"
      :value="formatMoney(figures.interestThisYear.interest)"
      :caption="figures.interestThisYear.subsidy > 0 ? loanWords.tiles.interestCovered(loanWords.subsidyPays(payer), formatMoney(figures.interestThisYear.subsidy)) : ''"
      :definition="loanWords.tiles.interestDefinition"
      :to="null"
    />
  </DashboardGrid>
</template>
