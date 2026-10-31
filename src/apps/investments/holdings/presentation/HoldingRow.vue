<script setup lang="ts">
import { RouterLink } from 'vue-router'

import type { HoldingsLine } from '../domain/holdingsList'
import { holdingLink } from './holdingLinks'
import { QUANTITY_PLACES } from './holdingText'
import PriceMarkNote from './PriceMarkNote.vue'
import { words } from './words'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatCurrencyAmount, formatPercent, formatQuantity } from '../../../../shared/money/moneyFormat'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** A holding or a balance on a phone, in two lines: the name and the value, then the symbol and units with the gain. A holding's row opens its page. */
defineProps<{
  line: HoldingsLine
}>()
</script>

<template>
  <div v-if="line.kind === 'cash'" class="flex flex-col gap-0.5 px-4 py-2.5" data-testid="holding-row">
    <span class="flex items-baseline justify-between gap-3 type-body">
      <span class="min-w-0 truncate text-highlighted">{{ line.account }}</span>
      <MoneyText v-if="line.balance.value !== null" :cents="line.balance.value" class="shrink-0 font-medium text-highlighted" />
    </span>
    <span class="flex items-baseline justify-between gap-3 type-caption">
      <span class="min-w-0 truncate">{{ words.cashIn(line.balance.currency) }}</span>
      <span v-if="line.balance.currency !== EURO" class="figure shrink-0">{{ formatCurrencyAmount(line.balance.balance, line.balance.currency) }}</span>
    </span>
  </div>
  <RouterLink v-else :to="holdingLink(line.holding.instrument)" class="flex flex-col gap-0.5 px-4 py-2.5 hover:bg-elevated/40" data-testid="holding-row">
    <span class="flex items-baseline justify-between gap-3 type-body">
      <span class="min-w-0 truncate text-highlighted">{{ line.holding.instrument.name }}</span>
      <MoneyText v-if="line.kind === 'holding' && line.holding.valuation !== null" :cents="line.holding.valuation.value" class="shrink-0 font-medium text-highlighted" />
      <span v-else-if="line.kind === 'holding'" class="shrink-0 type-caption">{{ words.noPrice }}</span>
    </span>
    <span class="flex items-baseline justify-between gap-3 type-caption">
      <span class="inline-flex min-w-0 items-center gap-1.5">
        <span class="truncate">{{
          line.kind === 'sold' ? line.holding.instrument.symbol : `${line.holding.instrument.symbol} · ${words.units(formatQuantity(line.holding.quantity, QUANTITY_PLACES))}`
        }}</span>
        <PriceMarkNote :holding="line.holding" bare />
      </span>
      <span v-if="line.kind === 'sold'" class="shrink-0"><MoneyText :cents="line.holding.realised" sign="always" tone="outcome" /> {{ words.realised }}</span>
      <span v-else-if="line.holding.unrealised !== null" class="shrink-0">
        <MoneyText :cents="line.holding.unrealised" sign="always" tone="outcome" /><template v-if="line.gainShare !== null"> · {{ formatPercent(line.gainShare, 'always') }}</template>
      </span>
    </span>
  </RouterLink>
</template>
