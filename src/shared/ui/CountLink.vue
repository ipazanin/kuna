<script setup lang="ts">
/** A quiet link that counts what stands behind a row, such as the rules that file under a category, and opens only those. Nothing while the count is zero. */
import type { RouteLocationRaw } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

defineProps<{
  count: number
  /** The count in words, such as 3 rules. */
  label: string
  /** The link's name for a screen reader, which holds the row's name, such as 3 rules for Fuel. */
  linkLabel: string
  to: RouteLocationRaw
  testId: string
}>()
</script>

<template>
  <UButton v-if="count > 0" :to="to" :label="label" :aria-label="linkLabel" color="neutral" variant="link" size="xs" class="p-0 font-normal" :data-testid="testId" />
</template>
