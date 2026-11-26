<script setup lang="ts">
import { computed } from 'vue'

import { words } from './words'
import { payeeAmount, payeesRanked } from '../domain/payeeTotals'
import type { PayeeSide, PayeeTotals } from '../domain/payeeTotals'
import type { PayeePeriod } from '../domain/payeePeriod'
import { payeePageLink } from '../../overview/presentation/spendingLinks'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'

/** The ten payees that took the most money on one side in the period, each opening their entries, and the rest as one line. The title names the direction, so the amounts stay in ink. */
const props = defineProps<{
  totals: readonly PayeeTotals[]
  side: PayeeSide
  period: PayeePeriod
  /** The line under the title while the rates load or miss rows, or null. */
  subtitle: string | null
}>()

const sideWords = computed(() => words[props.side])
const ranked = computed(() => payeesRanked(props.totals, props.side))
const lines = computed(() =>
  ranked.value.top.map((payee) => ({
    payee,
    amount: payeeAmount(payee, props.side),
    caption: payee.latest === null ? '' : `${plural(words.entries(payee.rows), payee.rows)} · ${words.newest(dayLabel(payee.latest))}`,
  })),
)
</script>

<template>
  <AppCard :title="sideWords.title" :subtitle="subtitle ?? undefined" :data-testid="`spending-payees-${side}`">
    <EmptyState v-if="lines.length === 0" line :title="sideWords.none" :data-testid="`spending-payees-${side}-none`" />
    <ul v-else class="row-list near-figures flex flex-col py-2">
      <li v-for="line in lines" :key="line.payee.key" class="border-t border-default first:border-t-0">
        <ListRow :to="payeePageLink(line.payee.key, period)" :title="line.payee.name" :caption="line.caption" data-testid="spending-payee-open">
          <template #amount>
            <MoneyText :cents="line.amount" :data-amount="line.amount" />
          </template>
        </ListRow>
      </li>
      <ListRow v-if="ranked.rest !== null" as="li" :title="plural(sideWords.others(ranked.rest.payees), ranked.rest.payees)" quiet class="border-t border-default" data-testid="spending-payees-rest">
        <template #amount>
          <MoneyText :cents="ranked.rest.sum" />
        </template>
      </ListRow>
    </ul>
  </AppCard>
</template>
