<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { MOVEMENT_KIND_NAMES, informalLoanMonths, standingWords } from '../../informalLoans/presentation/informalLoanView'
import { words as informalWords } from '../../informalLoans/presentation/words'
import { informalLoanLink } from './loanLinks'
import type { OverviewInformalLoan } from './loansOverview'
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

/** An informal loan on the Overview: which way it runs, who owes how much, its balance as a sparkline, how it stands against its expected plan, its last movement and its start, opening the loan's page. */
const props = defineProps<{
  card: OverviewInformalLoan
  day: CivilDate
  /** The only loan on the Overview, which takes the whole width. */
  hero?: boolean
}>()

const book = computed(() => props.card.book)
const figures = computed(() => props.card.figures)
const look = computed(() => props.card.look)
const months = computed(() => informalLoanMonths(book.value, props.day))
const today = computed(() => months.value.findIndex((entry) => entry.month === monthOf(props.day)))
const owedLine = computed(() => {
  const { owedByYou } = figures.value
  const name = book.value.loan.counterparty
  return owedByYou === 0 ? words.card.settledWith(name) : owedByYou < 0 ? words.card.nameOwesYou(name) : words.card.youOweName(name)
})

const facts = computed((): Fact[] => {
  const { last } = figures.value
  const { standing } = props.card
  return [
    ...(standing === null
      ? []
      : [
          {
            label: words.card.expectedPlan,
            value: standingWords(book.value.loan, standing).text,
            caption: standing.next === null ? informalWords.plan.nothingNext : words.card.nextDue(dayLabel(standing.next.date)),
          },
        ]),
    last === null
      ? { label: words.card.lastMovement, value: words.card.noMovement }
      : { label: words.card.lastMovement, value: words.card.movement(MOVEMENT_KIND_NAMES[last.kind], formatMoney(last.amount)), caption: dayLabel(last.date) },
    { label: words.card.since, value: dayLabel(book.value.loan.start), caption: book.value.loan.expected === null ? words.card.noInterest : words.card.noInterestPlanned },
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
        <UBadge :label="look.label" :icon="look.icon" :color="look.tone" variant="subtle" data-testid="loan-direction" />
      </div>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <MoneyText :cents="Math.abs(figures.owedByYou)" class="block font-semibold text-highlighted" :class="hero ? 'text-figure-xl' : 'text-figure-lg'" />
          <p class="type-caption">{{ owedLine }}</p>
        </div>
        <SparkLine
          :points="months.map((entry) => entry.owed)"
          :ahead-from="today < 0 || today === months.length - 1 ? undefined : today"
          :colour="`var(${look.token})`"
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
