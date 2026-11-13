<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { words } from './words'
import { COMPANY_OIB_PAGE, companyOib } from '../application/companyOib'
import AppCard from '../../../../shared/ui/AppCard.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import type { Tone } from '../../../../shared/ui/toneText'

/** Settings' Receipts tab: the OIB in Company that tells a receipt bought for the company, and the way to Company to set it. */
const shown = computed((): { readonly text: string; readonly tone: Tone | 'muted'; readonly action: string | null } => {
  const company = companyOib()
  if (company === 'opening') return { text: words.settings.opening, tone: 'muted', action: null }
  if (company === 'failed') return { text: words.settings.failed, tone: 'error', action: words.settings.openCompany }
  if (company === null) return { text: words.settings.notSetUp, tone: 'muted', action: words.settings.openCompany }
  if (company.oib === '') return { text: words.settings.noOib, tone: 'warning', action: words.settings.setOib }
  return { text: words.settings.known(company.oib), tone: 'muted', action: words.settings.change }
})
</script>

<template>
  <AppCard :title="words.settings.title" :subtitle="words.settings.subtitle" data-testid="spending-receipts-settings">
    <div class="flex flex-col items-start gap-3 px-4 pt-3 pb-4 sm:px-5">
      <NoteLine size="body" :tone="shown.tone" data-testid="spending-company-oib">{{ shown.text }}</NoteLine>
      <UButton v-if="shown.action !== null" :to="COMPANY_OIB_PAGE" :label="shown.action" icon="i-lucide-building-2" color="neutral" variant="outline" data-testid="spending-company-oib-open" />
    </div>
  </AppCard>
</template>
