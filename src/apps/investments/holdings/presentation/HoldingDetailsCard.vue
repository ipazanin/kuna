<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import type { HoldingDetails } from './holdingDetails'
import { words } from './words'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'

/** What the holding is and where each fact came from, and what a fund's rings wait for: the way to type its mix, or its price. */
defineProps<{
  details: HoldingDetails
}>()

const emit = defineEmits<{
  change: []
}>()
</script>

<template>
  <AppCard :title="words.details.title" data-testid="holding-details">
    <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5">
      <FactGrid :facts="details.facts" />
      <EmptyState v-if="details.ringsWaitFor === 'mix'" icon="i-lucide-chart-pie" :title="words.details.noMix" :description="words.details.noMixDescription" data-testid="holding-no-mix">
        <template #actions>
          <UButton :label="words.details.typeMix" icon="i-lucide-pencil" color="neutral" variant="outline" data-testid="holding-type-mix" @click="emit('change')" />
        </template>
      </EmptyState>
      <EmptyState
        v-else-if="details.ringsWaitFor === 'price'"
        icon="i-lucide-chart-pie"
        :title="words.details.noPrice"
        :description="words.details.noPriceDescription"
        data-testid="holding-mix-unpriced"
      />
    </div>
  </AppCard>
</template>
