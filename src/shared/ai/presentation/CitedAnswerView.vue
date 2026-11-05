<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import DrillLink from '../../ui/DrillLink.vue'
import MoneyText from '../../ui/MoneyText.vue'
import { hasStrayFigure } from '../domain/citedAnswer'
import type { CitedAnswer } from '../domain/citedAnswer'
import { words } from './words'

/**
 * A cited answer: each part with a chip per source and the figures it quotes in Kuna's own amounts, then what the model
 * added from its own knowledge in a box apart, the flags of what Kuna could not check, and the usage line.
 */
const props = defineProps<{
  answer: CitedAnswer
  /** Where a source chip leads and what it says, or null for a source no screen shows. */
  sourceLink: (id: string) => { readonly label: string; readonly to: RouteLocationRaw | null }
  usage: string | null
  /** The day the sources were last checked, as the app words it. */
  checked: string | null
}>()

const emit = defineEmits<{ retry: [] }>()

const stray = computed(() => hasStrayFigure(props.answer))
</script>

<template>
  <section class="flex flex-col gap-3" data-testid="cited-answer" :data-stray="stray" :data-unchecked="answer.partlyUnchecked">
    <div v-for="(part, index) in answer.parts" :key="index" class="flex flex-col gap-1.5" data-testid="cited-part">
      <p class="type-body text-default" data-testid="cited-text">
        {{ part.text }}
        <UIcon v-if="part.strayFigure" name="i-lucide-triangle-alert" class="ms-1 size-4 align-text-bottom text-warning" :aria-label="words.answer.strayFigure" />
      </p>
      <p v-if="part.figures.length > 0" class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <MoneyText v-for="figure in part.figures" :key="figure.ref" :cents="figure.cents" />
      </p>
      <ul v-if="part.sources.length > 0" class="flex flex-wrap gap-1.5" :aria-label="words.answer.sources">
        <li v-for="source in part.sources" :key="source">
          <DrillLink :to="sourceLink(source).to" :label="sourceLink(source).label" data-testid="cited-source">
            <UBadge :label="sourceLink(source).label" color="neutral" variant="subtle" size="sm" />
          </DrillLink>
        </li>
      </ul>
    </div>
    <UAlert v-if="answer.ownKnowledge" color="warning" variant="subtle" icon="i-lucide-book-open" :title="words.answer.notFromRules" data-testid="cited-own-knowledge">
      <template #description>
        <p>{{ words.answer.ownKnowledge }}</p>
        <p class="mt-1" data-testid="cited-own-text">{{ answer.ownKnowledge.text }}</p>
      </template>
    </UAlert>
    <div v-if="stray || answer.partlyUnchecked" class="flex flex-col items-start gap-1.5" data-testid="cited-flags">
      <p v-if="stray" class="flex items-center gap-1.5 text-xs text-warning">
        <UIcon name="i-lucide-triangle-alert" class="size-4 shrink-0" aria-hidden="true" />
        {{ words.answer.strayFigure }}
      </p>
      <p v-if="answer.partlyUnchecked" class="flex items-center gap-1.5 text-xs text-warning">
        <UIcon name="i-lucide-circle-help" class="size-4 shrink-0" aria-hidden="true" />
        {{ words.answer.partlyUnchecked }}
      </p>
      <UButton v-if="stray" :label="words.answer.tryAgain" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" size="sm" data-testid="cited-retry" @click="emit('retry')" />
    </div>
    <p v-if="checked" class="text-xs text-muted">{{ checked }}</p>
    <p v-if="usage" class="text-xs text-muted" data-testid="cited-usage">{{ usage }}</p>
  </section>
</template>
