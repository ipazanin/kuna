<script setup lang="ts">
import type { HoldingsLine } from '../domain/holdingsList'
import { holdingLink } from './holdingLinks'
import { QUANTITY_PLACES, useNoPriceWord } from './holdingText'
import PriceMarkNote from './PriceMarkNote.vue'
import { words } from './words'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatCurrencyAmount, formatPercent, formatQuantity } from '../../../../shared/money/moneyFormat'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'

/** A holding or a balance on a phone, in two lines: the name and the value, then the symbol and units with the gain. A holding's row opens its page. A foreign balance with no euro value shows its own amount under the account. */
defineProps<{
  line: HoldingsLine
}>()

const noPriceWord = useNoPriceWord()
</script>

<template>
  <ProposalRow v-if="line.kind === 'cash'" as="div" :title="line.account" data-testid="holding-row">
    <template v-if="line.balance.value !== null" #amount>
      <MoneyText :cents="line.balance.value" class="font-medium text-highlighted" />
      <span v-if="line.balance.currency !== EURO" class="figure type-caption">{{ formatCurrencyAmount(line.balance.balance, line.balance.currency) }}</span>
    </template>
    <template #caption>
      {{ words.cashIn(line.balance.currency)
      }}<template v-if="line.balance.value === null && line.balance.currency !== EURO"> · {{ formatCurrencyAmount(line.balance.balance, line.balance.currency) }}</template>
    </template>
  </ProposalRow>
  <ProposalRow v-else :to="holdingLink(line.holding.instrument)" :title="line.holding.instrument.name" data-testid="holding-row">
    <template #amount>
      <MoneyText v-if="line.holding.valuation !== null" :cents="line.holding.valuation.value" class="font-medium text-highlighted" />
      <span v-else class="type-caption">{{ noPriceWord(line.holding.instrument) }}</span>
      <span v-if="line.holding.unrealised !== null" class="type-caption">
        <MoneyText :cents="line.holding.unrealised" sign="always" tone="outcome" /><template v-if="line.gainShare !== null"> · {{ formatPercent(line.gainShare, 'always') }}</template>
      </span>
    </template>
    <template #caption>
      <span class="inline-flex items-center gap-1.5">
        <span>{{ line.holding.instrument.symbol }} · {{ words.units(formatQuantity(line.holding.quantity, QUANTITY_PLACES)) }}</span>
        <PriceMarkNote :holding="line.holding" bare />
      </span>
    </template>
  </ProposalRow>
</template>
