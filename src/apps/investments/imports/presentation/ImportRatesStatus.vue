<script setup lang="ts">
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { WorkbookImport } from './useWorkbookImport'
import { words } from './words'
import PricesProgress from '../../prices/presentation/PricesProgress.vue'
import { dayLabel } from '../../../../shared/calendar/dayLabel'

/** The ECB rates the rows need, while Kuna fetches them or once it could not. Nothing goes on until they are there. */
const props = defineProps<{
  workbookImport: WorkbookImport
}>()

const { ratesFetch, fetching } = props.workbookImport
</script>

<template>
  <div v-if="ratesFetch?.kind === 'fetching'" class="flex flex-col gap-2" data-testid="import-rates-fetching">
    <p class="type-body">{{ words.file.fetchingRates }}</p>
    <PricesProgress v-if="fetching" :fetching="fetching" />
  </div>
  <template v-if="ratesFetch?.kind === 'failed'">
    <UAlert
      icon="i-lucide-triangle-alert"
      color="error"
      variant="subtle"
      :title="words.file.ratesFailed(ratesFetch.currencies.join(', '), dayLabel(ratesFetch.from))"
      data-testid="import-rates-failed"
    />
    <UButton :label="words.file.tryAgain" icon="i-lucide-refresh-cw" color="neutral" variant="outline" class="self-start" data-testid="import-rates-retry" @click="workbookImport.fetchRates()" />
  </template>
</template>
