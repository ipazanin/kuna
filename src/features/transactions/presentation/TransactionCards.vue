<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { Money } from '../../../shared/money/money'
import AppCard from '../../../shared/ui/AppCard.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import { useFilters } from '../../filters/application/filterStore'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { DefinedBucket } from '../../workbook/domain/bucket'
import { bucketTone } from '../../../shared/charts/chartTokens'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import { OWNER_ADVANCE_LABEL, withSplitHeadings } from '../domain/listedRows'
import type { ListedRow } from '../domain/listedRows'
import type { Transaction } from '../../workbook/domain/workbook'
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
  /** True while a change is being written, when no split can be opened. */
  writing: boolean
}>()

const emit = defineEmits<{
  toggle: [key: string]
  split: [row: Transaction]
}>()

const { drillLocation } = useFilters()
const names = useDisplayNames()

/** One untitled section when ungrouped, so both forms share the card markup. A split payment heads its parts. */
const sections = computed(() =>
  props.groups === null
    ? [{ key: 'all', entries: withSplitHeadings(props.rows), group: null }]
    : props.groups.map((group) => ({ key: group.key, entries: withSplitHeadings(group.rows), group })),
)

const thisYear = String(new Date().getFullYear())
const dayInYear = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "12 Sept" this year, "12 Sept 2025" before it. */
function shortDate(row: Pick<ListedRow, 'date'>): string {
  return (row.date.startsWith(thisYear) ? dayInYear : dayFormat).format(new Date(row.date))
}

/** The rows whose description and links are open, by key. A tap on a row opens or closes it. */
const openRows = ref(new Set<string>())

function toggleRow(key: string): void {
  if (!openRows.value.delete(key)) openRows.value.add(key)
}

function badgeOf(row: ListedRow): { label: string; color: 'warning' | 'info' | 'neutral' } | null {
  if (row.kind === 'owner-advance') return { label: OWNER_ADVANCE_LABEL, color: 'neutral' }
  if (row.bucket === UNCLASSIFIED) return { label: 'Unclassified', color: 'warning' }
  if (row.flaggedBy === 'ai') return { label: 'AI guess', color: 'info' }
  return null
}

function accountOf(row: ListedRow): string {
  return row.kind === 'bank' ? names.value.account(row.account) : 'No bank account'
}
</script>

<template>
  <AppCard as="div" class="overflow-clip">
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
        <template v-for="entry in section.entries" :key="entry.kind === 'split' ? entry.key : entry.row.key">
        <li v-if="entry.kind === 'split'" class="card split-heading" data-testid="split-heading">
          <span class="flex min-w-0 flex-col gap-0.5">
            <span class="flex items-baseline justify-between gap-3">
              <span class="min-w-0 truncate font-medium text-highlighted">{{ entry.whole.counterparty || 'No counterparty' }}</span>
              <MoneyText :cents="entry.whole.amount" class="shrink-0 text-muted" />
            </span>
            <span class="flex items-center gap-2 text-xs text-muted">
              <UBadge :label="`Split in ${entry.count} parts`" color="neutral" variant="subtle" size="sm" />
              <span class="figure">{{ shortDate(entry.whole) }}<template v-if="showAccount">, {{ names.account(entry.whole.account) }}</template></span>
            </span>
          </span>
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            :disabled="writing"
            :aria-label="`Edit the split of ${entry.whole.counterparty || 'the payment'}`"
            data-testid="edit-split"
            @click="emit('split', entry.whole)"
          />
        </li>
        <li v-else class="card" :class="{ part: entry.row.kind === 'bank' && entry.row.split }" data-testid="transaction-card">
          <button type="button" class="card-summary" :aria-expanded="openRows.has(entry.row.key)" @click="toggleRow(entry.row.key)">
            <span class="flex items-baseline justify-between gap-3">
              <span v-if="entry.row.kind === 'bank' && entry.row.split" class="flex min-w-0 items-center gap-1.5 text-toned">
                <UIcon name="i-lucide-corner-down-right" class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                <span class="truncate">Part {{ entry.row.split.index + 1 }} of {{ entry.row.split.count }}<template v-if="entry.row.split.note">, {{ entry.row.split.note }}</template></span>
              </span>
              <span v-else class="min-w-0 truncate font-medium text-highlighted">{{ entry.row.counterparty || 'No counterparty' }}</span>
              <MoneyText :cents="entry.row.amount" tone="flow" class="shrink-0 font-medium" />
            </span>
            <span class="flex items-center justify-between gap-3 text-xs text-muted">
              <span class="flex min-w-0 items-center gap-1.5">
                <span class="size-2 shrink-0 rounded-[2px]" :style="{ background: `var(--bucket-${bucketTone(entry.row.bucket)})` }" aria-hidden="true" />
                <span class="truncate text-toned">{{ entry.row.category === '' ? 'No category' : names.category(entry.row.category) }}</span>
                <UBadge v-if="badgeOf(entry.row)" v-bind="badgeOf(entry.row)" variant="subtle" size="sm" class="shrink-0" />
              </span>
              <span class="figure shrink-0">
                {{ shortDate(entry.row) }}<template v-if="showAccount">, {{ accountOf(entry.row) }}</template>
              </span>
            </span>
          </button>
          <div v-if="openRows.has(entry.row.key)" class="card-details" data-testid="transaction-details">
            <p v-if="entry.row.description" class="text-sm text-toned">{{ entry.row.description }}</p>
            <p class="text-xs text-muted">{{ dayFormat.format(new Date(entry.row.date)) }}, {{ accountOf(entry.row) }}</p>
            <div class="flex flex-wrap gap-x-4">
              <DrillLink
                v-if="entry.row.kind === 'bank'"
                :to="drillLocation(drillToTransactions({ counterparties: [counterpartyIdentity(entry.row).key] }))"
                class="inline-target text-sm text-highlighted"
              >
                Every row from this counterparty
              </DrillLink>
              <DrillLink
                v-if="entry.row.category"
                :to="drillLocation(drillToTransactions({ categories: [entry.row.category] }))"
                class="inline-target text-sm text-highlighted"
              >
                Every row in {{ names.category(entry.row.category) }}
              </DrillLink>
              <UButton
                v-if="entry.row.kind === 'bank' && !entry.row.split && entry.row.amount !== 0"
                label="Split"
                icon="i-lucide-split"
                color="neutral"
                variant="link"
                class="inline-target px-0 text-sm"
                :disabled="writing"
                data-testid="split-row"
                @click="emit('split', entry.row)"
              />
            </div>
          </div>
        </li>
        </template>
      </ul>
    </section>
  </AppCard>
</template>

<style scoped>
/* The page scrolls under the bars that stay at the top, the top bar and the tab row, so a heading sticks just below them. */
.group-heading {
  position: sticky;
  top: var(--sticky-band);
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

.split-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.5rem 0.5rem 1rem;
}

.part .card-summary {
  padding-inline-start: 1.75rem;
}
</style>
