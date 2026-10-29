<script setup lang="ts">
import { ref } from 'vue'

import { civilDate } from '../../../shared/calendar/civilDate'
import { anchorWindow } from '../../../shared/calendar/ledgerWindow'
import type { FilterChip } from '../filters/domain/filterChips'
import type { Period } from '../filters/domain/filterState'
import AccountPicker from '../filters/presentation/AccountPicker.vue'
import FilterChipRow from '../filters/presentation/FilterChipRow.vue'
import PeriodBar from '../filters/presentation/PeriodBar.vue'

/** The company's own specimens in the gallery: the period bar, the account picker and the filter chips. Only development and fake builds load it. */
const sampleWindow = anchorWindow(civilDate(2024, 3, 1), civilDate(2026, 10, 14))
const period = ref<Period>({ preset: 'l12' })
const accounts = ref<readonly string[]>([])
const ACCOUNTS = [
  { value: 'main', label: 'Main account' },
  { value: 'card', label: 'Card account' },
  { value: 'savings', label: 'Savings' },
]
const chips = ref<FilterChip[]>([
  { id: 'bucket', label: 'Bucket: operating' },
  { id: 'category', label: 'Category: software-subscriptions' },
  { id: 'counterparty', label: 'Counterparty: Cloud hosting' },
])
function removeChip(id: string): void {
  chips.value = chips.value.filter((chip) => chip.id !== id)
}
</script>

<template>
  <div class="flex flex-col gap-4" data-dev-only="DEV-GALLERY-ONLY-DO-NOT-SHIP">
    <h3 class="type-label">Period and filters</h3>
    <PeriodBar v-model:period="period" :window="sampleWindow" />
    <AccountPicker v-model="accounts" :options="ACCOUNTS" class="w-fit" />
    <FilterChipRow :chips="chips" one-line @remove="removeChip" @clear="chips = []" />
    <p class="figure type-caption" aria-live="polite">Selected: {{ JSON.stringify(period) }}, {{ accounts.length ? accounts.join(' and ') : 'all accounts' }}</p>
  </div>
</template>
