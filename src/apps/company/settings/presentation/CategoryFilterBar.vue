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

const bucketItems = [{ value: ANY, label: 'Every bucket' }, ...BUCKETS.map((bucket) => ({ value: bucket, label: bucket }))]
const roleItems = computed(() => [{ value: ANY, label: 'Any role' }, ...props.roles.map((role) => ({ value: role, label: role }))])

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

function set<Field extends keyof CategoryFilters>(field: Field, chosen: CategoryFilters[Field]): void {
  filters.value = { ...filters.value, [field]: chosen }
}

const narrowed = computed(() => filtersInUse(filters.value))

/** The filters in the sheet that are on, which its button counts. */
const sheetCount = computed(() => [filters.value.bucket !== null, filters.value.role !== null, filters.value.withOwnerShare, filters.value.unsavedOnly].filter(Boolean).length)

const count = computed(() => (narrowed.value ? `${props.shown} of ${props.total} categories` : `${props.total} ${props.total === 1 ? 'category' : 'categories'}`))

const phone = usePhoneLayout()
const sheetOpen = ref(false)
</script>

<template>
  <div role="search" aria-label="Find a category" class="flex flex-col gap-2 px-4 pt-3 sm:px-5" data-testid="category-filters">
    <div class="flex flex-wrap items-center gap-2">
      <UInput
        :model-value="filters.search"
        icon="i-lucide-search"
        enterkeyhint="search"
        :placeholder="phone ? 'Search categories' : 'Search by name, family, bucket or role'"
        aria-label="Search the categories"
        size="sm"
        class="min-w-0 flex-1 sm:w-72 sm:flex-none"
        data-testid="category-search"
        @update:model-value="set('search', String($event))"
      >
        <template v-if="filters.search" #trailing>
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="Clear the search" @click="set('search', '')" />
        </template>
      </UInput>
      <USlideover v-if="phone" v-model:open="sheetOpen" side="bottom" title="Filter the categories" :ui="{ content: 'phone-sheet' }">
        <UButton icon="i-lucide-sliders-horizontal" color="neutral" variant="outline" size="sm" data-testid="open-category-filters">
          <span>Filters</span>
          <UBadge v-if="sheetCount > 0" :label="String(sheetCount)" size="sm" class="rounded-full" />
          <span class="sr-only">, {{ sheetCount }} on</span>
        </UButton>
        <template #body>
          <div class="flex flex-col gap-4">
            <USelect v-model="bucket" :items="bucketItems" aria-label="Filter by bucket" class="w-full" data-testid="category-bucket-filter" />
            <USelect v-model="role" :items="roleItems" aria-label="Filter by role" class="w-full" data-testid="category-role-filter" />
            <UCheckbox v-if="shares" :model-value="filters.withOwnerShare" label="Has an owner share" @update:model-value="set('withOwnerShare', $event === true)" />
            <UCheckbox :model-value="filters.unsavedOnly" label="Unsaved changes" data-testid="category-unsaved-filter" @update:model-value="set('unsavedOnly', $event === true)" />
          </div>
        </template>
        <template #footer>
          <UButton label="Show categories" block size="lg" @click="sheetOpen = false" />
        </template>
      </USlideover>
      <template v-else>
        <USelect v-model="bucket" :items="bucketItems" aria-label="Filter by bucket" size="sm" class="w-40" data-testid="category-bucket-filter" />
        <USelect v-model="role" :items="roleItems" aria-label="Filter by role" size="sm" class="w-52" data-testid="category-role-filter" />
        <UCheckbox v-if="shares" :model-value="filters.withOwnerShare" label="Has an owner share" size="sm" @update:model-value="set('withOwnerShare', $event === true)" />
        <UCheckbox :model-value="filters.unsavedOnly" label="Unsaved changes" size="sm" data-testid="category-unsaved-filter" @update:model-value="set('unsavedOnly', $event === true)" />
      </template>
    </div>
    <p class="flex flex-wrap items-center gap-x-3 text-xs text-muted">
      <span class="figure" aria-live="polite" data-testid="category-count">{{ count }}</span>
      <span v-if="kept > 0" data-testid="category-kept">{{ kept }} of them {{ kept === 1 ? 'shows' : 'show' }} only for an unsaved change or an error.</span>
      <UButton v-if="narrowed" label="Clear filters" color="neutral" variant="link" size="xs" class="inline-target px-0" data-testid="clear-category-filters" @click="filters = NO_FILTERS" />
    </p>
  </div>
</template>
