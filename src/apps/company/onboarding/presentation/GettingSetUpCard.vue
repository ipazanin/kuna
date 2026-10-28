<script setup lang="ts">
import { computed } from 'vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { gettingSetUp } from './gettingSetUp'

/** What new books still lack, on Overview above everything else, with the screen that does each. The card goes once nothing is left. */
const { state } = useWorkbook()

const lines = computed(() => (state.workbook === null ? [] : gettingSetUp(state.workbook)))
</script>

<template>
  <AppCard v-if="lines.length" title="Getting set up" subtitle="What the books still lack. Each line goes once it is done." data-testid="getting-set-up">
    <ul class="flex flex-col px-4 pt-2 pb-3 sm:px-5">
      <li v-for="line in lines" :key="line.key" class="setup-line" :data-line="line.key">
        <span class="setup-mark" aria-hidden="true" />
        <span class="min-w-0 flex-1 text-sm text-toned">{{ line.text }}</span>
        <DrillLink :to="line.link.to" :label="`${line.text}, open ${line.link.label}`" class="shrink-0 text-sm font-medium text-highlighted">{{ line.link.label }}</DrillLink>
      </li>
    </ul>
  </AppCard>
</template>

<style scoped>
.setup-line {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-height: 2.5rem;
}

.setup-line + .setup-line {
  border-top: 1px solid var(--border-default);
}

/* An open ring, a step still to take, in the brass of the ledger's margin rule. */
.setup-mark {
  width: 0.625rem;
  height: 0.625rem;
  flex: none;
  border: 1.5px solid var(--accent);
  border-radius: 50%;
}
</style>
