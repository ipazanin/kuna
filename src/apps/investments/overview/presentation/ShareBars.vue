<script lang="ts">
export interface ShareBar {
  readonly label: string
  readonly amount: number
  /** Of the whole, null when the whole is zero. */
  readonly share: number | null
}
</script>

<script setup lang="ts">
import { words } from './words'
import { formatShare } from '../../../../shared/money/moneyFormat'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ProgressMeter from '../../../../shared/ui/ProgressMeter.vue'

/** Parts of a whole as a list of bars in the portfolio's one hue, each with its name, amount and share. */
defineProps<{
  bars: readonly ShareBar[]
}>()
</script>

<template>
  <ul class="flex flex-col gap-3">
    <li v-for="bar in bars" :key="bar.label" class="flex flex-col gap-1.5" data-testid="share-bar">
      <div class="flex items-baseline justify-between gap-3">
        <span class="min-w-0 truncate type-body">{{ bar.label }}</span>
        <span class="flex shrink-0 items-baseline gap-3">
          <MoneyText :cents="bar.amount" class="type-body" />
          <span class="figure w-12 text-end type-caption">{{ bar.share === null ? '–' : formatShare(bar.share) }}</span>
        </span>
      </div>
      <ProgressMeter
        :parts="[
          { value: Math.max(bar.share ?? 0, 0), colour: 'var(--invest-portfolio)' },
          { value: 1 - Math.min(Math.max(bar.share ?? 0, 0), 1), colour: 'var(--chart-ghost)' },
        ]"
        :label="words.money.bar(bar.label, bar.share === null ? '–' : formatShare(bar.share))"
      />
    </li>
  </ul>
</template>
