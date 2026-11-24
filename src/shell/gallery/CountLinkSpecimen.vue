<script setup lang="ts">
import AppCard from '../../shared/ui/AppCard.vue'
import CountLink from '../../shared/ui/CountLink.vue'

const ROWS = [
  { name: 'Fuel', count: 3 },
  { name: 'Groceries', count: 1 },
  { name: 'Eating out', count: 0 },
]
</script>

<template>
  <AppCard title="CountLink" subtitle="Counts what stands behind a row, such as the rules that file under a category, and opens only those. A row with none shows nothing.">
    <ul class="flex flex-col px-4 pt-1 pb-3 sm:px-5" data-testid="gallery-count-link">
      <li v-for="row in ROWS" :key="row.name" class="flex flex-col gap-0.5 border-b border-default py-2 last:border-b-0">
        <span class="break-words type-row-title">{{ row.name }}</span>
        <CountLink
          :count="row.count"
          :label="row.count === 1 ? '1 rule' : `${row.count} rules`"
          :link-label="`${row.count === 1 ? '1 rule' : `${row.count} rules`} for ${row.name}`"
          :to="{ hash: '#count-link' }"
          test-id="gallery-count-link-open"
          class="self-start"
        />
      </li>
    </ul>
  </AppCard>
</template>
