<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { assetLink } from './assetLinks'
import { words } from './words'
import type { AssetOnDay } from '../../values/presentation/assetsOnDay'
import { valueCaption } from '../../values/presentation/valueCaption'
import { words as valueWords } from '../../values/presentation/words'
import type { AssetKind } from '../../workbook/domain/asset'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** An asset on the Overview: its name, what it is worth today and how that was reached, and what is yours after its loan, opening the asset's page. */
const props = defineProps<{
  entry: AssetOnDay
  /** The house price index is still loading for this asset. */
  waiting: boolean
}>()

const KIND_ICONS: Readonly<Record<AssetKind, string>> = { home: 'i-lucide-house', car: 'i-lucide-car', other: 'i-lucide-package' }

const asset = computed(() => props.entry.asset)
const facts = computed((): Fact[] => {
  const { link, equity } = props.entry
  return link.kind === 'linked' && equity.yours !== null ? [{ label: words.card.yours, value: formatMoney(equity.yours), caption: link.loan.name }] : []
})
</script>

<template>
  <RouterLink :to="assetLink(asset)" class="group block h-full rounded-card" data-testid="asset-card">
    <AppCard as="article" class="h-full gap-4 p-4 transition-colors group-hover:border-accented sm:p-5">
      <div class="flex items-start gap-3">
        <span class="grid size-8 shrink-0 place-items-center rounded-control bg-elevated text-primary" aria-hidden="true"><UIcon :name="KIND_ICONS[asset.kind]" class="size-4" /></span>
        <div class="min-w-0 flex-1">
          <h2 class="type-card-title">{{ asset.name }}</h2>
          <p class="type-caption">{{ valueWords.kinds[asset.kind] }}</p>
        </div>
      </div>
      <div>
        <p v-if="waiting" class="type-body text-muted">{{ valueWords.waitingForIndex }}</p>
        <template v-else-if="entry.value !== null">
          <MoneyText :cents="entry.value.cents" class="block text-figure-lg font-semibold text-highlighted" data-testid="asset-card-value" />
          <p class="type-caption">{{ valueCaption(entry.value) }}</p>
        </template>
        <template v-else>
          <p class="type-body font-medium text-highlighted">{{ valueWords.noValue }}</p>
          <p class="type-caption">{{ words.card.addValuation }}</p>
        </template>
      </div>
      <FactGrid v-if="facts.length > 0" :facts="facts" class="mt-auto border-t border-default pt-4" />
    </AppCard>
  </RouterLink>
</template>
