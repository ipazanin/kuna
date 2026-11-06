<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import EmptyState from '../../../../shared/ui/EmptyState.vue'
import { confirmHistoryComplete } from './useTaxShown'
import { words } from './words'

/** Stands in for a tax figure that reads past buys, until someone says the history is complete. */
</script>

<template>
  <EmptyState icon="i-lucide-landmark" :title="words.history.title" :description="words.history.description" data-testid="tax-history">
    <template #actions>
      <UButton :label="words.history.confirm" icon="i-lucide-check" data-testid="tax-history-confirm" @click="confirmHistoryComplete" />
    </template>
  </EmptyState>
</template>
