<script setup lang="ts">
import { computed } from 'vue'

import type { BankLoanFigures } from '../domain/bankLoanFigures'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { negateMoney } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { useLoanWords } from './useLoanWords'

/** The tiles under the bank loan's hero: the next payment with your part of it on a loan you took out with others, the subsidy's end, the payoff and this year's interest. */
const props = defineProps<{
  figures: BankLoanFigures
  /** Who pays the subsidy, empty when the loan does not say. */
  payer: string
}>()
const loanWords = useLoanWords()

/** When the next payment falls due and the instalment it is part of, marked as the whole instalment on a loan you took out with others. */
const nextCaption = computed(() => {
  const { next } = props.figures
  if (next === null) return loanWords.value.tiles.planPaid
  const day = dayLabel(next.date)
  const whole = next.yours !== undefined
  if (next.youPay === next.payment) return whole ? loanWords.value.tiles.wholeOn(day) : loanWords.value.tiles.on(day)
  return whole ? loanWords.value.tiles.wholeOnOf(day, formatMoney(next.payment)) : loanWords.value.tiles.onOf(day, formatMoney(next.payment))
})
</script>

<template>
  <DashboardGrid layout="tiles" data-testid="bank-loan-tiles">
    <KpiTile :label="loanWords.tiles.nextPayment" :value="figures.next === null ? loanWords.tiles.none : formatMoney(negateMoney(figures.next.youPay), 'always')" :caption="nextCaption" :to="null">
      <template v-if="figures.next !== null" #value><MoneyText :cents="negateMoney(figures.next.youPay)" tone="flow" /></template>
      <template v-if="figures.next?.yours !== undefined" #default>
        <span data-testid="bank-loan-next-yours">{{ loanWords.tiles.yourPart }} <MoneyText :cents="figures.next.yours" /></span>
      </template>
    </KpiTile>
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
      :value="formatMoney(negateMoney(figures.interestThisYear.interest), 'always')"
      :caption="figures.interestThisYear.subsidy > 0 ? loanWords.tiles.interestCovered(loanWords.subsidyPays(payer), formatMoney(figures.interestThisYear.subsidy)) : ''"
      :definition="loanWords.tiles.interestDefinition"
      :to="null"
    >
      <template #value><MoneyText :cents="negateMoney(figures.interestThisYear.interest)" tone="flow" /></template>
    </KpiTile>
  </DashboardGrid>
</template>
