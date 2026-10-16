<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import { sumMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import { useFilters } from '../../filters/application/filterStore'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import type { Transaction } from '../../workbook/domain/workbook'

/** The phone's form of the transaction table: one card per row, under the same group headings. */
const props = defineProps<{
  /** Already in display order. */
  rows: readonly Transaction[]
  /** The heading a row goes under, or null for one ungrouped list. */
  groupOf: ((transaction: Transaction) => string) | null
  total: Money
}>()

const { drillLocation } = useFilters()

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

interface CardGroup {
  readonly heading: string | null
  readonly rows: readonly Transaction[]
  readonly total: Money
}

/** Groups in the order their first row appears, so a newest-first list keeps the newest group on top. */
const groups = computed<CardGroup[]>(() => {
  const groupOf = props.groupOf
  if (groupOf === null) {
    return [{ heading: null, rows: props.rows, total: props.total }]
  }
  const byHeading = new Map<string, Transaction[]>()
  for (const transaction of props.rows) {
    const heading = groupOf(transaction)
    const members = byHeading.get(heading)
    if (members === undefined) {
      byHeading.set(heading, [transaction])
    } else {
      members.push(transaction)
    }
  }
  return [...byHeading].map(([heading, members]) => ({
    heading,
    rows: members,
    total: sumMoney(members.map((transaction) => transaction.amount)),
  }))
})

function bucketColour(transaction: Transaction): string {
  return `var(--bucket-${transaction.bucket === UNCLASSIFIED ? 'neutral' : transaction.bucket})`
}

function reviewBadge(transaction: Transaction): { label: string; color: 'warning' | 'info' } | null {
  if (transaction.bucket === UNCLASSIFIED) return { label: 'Unclassified', color: 'warning' }
  if (transaction.flaggedBy === 'ai') return { label: 'AI guess', color: 'info' }
  return null
}
</script>

<template>
  <div class="overflow-hidden rounded-card border border-default bg-raised shadow-raised">
    <p class="flex items-baseline justify-between gap-3 border-b border-default px-4 py-3 text-sm" data-testid="transaction-total">
      <span class="text-muted">{{ rows.length }} {{ rows.length === 1 ? 'row' : 'rows' }}, total</span>
      <MoneyText :cents="total" class="font-semibold text-highlighted" />
    </p>

    <section v-for="group in groups" :key="group.heading ?? 'all'">
      <h2 v-if="group.heading !== null" class="group-heading">
        <span class="min-w-0 truncate">{{ group.heading }}, {{ group.rows.length }} {{ group.rows.length === 1 ? 'row' : 'rows' }}</span>
        <MoneyText :cents="group.total" class="shrink-0" />
      </h2>
      <ul>
        <li v-for="transaction in group.rows" :key="transaction.sheetRow" class="card" data-testid="transaction-card">
          <div class="flex items-center justify-between gap-3">
            <DrillLink
              :to="drillLocation(drillToTransactions({ counterparties: [counterpartyIdentity(transaction).key] }))"
              class="min-w-0 font-medium text-highlighted"
            >
              <span class="truncate">{{ transaction.counterparty || 'No counterparty' }}</span>
            </DrillLink>
            <MoneyText :cents="transaction.amount" toned class="shrink-0 font-medium" />
          </div>
          <p v-if="transaction.description" class="-mt-1 truncate text-xs text-muted">{{ transaction.description }}</p>
          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-2">
              <DrillLink v-if="transaction.category" :to="drillLocation(drillToTransactions({ categories: [transaction.category] }))" class="min-w-0">
                <span class="category-chip">
                  <span class="size-2 shrink-0 rounded-[2px]" :style="{ background: bucketColour(transaction) }" aria-hidden="true" />
                  <span class="truncate">{{ transaction.category }}</span>
                </span>
              </DrillLink>
              <span v-else class="category-chip text-muted">
                <span class="size-2 shrink-0 rounded-[2px]" :style="{ background: bucketColour(transaction) }" aria-hidden="true" />
                no category
              </span>
              <UBadge v-if="reviewBadge(transaction)" v-bind="reviewBadge(transaction)" variant="subtle" size="sm" class="shrink-0" />
            </div>
            <p class="figure shrink-0 text-end text-xs text-muted">
              <span class="block">{{ dayFormat.format(new Date(transaction.date)) }}</span>
              <span class="block">{{ transaction.account }}</span>
            </p>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.group-heading {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border-default);
  background: var(--surface-elevated);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--ink-strong);
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.25rem 1rem 0.5rem;
}

.card + .card {
  border-top: 1px solid var(--border-default);
}

.category-chip {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0.375rem;
  padding: 0.1875rem 0.625rem;
  border: 1px solid var(--border-default);
  border-radius: 999px;
  background: var(--surface-elevated);
  font-size: 0.75rem;
  color: var(--ink-secondary);
}
</style>
