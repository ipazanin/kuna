<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { formatPercent } from '../../../../shared/money/moneyFormat'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { inSentence } from '../../settings/domain/profitAndLossLabels'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { isDefinedBucket } from '../../workbook/domain/bucket'
import type { DefinedBucket } from '../../workbook/domain/bucket'
import { useCategoryColours } from '../../workbook/presentation/categoryColours'
import type { GroupShare, TransactionGroup } from '../domain/transactionGroups'
import CategoryChip from './CategoryChip.vue'

/** The heading of one group of transactions, which collapses and expands the group. */
const props = defineProps<{
  group: TransactionGroup
  expanded: boolean
  bucketLabels: Readonly<Record<DefinedBucket, string>>
}>()

const emit = defineEmits<{
  toggle: []
}>()

const names = useDisplayNames()
const colours = useCategoryColours()

const rowCount = computed(() => `${props.group.rows.length} ${props.group.rows.length === 1 ? 'row' : 'rows'}`)

const bucketLabel = computed(() => {
  const shown = props.group
  if (shown.kind !== 'category') return ''
  return isDefinedBucket(shown.bucket) ? props.bucketLabels[shown.bucket] : 'Unclassified'
})

const share = computed<GroupShare | null>(() => (props.group.kind === 'month' ? null : props.group.share))

const shareWhole = computed(() => {
  switch (share.value?.of) {
    case 'income':
      return inSentence(props.bucketLabels.income)
    case 'cost':
      return 'costs'
    case 'money-in':
      return 'money in'
    default:
      return 'money out'
  }
})

/** A category's bar wears its colour, or its bucket's. A counterparty has no colour of its own. */
const shareColour = computed(() => (props.group.kind === 'category' ? colours.value(props.group.category, props.group.bucket) : 'var(--chart-deemphasis)'))

const groupName = computed(() => {
  const shown = props.group
  if (shown.kind === 'month') return monthLabel(shown.month)
  if (shown.kind === 'category') return shown.category === '' ? 'No category' : names.value.category(shown.category)
  return shown.label || 'No counterparty'
})
</script>

<template>
  <button type="button" class="group-toggle" :aria-expanded="expanded" data-testid="group-toggle" @click="emit('toggle')">
    <UIcon name="i-lucide-chevron-down" class="chevron" aria-hidden="true" />

    <span class="identity">
      <template v-if="group.kind === 'category'">
        <CategoryChip :category="group.category" :bucket="group.bucket" class="shrink min-w-0" />
        <span class="meta">{{ bucketLabel }}</span>
      </template>
      <template v-else-if="group.kind === 'month'">
        <span class="name">{{ groupName }}</span>
        <span v-if="group.coverage !== 'complete'" class="meta inline-flex items-center gap-1.5">
          <span class="incomplete-swatch" aria-hidden="true" />
          {{ group.coverage === 'month-so-far' ? 'Month so far' : 'Part month' }}
        </span>
      </template>
      <template v-else>
        <span class="name">{{ groupName }}</span>
        <span v-if="group.iban" class="identifier meta truncate">{{ group.iban }}</span>
      </template>
      <span class="meta figure shrink-0">{{ rowCount }}</span>
    </span>

    <span class="figures">
      <template v-if="group.kind === 'month'">
        <span class="figure-pair">
          <span class="meta">{{ bucketLabels.income }}</span>
          <MoneyText :cents="group.income" class="text-toned" />
        </span>
        <span class="figure-pair">
          <span class="meta">Costs</span>
          <MoneyText :cents="group.cost" class="text-toned" />
        </span>
        <span class="figure-pair">
          <span class="meta">Net</span>
          <MoneyText :cents="group.net" tone="outcome" class="font-medium" />
        </span>
      </template>
      <template v-else>
        <span v-if="share" class="share" :title="`${formatPercent(share.fraction)} of ${shareWhole}`">
          <span class="share-track" aria-hidden="true">
            <span class="share-fill" :style="{ width: `${Math.min(1, Math.max(0, share.fraction)) * 100}%`, background: shareColour }" />
          </span>
          <span class="figure share-figure">{{ formatPercent(share.fraction) }}</span>
          <span class="sr-only">of {{ shareWhole }}</span>
        </span>
        <span v-else class="share" aria-hidden="true" />
        <MoneyText :cents="group.total" tone="flow" class="total font-medium" />
      </template>
    </span>
  </button>
</template>

<style scoped>
.group-toggle {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 0.625rem;
  width: 100%;
  padding: 0.625rem 1rem 0.625rem 0.75rem;
  text-align: start;
  font-size: 0.8125rem;
  color: var(--ink-strong);
  transition: background-color 120ms ease;
}

.group-toggle:hover {
  background: var(--surface-accented);
}

.group-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.chevron {
  width: 1rem;
  height: 1rem;
  color: var(--ink-muted);
  transition: transform 150ms ease;
}

.group-toggle[aria-expanded='false'] .chevron {
  transform: rotate(-90deg);
}

.identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
}

.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.meta {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--ink-muted);
  white-space: nowrap;
}

.incomplete-swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: repeating-linear-gradient(45deg, var(--chart-hatch) 0 1.5px, transparent 1.5px 4px), var(--chart-deemphasis);
}

.figures {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1.25rem;
}

.figure-pair {
  display: inline-flex;
  align-items: baseline;
  gap: 0.375rem;
}

.share {
  display: inline-flex;
  width: 8.5rem;
  align-items: center;
  gap: 0.5rem;
}

.share-track {
  flex: 1;
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--surface-accented);
}

.share-fill {
  display: block;
  height: 100%;
  border-radius: 2px;
}

.share-figure {
  width: 3rem;
  text-align: end;
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.total {
  min-width: 6.5rem;
  text-align: end;
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
}

/* A phone has no room for one line, so the figures move under the name. */
@media (max-width: 639px) {
  .group-toggle {
    grid-template-columns: auto minmax(0, 1fr);
    row-gap: 0.375rem;
    padding: 0.5rem 1rem 0.5rem 0.75rem;
  }

  .identity {
    gap: 0.5rem;
  }

  .figures {
    grid-column: 2;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .share {
    width: auto;
    flex: 1;
    max-width: 10rem;
  }

  .total {
    min-width: 0;
  }
}
</style>
