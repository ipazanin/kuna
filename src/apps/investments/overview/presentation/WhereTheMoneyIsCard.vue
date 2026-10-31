<script setup lang="ts">
import { computed, ref } from 'vue'

import { valueByClass, valueByCurrency } from '../domain/overviewFigures'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import { words as holdingsWords } from '../../holdings/presentation/words'
import ShareBars from './ShareBars.vue'
import type { ShareBar } from './ShareBars.vue'
import { words } from './words'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'

/** The value by class of instrument, with the cash apart, or by currency. */
const props = defineProps<{
  figures: PortfolioFigures
}>()

type Grouping = 'class' | 'currency'

const grouping = ref<Grouping>('class')
const groupings: readonly { readonly value: Grouping; readonly label: string }[] = [
  { value: 'class', label: words.money.byClass },
  { value: 'currency', label: words.money.byCurrency },
]

const bars = computed((): ShareBar[] =>
  grouping.value === 'class'
    ? valueByClass(props.figures).map((part) => ({ label: holdingsWords.classes[part.group], amount: part.value, share: part.share }))
    : valueByCurrency(props.figures).map((part) => ({ label: part.group, amount: part.value, share: part.share })),
)
</script>

<template>
  <AppCard :title="words.money.title" :subtitle="words.money.subtitle" data-testid="investments-allocation">
    <template #actions>
      <ChoiceButtons v-model="grouping" :options="groupings" :label="words.money.groupBy" />
    </template>
    <div class="px-4 pt-3 pb-4 sm:px-5">
      <p v-if="bars.length === 0" class="type-body">{{ words.money.none }}</p>
      <ShareBars v-else :bars="bars" />
    </div>
  </AppCard>
</template>
