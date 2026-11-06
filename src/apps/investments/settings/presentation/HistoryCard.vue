<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import { forgetHistoryComplete, useTaxShown } from '../../tax/presentation/useTaxShown'
import AppCard from '../../../../shared/ui/AppCard.vue'
import { words } from './words'

/** Takes back the answer that the file's history is complete, which only this device keeps. Without the answer, the Tax screen is where it is given. */
const taxShown = useTaxShown()
</script>

<template>
  <AppCard v-if="taxShown" :title="words.history.title" :subtitle="words.history.subtitle" data-testid="investments-history">
    <div class="px-4 pt-1 pb-4 sm:px-5">
      <UButton :label="words.history.notComplete" color="neutral" variant="outline" data-testid="history-not-complete" @click="forgetHistoryComplete" />
    </div>
  </AppCard>
</template>
