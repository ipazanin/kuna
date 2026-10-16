<script setup lang="ts">
import { computed } from 'vue'

import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { counterpartyLabels } from '../../workbook/domain/counterpartyIdentity'
import type { Workbook } from '../../workbook/domain/workbook'
import { useFilters } from '../application/filterStore'
import { filterChips, withoutChip, withoutChips } from '../domain/filterChips'
import type { FilterState, Period } from '../domain/filterState'
import type { PeriodPreset } from '../domain/periodPresets'
import PeriodBar from './PeriodBar.vue'

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

const labels = computed(() => counterpartyLabels(props.workbook.transactions))
const chips = computed(() => filterChips(filters.value, (key) => labels.value.get(key) ?? key))

const period = computed({
  get: () => props.shownPeriod ?? filters.value.period,
  set: (next: Period) => void setFilters({ ...filters.value, period: next }),
})

const accounts = computed({
  get: () => filters.value.accounts,
  set: (next: readonly string[]) => void setFilters({ ...filters.value, accounts: next }),
})
</script>

<template>
  <PeriodBar
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
