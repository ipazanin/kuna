<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { HoldingFigures } from '../domain/holding'
import { priceMarkOf } from './holdingText'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** Says when a holding's price is late, entered by hand or at an earlier close than today's quotes, with its icon. Bare, it shows the icon alone and keeps the words for a screen reader. */
const props = withDefaults(
  defineProps<{
    holding: HoldingFigures
    bare?: boolean
    /** The day Fetch today's quotes are of, so a holding still at an earlier close says which. */
    quotedDay?: CivilDate | null
  }>(),
  { bare: false, quotedDay: null },
)

const mark = computed(() => priceMarkOf(props.holding, props.quotedDay))
</script>

<template>
  <span v-if="mark !== null" class="inline-flex items-center gap-1" :class="{ 'text-warning': mark.late }" data-testid="price-mark">
    <UIcon :name="mark.icon" class="size-3.5 shrink-0" aria-hidden="true" />
    <span :class="{ 'sr-only': bare }">{{ mark.text }}</span>
  </span>
</template>
