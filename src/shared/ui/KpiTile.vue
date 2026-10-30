<script lang="ts">
export interface KpiDelta {
  /** Signed change against the comparison. Only its sign is used, to pick the arrow and the colour. */
  readonly change: number
  /** The change as the reader sees it, such as "+12.4%" or "−€310". */
  readonly text: string
  /** What the change is measured against, such as "vs the 12 months before". */
  readonly comparison: string
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import UIcon from '@nuxt/ui/components/Icon.vue'

import AppCard from './AppCard.vue'
import InfoPopover from './InfoPopover.vue'
import SparkLine from './SparkLine.vue'
import { words } from './words'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    /** Null when no row is behind the figure. The tile then opens nothing. */
    to: RouteLocationRaw | null
    delta?: KpiDelta
    /** False for costs and other figures where a rise is bad news. */
    higherIsBetter?: boolean
    trend?: readonly number[]
    definition?: string
    /** A short line under the value, such as what a count is made of. */
    caption?: string
  }>(),
  { higherIsBetter: true },
)

const deltaPresentation = computed(() => {
  const delta = props.delta
  if (delta === undefined) return null
  if (delta.change === 0) return { icon: 'i-lucide-minus', tone: 'text-muted', verdict: words.verdict.unchanged }
  const rose = delta.change > 0
  const good = rose === props.higherIsBetter
  return {
    icon: rose ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-down-right',
    tone: good ? 'text-success' : 'text-error',
    verdict: good ? words.verdict.better : words.verdict.worse,
  }
})
</script>

<template>
  <AppCard as="article" class="kpi-tile group relative gap-3 p-4 transition-colors hover:border-accented">
    <div class="flex items-start justify-between gap-2">
      <RouterLink v-if="to !== null" :to="to" class="kpi-link min-w-0 text-sm text-muted transition-colors group-hover:text-toned">
        <span class="block truncate">{{ label }}</span>
        <span class="sr-only">: {{ value }}</span>
      </RouterLink>
      <p v-else class="kpi-label min-w-0 truncate text-sm text-muted">{{ label }}</p>
      <div v-if="definition" class="relative z-control -my-1 -me-1.5">
        <InfoPopover :subject="label" :definition="definition" />
      </div>
    </div>

    <div class="flex items-end justify-between gap-3">
      <div class="min-w-0">
        <p class="text-figure-lg font-semibold text-highlighted">
          <slot name="value">{{ value }}</slot>
        </p>
        <p v-if="caption" class="mt-1.5 text-xs text-muted">{{ caption }}</p>
        <p v-if="delta && deltaPresentation" class="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
          <span class="inline-flex items-center gap-0.5 font-medium" :class="deltaPresentation.tone">
            <UIcon :name="deltaPresentation.icon" class="size-3.5" aria-hidden="true" />
            <span class="figure">{{ delta.text }}</span>
            <span class="sr-only">, {{ deltaPresentation.verdict }}</span>
          </span>
          <span>{{ delta.comparison }}</span>
        </p>
        <slot />
      </div>
      <SparkLine v-if="trend" :points="trend" class="kpi-trend mb-0.5" />
    </div>
  </AppCard>
</template>

<style scoped>
/* The label is the link, and its hit area stretches over the whole tile. */
.kpi-link::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-card);
}

.kpi-tile:has(.kpi-link:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.kpi-link:focus-visible {
  outline: none;
}

/* The tile is the target, but the label is the element, so it takes the tap height without moving the text. */
@media (max-width: 639px) {
  .kpi-link {
    display: flex;
    align-items: center;
    margin-block: -0.75rem;
  }

  /* Two tiles share a phone's row, so they drop the sparkline and set the figure smaller. */
  .kpi-tile {
    gap: 0.5rem;
    padding: 0.75rem;
  }

  .kpi-tile .text-figure-lg {
    font-size: 1.25rem;
    line-height: 1.75rem;
  }

  .kpi-trend {
    display: none;
  }

  .kpi-link .truncate,
  .kpi-label {
    white-space: normal;
  }
}
</style>
