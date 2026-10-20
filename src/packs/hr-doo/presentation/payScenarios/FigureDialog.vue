<script setup lang="ts">
import UModal from '@nuxt/ui/components/Modal.vue'

import { usePhoneLayout } from '../../../../shared/layout/viewport'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ConfidenceBadge from '../../ruleset/presentation/ConfidenceBadge.vue'
import { WATCHED_WORDING } from './payScenariosView'
import type { FigureDetail } from './payScenariosView'

/** One figure of a scenario opened on its build-up, the rows behind its steps and the rules it rests on. */
const open = defineModel<boolean>('open', { required: true })

defineProps<{
  detail: FigureDetail | null
}>()

const phone = usePhoneLayout()
</script>

<template>
  <UModal v-model:open="open" :title="detail?.title ?? ''" :description="detail?.subtitle ?? ''" :fullscreen="phone" :ui="{ header: 'pe-16 sm:pe-6' }">
    <template #body>
      <div v-if="detail" class="flex flex-col gap-4" data-testid="figure-detail">
        <p class="text-lg font-medium text-highlighted"><MoneyText :cents="detail.cents" /></p>
        <section v-if="detail.steps.length > 0" aria-label="Step by step">
          <h3 class="mb-1 text-xs font-medium text-muted">Step by step</h3>
          <ul class="flex flex-col gap-0.5">
            <li v-for="step in detail.steps" :key="step.key" class="step-row" :class="{ 'is-nested': step.depth === 1 }">
              <DrillLink :to="step.to" :label="`${step.label}, open the rows`" class="min-w-0">{{ step.label }}</DrillLink>
              <MoneyText v-if="step.cents !== null" :cents="step.cents" class="shrink-0 text-toned" />
            </li>
          </ul>
        </section>
        <section v-if="detail.rules.length > 0" aria-label="Rules">
          <h3 class="mb-1 text-xs font-medium text-muted">Rules</h3>
          <ul class="flex flex-wrap gap-x-4 gap-y-1">
            <li v-for="rule in detail.rules" :key="rule.id">
              <DrillLink :to="rule.to" :label="`${rule.title}, open the rule`" class="text-sm text-highlighted">{{ rule.title }}</DrillLink>
            </li>
          </ul>
        </section>
        <section v-if="detail.watched.length > 0" class="flex flex-col gap-2" aria-label="Rules still to be settled">
          <p v-for="group in detail.watched" :key="group.confidence" class="flex items-start gap-2">
            <ConfidenceBadge :confidence="group.confidence" />
            <span class="min-w-0 text-xs text-muted">{{ WATCHED_WORDING[group.confidence] }}: {{ group.rules.map((rule) => rule.title).join(', ') }}.</span>
          </p>
        </section>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.step-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--ink);
}

.step-row.is-nested {
  padding-inline-start: 0.875rem;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
</style>
