<script setup lang="ts">
import { computed } from 'vue'

import { words } from './words'
import type { CategoryTrend, Trend } from '../domain/categoryTrends'
import { analysisCategoryLink } from '../../overview/presentation/spendingLinks'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** The categories that grow or shrink, the largest change first, each opening Over time on that category. The change is a difference between two months, so it stays in ink with its sign. */
const props = defineProps<{
  trends: readonly CategoryTrend[]
  trend: Exclude<Trend, 'steady'>
}>()

const shown = computed(() => props.trends.filter((held) => held.trend === props.trend).sort((one, other) => Math.abs(other.change) - Math.abs(one.change)))
const title = computed(() => (props.trend === 'growing' ? words.analysis.savings.growing : words.analysis.savings.shrinking))
const none = computed(() => (props.trend === 'growing' ? words.analysis.savings.noneGrowing : words.analysis.savings.noneShrinking))
</script>

<template>
  <AppCard :title="title" :subtitle="words.analysis.savings.trendsSubtitle" :data-testid="`spending-analysis-${trend}`">
    <p v-if="shown.length === 0" class="px-4 pb-4 type-aside sm:px-5">{{ none }}</p>
    <ul v-else class="near-figures flex flex-col py-2">
      <li v-for="held in shown" :key="held.category.id" class="border-t border-default first:border-t-0">
        <ListRow
          :to="analysisCategoryLink('over-time', held.category)"
          :title="held.category.name"
          :caption="words.analysis.savings.trendCaption(formatMoney(held.recent), formatMoney(held.before))"
          data-testid="spending-analysis-trend"
        >
          <template #amount>
            <MoneyText :cents="held.change" sign="always" />
          </template>
        </ListRow>
      </li>
    </ul>
  </AppCard>
</template>
