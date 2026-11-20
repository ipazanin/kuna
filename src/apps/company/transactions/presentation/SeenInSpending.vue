<script setup lang="ts">
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import { words } from './words'

/** The muted line under a row that a row of your own statements in Spending links to. It is no link, since the link names no page there. */
withDefaults(defineProps<{ as?: 'p' | 'span' }>(), { as: 'p' })
</script>

<template>
  <NoteLine :as="as" tone="muted" icon="i-lucide-link" data-testid="company-row-seen-in-spending">{{ words.seenInSpending }}</NoteLine>
</template>
