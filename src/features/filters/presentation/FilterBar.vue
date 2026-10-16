<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USlideover from '@nuxt/ui/components/Slideover.vue'

import { usePhoneLayout } from '../../../shared/layout/viewport'

import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { useSettings } from '../../settings/application/useSettings'
import { isDefinedBucket } from '../../workbook/domain/bucket'
import { counterpartyLabels } from '../../workbook/domain/counterpartyIdentity'
import type { Workbook } from '../../workbook/domain/workbook'
import { useFilters } from '../application/filterStore'
import { filterChips, withoutChip, withoutChips } from '../domain/filterChips'
import type { FilterState, Period } from '../domain/filterState'
import type { PeriodPreset } from '../domain/periodPresets'
import PeriodBar, { PRESET_LABELS } from './PeriodBar.vue'

const props = withDefaults(
  defineProps<{
    workbook: Workbook
    window: LedgerWindow
    presets?: readonly PeriodPreset[]
    /** The period the screen shows, when it reads the shared one differently, as Period review does. */
    shownPeriod?: Period
    showPeriod?: boolean
  }>(),
  { showPeriod: true },
)

const { filters: shared, setFilters } = useFilters()
const filters = computed(() => shared.value as FilterState)

const accountOptions = computed(() =>
  props.workbook.accounts.map((account) => ({ value: account.slug, label: account.slug })),
)

const settings = useSettings()
const labels = computed(() => counterpartyLabels(props.workbook.transactions))
const chips = computed(() =>
  filterChips(filters.value, {
    counterparty: (key) => labels.value.get(key) ?? key,
    bucket: (bucket) => (isDefinedBucket(bucket) ? settings.value.bucketLabels[bucket] : bucket),
  }),
)

const period = computed({
  get: () => props.shownPeriod ?? filters.value.period,
  set: (next: Period) => void setFilters({ ...filters.value, period: next }),
})

const accounts = computed({
  get: () => filters.value.accounts,
  set: (next: readonly string[]) => void setFilters({ ...filters.value, accounts: next }),
})

const phone = usePhoneLayout()
const sheetOpen = ref(false)

/** Narrowings beyond the period: the accounts, counted once, and every chip. */
const activeCount = computed(() => chips.value.length + (accounts.value.length > 0 ? 1 : 0))

const periodText = computed(() => {
  const shown = period.value
  switch (shown.preset) {
    case 'year':
      return String(shown.year)
    case 'quarter':
      return `Q${shown.quarter} ${shown.year}`
    case 'custom':
      return 'Custom range'
    default:
      return PRESET_LABELS[shown.preset]
  }
})
</script>

<template>
  <div v-if="phone" class="flex items-center gap-3">
    <USlideover v-model:open="sheetOpen" side="bottom" title="Filters" :ui="{ content: 'phone-sheet' }">
      <UButton icon="i-lucide-sliders-horizontal" color="neutral" variant="outline" data-testid="open-filters">
        <span>Filters</span>
        <UBadge v-if="activeCount > 0" :label="String(activeCount)" size="sm" class="rounded-full" data-testid="filter-count" />
        <span class="sr-only">, {{ activeCount }} active</span>
      </UButton>
      <template #body>
        <PeriodBar
          v-model:period="period"
          v-model:accounts="accounts"
          :account-options="accountOptions"
          :window="window"
          :show-period="showPeriod"
          :chips="chips"
          stacked
          v-bind="presets === undefined ? {} : { presets }"
          @remove-chip="(id) => setFilters(withoutChip(filters, id))"
          @clear-chips="setFilters(withoutChips(filters))"
        />
      </template>
      <template #footer>
        <UButton label="Show results" block size="lg" @click="sheetOpen = false" />
      </template>
    </USlideover>
    <p v-if="showPeriod" class="min-w-0 truncate text-sm text-muted">{{ periodText }}</p>
  </div>
  <PeriodBar
    v-else
    v-model:period="period"
    v-model:accounts="accounts"
    :account-options="accountOptions"
    :window="window"
    :show-period="showPeriod"
    :chips="chips"
    v-bind="presets === undefined ? {} : { presets }"
    @remove-chip="(id) => setFilters(withoutChip(filters, id))"
    @clear-chips="setFilters(withoutChips(filters))"
  />
</template>
