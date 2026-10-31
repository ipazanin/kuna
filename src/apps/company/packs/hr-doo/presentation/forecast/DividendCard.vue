<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import AppCard from '../../../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import type { PayoutOptionId } from '../../domain/dividend/dividendCapacity'
import type { RuleChip } from '../yearEnd/LineBuildUp.vue'
import BuildUpList from './BuildUpList.vue'
import type { BuildUpLine } from './BuildUpList.vue'
import type { PayoutView } from './forecastView'
import { words as packWords } from '../words'
import { words } from './words'

/** What the year leaves to pay out, the three ways to do it as a switch, and the lines that weigh on how much. */
const props = defineProps<{
  year: number
  capacity: readonly BuildUpLine[]
  prudence: readonly BuildUpLine[]
  deterioration: readonly RuleChip[]
  decideBy: string
  payouts: readonly PayoutView[]
  /** The one line the collapsed card shows, such as what could be paid out. */
  summary: string
  chosen: PayoutOptionId
}>()

const emit = defineEmits<{
  choose: [id: PayoutOptionId]
}>()

const option = computed(() => props.payouts.find((entry) => entry.id === props.chosen) ?? props.payouts[0])
</script>

<template>
  <AppCard :title="words.dividend.title" :subtitle="words.dividend.subtitle(year, decideBy)" collapse-id="year.dividend" :summary="summary" data-testid="dividend-capacity">
    <div class="grid gap-x-8 gap-y-5 px-4 pt-3 pb-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div class="flex min-w-0 flex-col gap-4">
        <section :aria-label="words.dividend.canBePaidOut">
          <h3 class="mb-1 text-xs font-medium text-muted">{{ words.dividend.canBePaidOut }}</h3>
          <BuildUpList :lines="capacity" test-id="dividend-build-up" />
        </section>
        <section :aria-label="words.dividend.prudenceLabel">
          <h3 class="mb-1 text-xs font-medium text-muted">{{ words.dividend.prudence }}</h3>
          <BuildUpList :lines="prudence" test-id="dividend-prudence" />
          <p v-for="rule in deterioration" :key="rule.id" class="mt-2 flex items-start gap-2 text-xs text-muted">
            <UIcon name="i-lucide-scale" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {{ words.dividend.deterioration }}
              <DrillLink :to="rule.to" :label="packWords.figure.openRule(rule.title)" in-prose class="text-highlighted">{{ words.dividend.openRule }}</DrillLink>
            </span>
          </p>
        </section>
      </div>

      <div v-if="option" class="flex min-w-0 flex-col gap-3">
        <div class="flex flex-wrap gap-1.5" role="group" :aria-label="words.dividend.howToPay" data-testid="payout-switch">
          <UButton
            v-for="entry in payouts"
            :key="entry.id"
            :label="entry.name"
            size="sm"
            color="neutral"
            :variant="entry.id === option.id ? 'solid' : 'outline'"
            :aria-pressed="entry.id === option.id"
            @click="emit('choose', entry.id)"
          />
        </div>
        <div class="flex flex-col gap-1">
          <p class="text-sm text-highlighted">{{ option.label }}</p>
          <p class="text-xs text-muted">{{ option.when }}</p>
        </div>
        <p v-if="option.warning" class="flex items-start gap-2 text-xs text-error" data-testid="payout-warning">
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{{ option.warning }}</span>
        </p>
        <dl class="payout-cells" data-testid="payout-figures">
          <div v-for="figure in option.figures" :key="figure.key">
            <dt>{{ figure.label }}</dt>
            <dd>
              <DrillLink :to="figure.to" :label="packWords.figure.openRows(figure.label)">
                <MoneyText :cents="figure.cents" :class="{ 'text-error': figure.key === 'cash-left' && figure.cents < 0 }" />
              </DrillLink>
            </dd>
          </div>
        </dl>
        <p class="flex items-start gap-2 text-xs" :class="option.capitalProtected ? 'text-muted' : 'text-error'">
          <UIcon :name="option.capitalProtected ? 'i-lucide-shield-check' : 'i-lucide-shield-alert'" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{{ option.capitalProtected ? words.dividend.capitalCovered : words.dividend.capitalShort }}</span>
        </p>
        <ul v-if="option.rules.length > 0" class="flex flex-wrap gap-x-4 gap-y-1" :aria-label="packWords.figure.rules">
          <li v-for="rule in option.rules" :key="rule.id">
            <DrillLink :to="rule.to" :label="packWords.figure.openRule(rule.title)" class="text-xs text-highlighted">{{ rule.title }}</DrillLink>
          </li>
        </ul>
      </div>
    </div>
  </AppCard>
</template>

<style scoped>
.payout-cells {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.625rem 1rem;
}

@media (min-width: 1280px) {
  .payout-cells {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.payout-cells dt {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.payout-cells dd {
  font-size: 0.875rem;
  color: var(--ink);
}
</style>
