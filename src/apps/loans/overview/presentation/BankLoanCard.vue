<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { BankLoanFigures } from '../../bankLoans/presentation/bankLoanView'
import { bankLoanMonths } from '../../bankLoans/presentation/bankLoanView'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { bankLoanLink } from './loanLinks'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel, shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ProgressMeter from '../../../../shared/ui/ProgressMeter.vue'
import SparkLine from '../../../../shared/ui/SparkLine.vue'

/** A bank loan on the Overview: owed today with the plan as a sparkline, what is paid back, and its next payment, the subsidy's end and the payoff, opening the loan's page. */
const props = defineProps<{
  book: BankLoanBook
  /** Null while the plan cannot be worked out. */
  figures: BankLoanFigures | null
  day: CivilDate
  /** The only loan on the Overview, which takes the whole width. */
  hero?: boolean
}>()

const months = computed(() => bankLoanMonths(props.book))
const today = computed(() => months.value.findIndex((entry) => entry.month === monthOf(props.day)))

const facts = computed((): Fact[] => {
  const { figures } = props
  if (figures === null) return []
  const { next, subsidy, payoff } = figures
  return [
    ...(next === null
      ? []
      : [
          {
            label: words.card.nextPayment,
            value: formatMoney(next.yourShare),
            caption: next.yourShare === next.payment ? shortDayLabel(next.date) : words.card.nextOf(shortDayLabel(next.date), formatMoney(next.payment)),
          },
        ]),
    ...(subsidy === null || subsidy.ended
      ? []
      : [{ label: words.card.subsidyEnds, value: dayLabel(subsidy.lastCovered), ...(subsidy.after === null ? {} : { caption: words.card.subsidyThen(formatMoney(subsidy.after)) }) }]),
    ...(payoff === null ? [] : [{ label: words.card.paidOff, value: dayLabel(payoff), caption: plural(words.card.instalmentsLeft(figures.instalmentsLeft), figures.instalmentsLeft) }]),
  ]
})
</script>

<template>
  <RouterLink :to="bankLoanLink(book.loan)" class="group block h-full rounded-card" :class="{ 'xl:col-span-2': hero }" data-testid="loan-card">
    <AppCard as="article" class="h-full gap-4 p-4 transition-colors group-hover:border-accented sm:p-5">
      <div class="flex items-start gap-3">
        <span class="grid size-8 shrink-0 place-items-center rounded-control bg-elevated text-primary" aria-hidden="true"><UIcon name="i-lucide-landmark" class="size-4" /></span>
        <div class="min-w-0 flex-1">
          <h2 class="type-card-title">{{ book.loan.name }}</h2>
          <p class="type-caption">{{ book.loan.lender || words.card.bankLoan }}</p>
        </div>
        <UBadge v-if="figures?.subsidy && !figures.subsidy.ended" :label="words.card.subsidised" color="neutral" variant="subtle" />
      </div>
      <p v-if="figures === null" class="type-body">{{ words.card.noPlan }}</p>
      <template v-else>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div>
            <MoneyText :cents="figures.owed" class="block font-semibold text-highlighted" :class="hero ? 'text-figure-xl' : 'text-figure-lg'" />
            <p class="type-caption">{{ words.card.owedToday }}</p>
          </div>
          <SparkLine
            :points="months.map((entry) => entry.owed)"
            :ahead-from="today < 0 ? undefined : today"
            colour="var(--loan-principal)"
            ahead-colour="var(--loan-ahead)"
            fill
            :width="160"
            :height="hero ? 96 : 44"
            :class="hero ? 'sm:max-w-xl sm:flex-1' : 'sm:w-40'"
          />
        </div>
        <div class="flex flex-col gap-2">
          <ProgressMeter
            :parts="[
              { value: figures.paidBack, colour: 'var(--loan-principal)' },
              { value: figures.owed, colour: 'var(--loan-ahead)' },
            ]"
            :label="words.card.paidBack(figures.paidBackPercent, formatMoney(book.loan.principal))"
          />
          <div class="flex flex-wrap justify-between gap-x-4 gap-y-1 type-caption">
            <span class="inline-flex items-center gap-1.5"
              ><span class="swatch swatch-bar" style="--swatch: var(--loan-principal)" aria-hidden="true" />{{ words.card.paidBack(figures.paidBackPercent, formatMoney(book.loan.principal)) }}</span
            >
            <span class="inline-flex items-center gap-1.5"
              ><span class="swatch swatch-bar" style="--swatch: var(--loan-ahead)" aria-hidden="true" />{{ words.card.toGo(formatMoney(figures.owed)) }}</span
            >
          </div>
        </div>
        <FactGrid :facts="facts" class="border-t border-default pt-4" />
      </template>
    </AppCard>
  </RouterLink>
</template>
