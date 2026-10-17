<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import type { Money } from '../../../shared/money/money'
import type { Bucket } from '../../workbook/domain/bucket'

export interface PayeeCategoryLine {
  readonly category: string
  readonly bucket: Bucket
  readonly amount: Money
  readonly count: number
  /** Transactions narrowed to this payee and this category. */
  readonly to: RouteLocationRaw | null
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import UPopover from '@nuxt/ui/components/Popover.vue'

import { bucketTone } from '../../../shared/charts/chartTokens'
import { formatWholeMoney } from '../../../shared/money/moneyFormat'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'

/**
 * The categories one payee was paid under: the largest as a chip, the split as a bar, and every one
 * in a breakdown. The slot sits between the chip and the bar, for a tag about the payee.
 */
const props = defineProps<{
  payee: string
  /** Largest first, never empty. */
  categories: readonly PayeeCategoryLine[]
}>()

const names = useDisplayNames()
const largest = computed(() => props.categories[0])
const paid = computed(() => props.categories.reduce((sum, line) => sum + line.amount, 0))

/** Hover and focus open the breakdown, so the trigger's name carries it too, for a keyboard that cannot reach the popover. */
const spokenBreakdown = computed(
  () => `${props.payee} by category: ${props.categories.map((line) => `${line.category === '' ? 'No category' : names.value.category(line.category)} ${formatWholeMoney(line.amount)}`).join(', ')}`,
)
</script>

<template>
  <div v-if="largest" class="payee-identity">
    <UPopover mode="hover" enable-touch :open-delay="120" :close-delay="120" :content="{ side: 'bottom', align: 'start', collisionPadding: 12 }">
      <button type="button" class="payee-categories" :aria-label="spokenBreakdown" data-testid="payee-categories">
        <CategoryChip :category="largest.category" :bucket="largest.bucket" class="min-w-0" />
        <span v-if="categories.length > 1" class="figure shrink-0 text-xs text-muted">+{{ categories.length - 1 }}</span>
      </button>
      <template #content>
        <ul class="breakdown" data-testid="payee-breakdown">
          <li v-for="line in categories" :key="line.category">
            <DrillLink :to="line.to" class="breakdown-line">
              <CategoryChip :category="line.category" :bucket="line.bucket" class="min-w-0" />
              <span class="figure shrink-0 text-xs text-muted">{{ line.count }} {{ line.count === 1 ? 'row' : 'rows' }}</span>
              <MoneyText :cents="line.amount" precision="whole" class="shrink-0 text-sm text-highlighted" />
            </DrillLink>
          </li>
        </ul>
      </template>
    </UPopover>
    <slot />
    <span v-if="categories.length > 1" class="split" aria-hidden="true">
      <span
        v-for="line in categories"
        :key="line.category"
        class="split-part"
        :style="{ flexGrow: Math.max(0, line.amount) / paid, background: `var(--bucket-${bucketTone(line.bucket)})` }"
      />
    </span>
  </div>
</template>

<style scoped>
.payee-identity {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.5rem;
}

.payee-categories {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  gap: 0.375rem;
  border-radius: 999px;
}

.payee-categories:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* One part per category, in its bucket's colour, with a surface gap so parts of one bucket stay apart. */
.split {
  display: flex;
  min-width: 2.5rem;
  flex: 1;
  gap: 2px;
  height: 4px;
}

/* A phone's name column is narrow, so the split takes its own line under the chip. */
@media (max-width: 639px) {
  .split {
    flex-basis: 100%;
  }
}

.split-part {
  flex-basis: 0;
  min-width: 2px;
  border-radius: 2px;
}

.breakdown {
  display: flex;
  min-width: 15rem;
  max-width: min(22rem, calc(100vw - 2rem));
  flex-direction: column;
  padding: 0.375rem;
}

.breakdown-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-control);
}

.breakdown-line:hover {
  background: var(--surface-elevated);
}
</style>
