<script setup lang="ts">
import { computed } from 'vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import type { EntryFilters } from './useEntryFilters'
import { words } from './words'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import FilterChipRow from '../../../../shared/ui/FilterChipRow.vue'
import FiltersSheet from '../../../../shared/ui/FiltersSheet.vue'
import RemovableChip from '../../../../shared/ui/RemovableChip.vue'
import { words as uiWords } from '../../../../shared/ui/words'

/**
 * Entries' month, account, category, label and event selects, in a row from 640 px, and the payee the Payees tab picked as a
 * chip. On a phone they sit in a sheet behind a Filters button in the tab row, and the filters picked show as chips over the list
 * in one line, with Clear. The default slot holds the list's own action, such as Select.
 */
const props = defineProps<{
  filters: EntryFilters
}>()

defineSlots<{ default?: () => unknown }>()

const phone = usePhoneLayout()
const chips = computed(() => props.filters.active.map((filter) => ({ id: filter.key, label: filter.label })))
/** The payee filter has no select, so from 640 px it shows as a chip beside the selects. */
const payeeFilter = computed(() => props.filters.active.find((filter) => filter.key === 'payee'))

function remove(key: string): void {
  props.filters.active.find((filter) => filter.key === key)?.remove()
}
</script>

<template>
  <div v-if="phone" class="flex items-center gap-2" data-testid="spending-filter-chips">
    <FiltersSheet :active-count="filters.active.length" :show-label="words.filters.show">
      <div class="flex flex-col gap-3" data-testid="spending-filter-sheet">
        <USelect
          :model-value="filters.month"
          :items="filters.monthItems"
          :aria-label="words.filters.month"
          class="w-full"
          data-testid="spending-filter-month"
          @update:model-value="filters.pickMonth"
        />
        <USelect
          :model-value="filters.account"
          :items="filters.accountItems"
          :aria-label="words.filters.account"
          class="w-full"
          data-testid="spending-filter-account"
          @update:model-value="filters.pickAccount"
        />
        <USelectMenu
          :model-value="filters.category"
          :items="filters.categoryItems"
          value-key="value"
          :filter-fields="['label', 'description']"
          :aria-label="words.filters.category"
          class="w-full"
          data-testid="spending-filter-category"
          @update:model-value="filters.pickCategory"
        />
        <USelect
          v-if="filters.labels.length > 0"
          :model-value="filters.label"
          :items="filters.labelItems"
          :aria-label="words.filters.label"
          class="w-full"
          data-testid="spending-filter-label"
          @update:model-value="filters.pickLabel"
        />
        <USelect
          v-if="filters.events.length > 0"
          :model-value="filters.event"
          :items="filters.eventItems"
          :aria-label="words.filters.event"
          class="w-full"
          data-testid="spending-filter-event"
          @update:model-value="filters.pickEvent"
        />
      </div>
    </FiltersSheet>
    <FilterChipRow :chips="chips" one-line @remove="remove" @clear="filters.clear()" />
    <slot />
  </div>
  <div v-else class="flex flex-wrap items-center gap-2">
    <USelect
      :model-value="filters.month"
      :items="filters.monthItems"
      size="sm"
      :aria-label="words.filters.month"
      :class="filters.span === null ? 'w-44' : 'max-w-full min-w-0 sm:min-w-44'"
      data-testid="spending-filter-month"
      @update:model-value="filters.pickMonth"
    />
    <USelect
      :model-value="filters.account"
      :items="filters.accountItems"
      size="sm"
      :aria-label="words.filters.account"
      class="w-44"
      data-testid="spending-filter-account"
      @update:model-value="filters.pickAccount"
    />
    <USelectMenu
      :model-value="filters.category"
      :items="filters.categoryItems"
      value-key="value"
      :filter-fields="['label', 'description']"
      size="sm"
      :aria-label="words.filters.category"
      class="w-52"
      data-testid="spending-filter-category"
      @update:model-value="filters.pickCategory"
    />
    <USelect
      v-if="filters.labels.length > 0"
      :model-value="filters.label"
      :items="filters.labelItems"
      size="sm"
      :aria-label="words.filters.label"
      class="w-44"
      data-testid="spending-filter-label"
      @update:model-value="filters.pickLabel"
    />
    <USelect
      v-if="filters.events.length > 0"
      :model-value="filters.event"
      :items="filters.eventItems"
      size="sm"
      :aria-label="words.filters.event"
      class="w-44"
      data-testid="spending-filter-event"
      @update:model-value="filters.pickEvent"
    />
    <RemovableChip
      v-if="payeeFilter !== undefined"
      :label="payeeFilter.label"
      :remove-label="uiWords.chips.remove(payeeFilter.label)"
      data-testid="spending-filter-payee"
      @remove="payeeFilter.remove()"
    />
    <slot />
  </div>
</template>
