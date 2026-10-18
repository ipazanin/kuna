<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import type { Money } from '../../../shared/money/money'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import { useFilters } from '../../filters/application/filterStore'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { DefinedBucket } from '../../workbook/domain/bucket'
import { bucketTone } from '../../../shared/charts/chartTokens'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import type { ListedRow } from '../domain/listedRows'
import type { TransactionGroup } from '../domain/transactionGroups'
import TransactionGroupHeading from './TransactionGroupHeading.vue'

/** The phone's form of the transaction table: one card per row, under the same group headings. */
const props = defineProps<{
  /** Already in display order. */
  rows: readonly ListedRow[]
  /** Null for one ungrouped list. */
  groups: readonly TransactionGroup[] | null
  total: Money
  bucketLabels: Readonly<Record<DefinedBucket, string>>
  isCollapsed: (key: string) => boolean
  /** Off when only one account is in view, where naming it on every row says nothing. */
  showAccount: boolean
}>()

const emit = defineEmits<{
  toggle: [key: string]
}>()

const { drillLocation } = useFilters()
const names = useDisplayNames()

/** One untitled section when ungrouped, so both forms share the card markup. */
const sections = computed(() =>
  props.groups === null
    ? [{ key: 'all', rows: props.rows, group: null }]
    : props.groups.map((group) => ({ key: group.key, rows: group.rows, group })),
)

const thisYear = String(new Date().getFullYear())
const dayInYear = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "12 Sept" this year, "12 Sept 2025" before it. */
function shortDate(row: ListedRow): string {
  return (row.date.startsWith(thisYear) ? dayInYear : dayFormat).format(new Date(row.date))
}

/** The rows whose description and links are open, by key. A tap on a row opens or closes it. */
const openRows = ref(new Set<string>())

function toggleRow(key: string): void {
  if (!openRows.value.delete(key)) openRows.value.add(key)
}

function badgeOf(row: ListedRow): { label: string; color: 'warning' | 'info' | 'neutral' } | null {
  if (row.kind === 'owner-advance') return { label: row.label, color: 'neutral' }
  if (row.bucket === UNCLASSIFIED) return { label: 'Unclassified', color: 'warning' }
  if (row.flaggedBy === 'ai') return { label: 'AI guess', color: 'info' }
  return null
}

function accountOf(row: ListedRow): string {
  return row.kind === 'bank' ? names.value.account(row.account) : 'No bank account'
}
</script>

<template>
  <div class="overflow-clip rounded-card border border-default bg-raised shadow-raised">
    <p class="flex items-baseline justify-between gap-3 border-b border-default px-4 py-3 text-sm" data-testid="transaction-total">
      <span class="text-muted">{{ rows.length }} {{ rows.length === 1 ? 'row' : 'rows' }}, total</span>
      <MoneyText :cents="total" class="font-semibold text-highlighted" />
    </p>

    <section v-for="section in sections" :key="section.key" :data-testid="section.group ? 'transaction-group' : undefined">
      <h2 v-if="section.group" class="group-heading">
        <TransactionGroupHeading
          :group="section.group"
          :expanded="!isCollapsed(section.key)"
          :bucket-labels="bucketLabels"
          @toggle="emit('toggle', section.key)"
        />
      </h2>
      <ul v-if="!section.group || !isCollapsed(section.key)">
        <li v-for="row in section.rows" :key="row.key" class="card" data-testid="transaction-card">
          <button type="button" class="card-summary" :aria-expanded="openRows.has(row.key)" @click="toggleRow(row.key)">
            <span class="flex items-baseline justify-between gap-3">
              <span class="min-w-0 truncate font-medium text-highlighted">{{ row.counterparty || 'No counterparty' }}</span>
              <MoneyText :cents="row.amount" tone="flow" class="shrink-0 font-medium" />
            </span>
            <span class="flex items-center justify-between gap-3 text-xs text-muted">
              <span class="flex min-w-0 items-center gap-1.5">
                <span class="size-2 shrink-0 rounded-[2px]" :style="{ background: `var(--bucket-${bucketTone(row.bucket)})` }" aria-hidden="true" />
                <span class="truncate text-toned">{{ row.category === '' ? 'No category' : names.category(row.category) }}</span>
                <UBadge v-if="badgeOf(row)" v-bind="badgeOf(row)" variant="subtle" size="sm" class="shrink-0" />
              </span>
              <span class="figure shrink-0">
                {{ shortDate(row) }}<template v-if="showAccount">, {{ accountOf(row) }}</template>
              </span>
            </span>
          </button>
          <div v-if="openRows.has(row.key)" class="card-details" data-testid="transaction-details">
            <p v-if="row.description" class="text-sm text-toned">{{ row.description }}</p>
            <p class="text-xs text-muted">{{ dayFormat.format(new Date(row.date)) }}, {{ accountOf(row) }}</p>
            <div class="flex flex-wrap gap-x-4">
              <DrillLink
                v-if="row.kind === 'bank'"
                :to="drillLocation(drillToTransactions({ counterparties: [counterpartyIdentity(row).key] }))"
                class="inline-target text-sm text-highlighted"
              >
                Every row from this counterparty
              </DrillLink>
              <DrillLink
                v-if="row.category"
                :to="drillLocation(drillToTransactions({ categories: [row.category] }))"
                class="inline-target text-sm text-highlighted"
              >
                Every row in {{ names.category(row.category) }}
              </DrillLink>
            </div>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
/* The page scrolls under the phone's top app bar, so a heading sticks just below it. */
.group-heading {
  position: sticky;
  top: calc(3.5rem + env(safe-area-inset-top));
  z-index: 1;
  border-bottom: 1px solid var(--border-default);
  background: var(--surface-elevated);
}

.card-summary {
  display: flex;
  width: 100%;
  min-height: 4rem;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  text-align: start;
}

.card-summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.card-summary[aria-expanded='true'] {
  background: var(--surface-elevated);
}

.card-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0 1rem 0.75rem;
  background: var(--surface-elevated);
}

.card + .card {
  border-top: 1px solid var(--border-default);
}
</style>
