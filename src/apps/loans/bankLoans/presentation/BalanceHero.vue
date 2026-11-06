<script setup lang="ts">
import { computed } from 'vue'

import { paymentOf } from '../domain/loanFigures'
import type { BankLoanFigures } from '../domain/bankLoanFigures'
import PaymentSplitFigures from './PaymentSplitFigures.vue'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import InfoPopover from '../../../../shared/ui/InfoPopover.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ProgressMeter from '../../../../shared/ui/ProgressMeter.vue'
import { useLoanWords } from './useLoanWords'

/** What the bank loan's page leads with: owed today and how much is paid back, beside everything still to pay and who pays it. */
const props = defineProps<{
  loan: BankLoan
  figures: BankLoanFigures
}>()
const loanWords = useLoanWords()

const totalOwed = computed(() => paymentOf(props.figures.stillToPay))
const paidOff = computed(() => props.figures.owed === 0 && props.figures.next === null)
</script>

<template>
  <AppCard as="article" class="gap-5 p-4 sm:flex-row sm:gap-0 sm:p-5" data-testid="bank-loan-hero">
    <div class="flex min-w-0 flex-col gap-2 sm:flex-1 sm:pe-6">
      <p class="flex items-center gap-1 text-sm text-muted">
        {{ paidOff && figures.payoff !== null ? loanWords.hero.paidOffOn(dayLabel(figures.payoff)) : loanWords.hero.owedToday }}
        <InfoPopover v-if="!paidOff" :subject="loanWords.hero.owedToday" :definition="loanWords.hero.owedTodayDefinition" />
      </p>
      <MoneyText :cents="figures.owed" class="block text-figure-lg font-semibold text-highlighted sm:text-figure-xl" />
      <p class="type-caption">{{ loanWords.hero.paidBack(formatMoney(figures.paidBack), formatMoney(loan.principal), figures.paidBackPercent) }}</p>
      <ProgressMeter
        :parts="[
          { value: figures.paidBack, colour: 'var(--loan-principal)' },
          { value: figures.owed, colour: 'var(--loan-ahead)' },
        ]"
        :label="loanWords.hero.meterPaidBack(figures.paidBackPercent, formatMoney(loan.principal))"
        :height="10"
        class="mt-1"
      />
      <ChartLegend
        :entries="[
          { label: loanWords.hero.paidBackPart, colour: 'var(--loan-principal)' },
          { label: loanWords.hero.stillOwedPart, colour: 'var(--loan-ahead)' },
        ]"
      />
    </div>
    <div class="flex min-w-0 flex-col gap-2 border-t border-default pt-5 sm:flex-1 sm:border-t-0 sm:border-s sm:ps-6 sm:pt-0">
      <div class="flex items-start justify-between gap-2">
        <p class="text-sm text-muted">{{ loanWords.hero.totalOwed }}</p>
        <div class="-my-1 -me-1.5">
          <InfoPopover :subject="loanWords.hero.totalOwed" :definition="loanWords.hero.totalOwedDefinition" />
        </div>
      </div>
      <MoneyText :cents="totalOwed" class="block text-figure-lg font-semibold text-highlighted" data-testid="bank-loan-total-owed" />
      <p v-if="figures.payoff !== null && figures.instalmentsLeft > 0" class="type-caption">
        {{ plural(loanWords.hero.totalOwedCaption(figures.instalmentsLeft, dayLabel(figures.payoff)), figures.instalmentsLeft) }}
      </p>
      <PaymentSplitFigures v-if="totalOwed > 0" :split="figures.stillToPay" :payer="loan.subsidy?.payer ?? ''" class="mt-1" />
    </div>
  </AppCard>
</template>
