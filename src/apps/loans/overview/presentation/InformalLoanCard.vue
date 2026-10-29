<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { MOVEMENT_KIND_NAMES, informalLoanMonths } from '../../informalLoans/presentation/informalLoanView'
import type { InformalLoanFigures } from '../../informalLoans/presentation/informalLoanView'
import type { InformalLoanBook } from '../../workbook/domain/readLoanBook'
import { informalLoanLink } from './loanLinks'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import SparkLine from '../../../../shared/ui/SparkLine.vue'

/** An informal loan on the Overview: who owes how much, its balance as a sparkline, its last movement and its start, opening the loan's page. */
const props = defineProps<{
  book: InformalLoanBook
  figures: InformalLoanFigures
  day: CivilDate
  /** The only loan on the Overview, which takes the whole width. */
  hero?: boolean
}>()

const months = computed(() => informalLoanMonths(props.book, props.day))
const today = computed(() => months.value.findIndex((entry) => entry.month === monthOf(props.day)))
const theyOwe = computed(() => props.figures.owedByYou < 0)

const facts = computed((): Fact[] => {
  const { last } = props.figures
  return [
    last === null
      ? { label: words.card.lastMovement, value: words.card.noMovement }
      : { label: words.card.lastMovement, value: words.card.movement(MOVEMENT_KIND_NAMES[last.kind], formatMoney(last.amount)), caption: dayLabel(last.date) },
    { label: words.card.since, value: dayLabel(props.book.loan.start), caption: words.card.noInterest },
  ]
})
</script>

<template>
  <RouterLink :to="informalLoanLink(book.loan)" class="group block h-full rounded-card" :class="{ 'xl:col-span-2': hero }" data-testid="loan-card">
    <AppCard as="article" class="h-full gap-4 p-4 transition-colors group-hover:border-accented sm:p-5">
      <div class="flex items-start gap-3">
        <span class="grid size-8 shrink-0 place-items-center rounded-control bg-elevated text-primary" aria-hidden="true"><UIcon name="i-lucide-handshake" class="size-4" /></span>
        <div class="min-w-0 flex-1">
          <h2 class="type-card-title">{{ book.loan.name }}</h2>
          <p class="type-caption">{{ book.loan.counterparty || words.card.informalLoan }}</p>
        </div>
        <UBadge :label="theyOwe ? words.card.owedToYou : words.card.youOwe" color="neutral" variant="subtle" />
      </div>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <MoneyText :cents="Math.abs(figures.owedByYou)" class="block font-semibold text-highlighted" :class="hero ? 'text-figure-xl' : 'text-figure-lg'" />
          <p class="type-caption">{{ theyOwe ? words.card.nameOwesYou(book.loan.counterparty) : words.card.youOweName(book.loan.counterparty) }}</p>
        </div>
        <SparkLine
          :points="months.map((entry) => entry.owed)"
          :ahead-from="today < 0 || today === months.length - 1 ? undefined : today"
          colour="var(--loan-principal)"
          ahead-colour="var(--loan-ahead)"
          zero-line
          fill
          :width="160"
          :height="hero ? 96 : 44"
          :class="hero ? 'sm:max-w-xl sm:flex-1' : 'sm:w-40'"
        />
      </div>
      <FactGrid :facts="facts" class="mt-auto border-t border-default pt-4" />
    </AppCard>
  </RouterLink>
</template>
