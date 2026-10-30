<script setup lang="ts">
import { computed } from 'vue'

import type { PricesFetching } from '../application/pricesUpdate'
import ProgressMeter from '../../../../shared/ui/ProgressMeter.vue'
import { words } from './words'

/** A fetch under way: how many series it has asked for of how many, or only that it runs until it knows the count. */
const props = defineProps<{ fetching: PricesFetching }>()

const line = computed(() => (props.fetching.of === null || props.fetching.of === 0 ? words.fetching : words.fetchingCount(props.fetching.asked, props.fetching.of)))
const parts = computed(() =>
  props.fetching.of === null || props.fetching.of === 0
    ? []
    : [
        { value: props.fetching.asked, colour: 'var(--accent)' },
        { value: props.fetching.of - props.fetching.asked, colour: 'var(--chart-ghost)' },
      ],
)
</script>

<template>
  <div class="flex flex-col gap-2" role="status" data-testid="prices-fetching">
    <p class="type-body">{{ line }}</p>
    <ProgressMeter v-if="parts.length > 0" :parts="parts" :label="line" />
  </div>
</template>
