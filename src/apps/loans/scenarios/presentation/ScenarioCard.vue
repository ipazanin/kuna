<script setup lang="ts">
import UAlert from '@nuxt/ui/components/Alert.vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import ScenarioMark from './ScenarioMark.vue'
import type { ScenarioCardView } from './scenariosView'
import { words } from './words'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'

/** One compared scenario: its mark, what it changes, its badges, and when it is paid off, the interest left and what you pay in all against the base. */
defineProps<{
  card: ScenarioCardView
}>()
</script>

<template>
  <AppCard
    as="article"
    class="gap-2.5 border-t-3 p-4"
    :style="{ borderTopColor: `var(${card.colour})` }"
    :aria-label="`${card.letter}, ${card.name}`"
    data-testid="scenario-card"
    :data-scenario="card.key"
  >
    <p class="text-sm font-semibold text-highlighted">
      <ScenarioMark :letter="card.letter" :colour="card.colour" class="me-1.5 align-top" />
      {{ card.name }}
    </p>
    <div v-if="card.isBase || card.subsidyBack || card.datePassed" class="flex flex-wrap gap-1">
      <UBadge v-if="card.isBase" :label="words.card.base" color="neutral" variant="subtle" />
      <UBadge v-if="card.subsidyBack" :label="words.card.subsidyBack" icon="i-lucide-triangle-alert" color="warning" variant="subtle" />
      <UBadge v-if="card.datePassed" :label="words.card.datePassed" icon="i-lucide-calendar-x" color="warning" variant="subtle" />
    </div>
    <p class="type-caption">{{ card.summary }}</p>
    <UAlert v-if="card.refusal" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="words.card.refused" :description="card.refusal" />
    <FactGrid v-else :facts="card.facts" class="mt-auto border-t border-default pt-2.5" />
    <p v-if="card.datePassed" class="type-caption">{{ words.card.datePassedNote }}</p>
  </AppCard>
</template>
