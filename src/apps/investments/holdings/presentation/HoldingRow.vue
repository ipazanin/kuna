<script setup lang="ts">
import type { HoldingsLine } from '../domain/holdingsList'
import { holdingLink } from './holdingLinks'
import LastDayChange from './LastDayChange.vue'
import { useNoPriceWord } from './holdingText'
import PriceMarkNote from './PriceMarkNote.vue'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatCurrencyAmount, formatPercent, percentAsShown } from '../../../../shared/money/moneyFormat'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { moneyToneClass } from '../../../../shared/ui/moneyTone'
import ListRow from '../../../../shared/ui/ListRow.vue'

/**
 * A holding or a balance on a phone, in two lines: the name with the day's change beside it, then the value and the rest
 * under it. A balance shows the day's change only where the desktop Day column does, for a foreign currency. A holding's
 * row opens its page.
 */
withDefaults(
  defineProps<{
    line: HoldingsLine
    /** The day Fetch today's quotes are of, so a holding still at an earlier close says which. */
    quotedDay?: CivilDate | null
  }>(),
  { quotedDay: null },
)

const noPriceWord = useNoPriceWord()
</script>

<template>
  <ListRow v-if="line.kind === 'cash'" as="div" :title="line.account" data-testid="holding-row">
    <template v-if="line.balance.lastDay !== null && line.balance.currency !== EURO" #amount>
      <LastDayChange :change="line.balance.lastDay" />
    </template>
    <template #caption>
      {{ words.cashIn(line.balance.currency) }}<template v-if="line.balance.value !== null"> · <MoneyText :cents="line.balance.value" /></template
      ><template v-if="line.balance.currency !== EURO">
        · <span class="figure">{{ formatCurrencyAmount(line.balance.balance, line.balance.currency) }}</span></template
      >
    </template>
  </ListRow>
  <ListRow v-else :to="holdingLink(line.holding.instrument)" :title="line.holding.instrument.name" data-testid="holding-row">
    <template v-if="line.holding.lastDay !== null" #amount>
      <LastDayChange :change="line.holding.lastDay" />
    </template>
    <template #caption>
      <span class="inline-flex flex-wrap items-center gap-x-1.5">
        <span>{{ line.holding.instrument.symbol }}</span>
        · <MoneyText v-if="line.holding.valuation !== null" :cents="line.holding.valuation.value" /><span v-else>{{ noPriceWord(line.holding.instrument) }}</span>
        <template v-if="line.holding.unrealised !== null">
          · <MoneyText :cents="line.holding.unrealised" tone="outcome" /><span v-if="line.gainShare !== null" class="figure" :class="moneyToneClass(percentAsShown(line.gainShare), 'outcome')">{{
            formatPercent(line.gainShare, 'always')
          }}</span>
        </template>
        <PriceMarkNote :holding="line.holding" :quoted-day="quotedDay" bare />
      </span>
    </template>
  </ListRow>
</template>
