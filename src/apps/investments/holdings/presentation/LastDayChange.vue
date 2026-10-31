<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { DayChange } from '../domain/holding'
import { words } from './words'
import { formatPercentChange } from '../../../../shared/money/moneyFormat'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** A last day's change as its share with an arrow, so colour is never the only cue, and its euros under it. */
const props = defineProps<{
  change: DayChange
}>()

const direction = computed(() => (props.change.change > 0 ? 'up' : props.change.change < 0 ? 'down' : null))
</script>

<template>
  <span class="inline-flex items-center gap-0.5 font-medium" :class="direction === 'up' ? 'text-success' : direction === 'down' ? 'text-error' : 'text-toned'">
    <UIcon v-if="direction !== null" :name="direction === 'up' ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-down-right'" class="size-3.5" aria-hidden="true" />
    <span class="figure">{{ change.share === null ? '' : formatPercentChange(change.share) }}</span>
    <span v-if="direction !== null" class="sr-only">{{ direction === 'up' ? words.up : words.down }}</span>
  </span>
  <MoneyText :cents="change.change" sign="always" class="block type-caption" />
</template>
