<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USlideover from '@nuxt/ui/components/Slideover.vue'

import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { BUCKETS } from '../../workbook/domain/bucket'
import { NO_FILTERS, filtersInUse } from '../domain/categoryListing'
import type { CategoryFilters } from '../domain/categoryListing'
import { plural } from '../../../../shared/text/translation'
import { words } from './words'

/** The search and quick filters of the categories table. A phone keeps the search in view and the rest in a sheet. */
const props = defineProps<{
  /** The roles core and the pack pick categories by. */
  roles: readonly string[]
  /** Whether the owner share shows, so it can be filtered on. */
  shares: boolean
  shown: number
  total: number
  /** How many of the rows shown hold an unsaved change or an error the filters would hide. */
  kept: number
}>()

const filters = defineModel<CategoryFilters>({ required: true })

// A select item cannot carry an empty value, so every bucket and any role travel as this.
const ANY = '*'

const bucketItems = [{ value: ANY, label: words.categories.everyBucket }, ...BUCKETS.map((bucket) => ({ value: bucket, label: words.categories.bucketChoice(bucket) }))]
const roleItems = computed(() => [{ value: ANY, label: words.categories.anyRole }, ...props.roles.map((role) => ({ value: role, label: role, ui: { itemLabel: 'identifier' } }))])

const bucket = computed({
  get: () => filters.value.bucket ?? ANY,
  set: (chosen: string) => {
    filters.value = { ...filters.value, bucket: chosen === ANY ? null : chosen }
  },
})

const role = computed({
  get: () => filters.value.role ?? ANY,
  set: (chosen: string) => {
    filters.value = { ...filters.value, role: chosen === ANY ? null : chosen }
  },
})

/** A role shows by the name the tab stores, as in its menu. */
const roleUi = computed(() => ({ value: role.value === ANY ? '' : 'identifier' }))

function set<Field extends keyof CategoryFilters>(field: Field, chosen: CategoryFilters[Field]): void {
  filters.value = { ...filters.value, [field]: chosen }
}

const narrowed = computed(() => filtersInUse(filters.value))

/** The filters in the sheet that are on, which its button counts. */
const sheetCount = computed(() => [filters.value.bucket !== null, filters.value.role !== null, filters.value.withOwnerShare, filters.value.unsavedOnly].filter(Boolean).length)

const count = computed(() => (narrowed.value ? words.categories.shownOf(props.shown, props.total) : plural(words.categories.count(props.total), props.total)))

const phone = usePhoneLayout()
const sheetOpen = ref(false)
</script>

<template>
  <div role="search" :aria-label="words.categories.find" class="flex flex-col gap-2 px-4 pt-3 sm:px-5" data-testid="category-filters">
    <div class="flex flex-wrap items-center gap-2">
      <UInput
        :model-value="filters.search"
        icon="i-lucide-search"
        enterkeyhint="search"
        :placeholder="phone ? words.categories.searchShort : words.categories.searchLong"
        :aria-label="words.categories.searchLabel"
        size="sm"
        class="min-w-0 flex-1 sm:w-72 sm:flex-none"
        data-testid="category-search"
        @update:model-value="set('search', String($event))"
      >
        <template v-if="filters.search" #trailing>
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="words.categories.clearSearch" @click="set('search', '')" />
        </template>
      </UInput>
      <USlideover v-if="phone" v-model:open="sheetOpen" side="bottom" :title="words.categories.sheetTitle" :ui="{ content: 'phone-sheet' }">
        <UButton icon="i-lucide-sliders-horizontal" color="neutral" variant="outline" size="sm" data-testid="open-category-filters">
          <span>{{ words.categories.filters }}</span>
          <UBadge v-if="sheetCount > 0" :label="String(sheetCount)" size="sm" class="rounded-full" />
          <span class="sr-only">{{ words.categories.on(sheetCount) }}</span>
        </UButton>
        <template #body>
          <div class="flex flex-col gap-4">
            <USelect v-model="bucket" :items="bucketItems" :aria-label="words.categories.byBucket" class="w-full" data-testid="category-bucket-filter" />
            <USelect v-model="role" :items="roleItems" :ui="roleUi" :aria-label="words.categories.byRole" class="w-full" data-testid="category-role-filter" />
            <UCheckbox v-if="shares" :model-value="filters.withOwnerShare" :label="words.categories.withShare" @update:model-value="set('withOwnerShare', $event === true)" />
            <UCheckbox :model-value="filters.unsavedOnly" :label="words.categories.unsaved" data-testid="category-unsaved-filter" @update:model-value="set('unsavedOnly', $event === true)" />
          </div>
        </template>
        <template #footer>
          <UButton :label="words.categories.show" block size="lg" @click="sheetOpen = false" />
        </template>
      </USlideover>
      <template v-else>
        <USelect v-model="bucket" :items="bucketItems" :aria-label="words.categories.byBucket" size="sm" class="w-40" data-testid="category-bucket-filter" />
        <USelect v-model="role" :items="roleItems" :ui="roleUi" :aria-label="words.categories.byRole" size="sm" class="w-52" data-testid="category-role-filter" />
        <UCheckbox v-if="shares" :model-value="filters.withOwnerShare" :label="words.categories.withShare" size="sm" @update:model-value="set('withOwnerShare', $event === true)" />
        <UCheckbox :model-value="filters.unsavedOnly" :label="words.categories.unsaved" size="sm" data-testid="category-unsaved-filter" @update:model-value="set('unsavedOnly', $event === true)" />
      </template>
    </div>
    <p class="flex flex-wrap items-center gap-x-3 text-xs text-muted">
      <span class="figure" aria-live="polite" data-testid="category-count">{{ count }}</span>
      <span v-if="kept > 0" data-testid="category-kept">{{ plural(words.categories.kept(kept), kept) }}</span>
      <UButton
        v-if="narrowed"
        :label="words.categories.clearFilters"
        color="neutral"
        variant="link"
        size="xs"
        class="inline-target px-0"
        data-testid="clear-category-filters"
        @click="filters = NO_FILTERS"
      />
    </p>
  </div>
</template>
