<script setup lang="ts">
import { computed, inject, useTemplateRef } from 'vue'

import { useStickyBandPart } from '../../../../shared/layout/stickyBand'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import FilterChipRow from '../../../../shared/ui/FilterChipRow.vue'
import FiltersSheet from '../../../../shared/ui/FiltersSheet.vue'
import { PAGE_TAB_ACTIONS } from '../../../../shared/ui/PageTabs.vue'

import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import CutText from '../../../../shared/ui/CutText.vue'
import { useSettings } from '../../settings/application/useSettings'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { isDefinedBucket } from '../../workbook/domain/bucket'
import { counterpartyLabels } from '../../workbook/domain/counterpartyIdentity'
import type { Workbook } from '../../workbook/domain/workbook'
import { useFilters } from '../application/filterStore'
import { addedChoices, filterChips, withAddedChoices, withoutChip, withoutChips } from './filterChips'
import type { FilterState, Period } from '../domain/filterState'
import { periodInWords } from '../../../../shared/calendar/periodInWords'
import type { PeriodPreset } from '../../../../shared/calendar/periodPresets'
import AccountPicker from './AccountPicker.vue'
import AddFilterMenu from './AddFilterMenu.vue'
import PeriodBar from '../../../../shared/ui/PeriodBar.vue'
import { words } from './words'

const props = withDefaults(
  defineProps<{
    workbook: Workbook
    window: LedgerWindow
    presets?: readonly PeriodPreset[]
    /** The period the screen shows, when it reads the shared one differently, as Analysis, Compare does. */
    shownPeriod?: Period
    showPeriod?: boolean
  }>(),
  { showPeriod: true },
)

const { filters: shared, setFilters } = useFilters()
const names = useDisplayNames()
const filters = computed(() => shared.value as FilterState)

const accountOptions = computed(() => props.workbook.accounts.map((account) => ({ value: account.slug, label: names.value.account(account.slug) })))

const settings = useSettings()
const labels = computed(() => counterpartyLabels(props.workbook.transactions))
const chips = computed(() =>
  filterChips(filters.value, {
    counterparty: (key) => labels.value.get(key) ?? key,
    bucket: (bucket) => (isDefinedBucket(bucket) ? settings.value.bucketLabels[bucket] : bucket),
    category: names.value.category,
    label: (id) => props.workbook.labels.find((label) => label.id === id)?.name ?? words.chips.deletedLabel,
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
/** Inside a page's tabs the Filters button sits on the tab row, so a phone's row with no period to show stays hidden. */
const tabActions = inject(PAGE_TAB_ACTIONS, null)
useStickyBandPart(useTemplateRef<HTMLElement>('bar'))

/** Narrowings beyond the period: the accounts, counted once, and every chip. */
const activeCount = computed(() => chips.value.length + (accounts.value.length > 0 ? 1 : 0))

const choices = computed({
  get: () => addedChoices(filters.value),
  set: (chipIds: string[]) => void setFilters(withAddedChoices(filters.value, chipIds)),
})

const removeChip = (chipId: string): void => void setFilters(withoutChip(filters.value, chipId))
const clearChips = (): void => void setFilters(withoutChips(filters.value))
</script>

<template>
  <div v-if="phone" class="flex items-center gap-3" :class="{ hidden: tabActions !== null && !showPeriod }">
    <FiltersSheet :active-count="activeCount" :show-label="words.showResults">
      <div class="flex flex-col gap-4">
        <PeriodBar v-if="showPeriod" v-model:period="period" :window="window" stacked v-bind="presets === undefined ? {} : { presets }" />
        <AccountPicker v-model="accounts" :options="accountOptions" class="w-full" />
        <AddFilterMenu v-model="choices" :workbook="workbook" />
        <FilterChipRow v-if="chips.length" :chips="chips" @remove="removeChip" @clear="clearChips" />
      </div>
    </FiltersSheet>
    <CutText v-if="showPeriod" as="p" class="figure min-w-0 type-aside" data-testid="period-range">{{ periodInWords(period, window) }}</CutText>
  </div>
  <div v-else ref="bar" class="filter-bar" data-testid="filter-bar">
    <PeriodBar v-if="showPeriod" v-model:period="period" :window="window" v-bind="presets === undefined ? {} : { presets }" />
    <div class="flex min-w-0 items-center gap-2">
      <AccountPicker v-model="accounts" :options="accountOptions" class="shrink-0" />
      <AddFilterMenu v-model="choices" :workbook="workbook" />
      <FilterChipRow :chips="chips" one-line @remove="removeChip" @clear="clearChips" />
    </div>
  </div>
</template>

<style scoped>
/*
 * The bar stays in reach while the screen scrolls: under the top bar, or at the very top beside
 * the sidebar. Its height never depends on the chips, so nothing below jumps.
 */
.filter-bar {
  position: sticky;
  top: var(--top-bar-height);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-inline: -0.5rem;
  padding: 0.5rem;
  background: color-mix(in srgb, var(--surface-page) 92%, transparent);
  backdrop-filter: blur(10px);
}
</style>
