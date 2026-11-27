<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { HoldingDetails } from './holdingDetails'
import { words } from './words'
import { INVESTMENTS_PRICES_ROUTE } from '../../overview/presentation/investmentLinks'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import { withFullStop } from '../../../../shared/text/withFullStop'
import { TONE_ICONS } from '../../../../shared/ui/toneText'

/**
 * What the holding is and where each fact came from, a warning for each fact a vendor sent nothing usable for with a
 * way to ask again and to Change, a line with the way to Change for one set not to fetch its facts, a leveraged fund's warning, and
 * what a fund's rings wait for: the way to type its mix, or its price.
 */
const props = defineProps<{
  details: HoldingDetails
  /** Whether its facts are being asked for again. */
  asking: boolean
  /** How the last press of Ask again on this page went, or null before one. */
  askedAgain: 'asked' | 'not-asked' | null
  /** The names of the warning's vendors this browser has no key for. */
  keyless: readonly string[]
}>()

const emit = defineEmits<{
  change: []
  askAgain: []
}>()

const text = words.details.problems

/** Every fact a vendor sent nothing usable for, in one warning, since one Ask again asks for them all. */
const problem = computed(() => {
  const sentences = props.details.problems?.sentences ?? []
  return sentences.length === 1 ? sentences[0]! : sentences.map(withFullStop).join(' ')
})

/** With no key of any of the warning's vendors, Ask again could ask nothing, so the warning leads to the keys instead. */
const askable = computed(() => props.keyless.length < (props.details.problems?.vendors.length ?? 0))

const note = computed(() => {
  const warning = props.details.problems
  if (warning === null) return ''
  const [asked, again] = [dayLabel(warning.askedOn), dayLabel(warning.asksAgainOn)]
  return [
    ...(props.askedAgain === null ? [] : [props.askedAgain === 'asked' ? text.askedNow : text.notAsked]),
    askable.value ? text.when(asked, again) : text.whenKeyless(asked, again),
    ...props.keyless.map(text.noKey),
  ].join(' ')
})

/** Ask again or the way to the keys, then Change, where the person can type the facts or set the holding not to fetch them. */
const actions = computed(() => [
  askable.value
    ? { label: text.askAgain, icon: 'i-lucide-refresh-cw', color: 'neutral' as const, variant: 'outline' as const, size: 'sm' as const, loading: props.asking, onClick: () => emit('askAgain') }
    : { label: text.toSettings, icon: 'i-lucide-key-round', color: 'neutral' as const, variant: 'outline' as const, size: 'sm' as const, to: INVESTMENTS_PRICES_ROUTE },
  {
    label: words.actions.change,
    icon: 'i-lucide-pencil',
    color: 'neutral' as const,
    variant: 'outline' as const,
    size: 'sm' as const,
    'data-testid': 'holding-fact-problem-change',
    onClick: () => emit('change'),
  },
])
</script>

<template>
  <AppCard :title="words.details.title" data-testid="holding-details">
    <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5">
      <UAlert v-if="details.problems !== null" :icon="TONE_ICONS.warning" color="warning" variant="subtle" :title="problem" :description="note" :actions="actions" data-testid="holding-fact-problem" />
      <NoteLine v-if="details.typedFactsOnly" tone="muted" icon="i-lucide-pencil-line" as="div" data-testid="holding-typed-facts-only">
        <span class="flex flex-wrap items-center gap-x-1">
          {{ words.details.typedFactsOnly }}
          <UButton :label="words.actions.change" color="neutral" variant="link" size="sm" class="inline-target quiet-link px-0" data-testid="holding-typed-facts-change" @click="emit('change')" />
        </span>
      </NoteLine>
      <UAlert
        v-if="details.leveraged !== null"
        :icon="TONE_ICONS.warning"
        color="warning"
        variant="subtle"
        :title="words.details.leveragedTitle"
        :description="details.leveraged"
        data-testid="holding-leveraged"
      />
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
