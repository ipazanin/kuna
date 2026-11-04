<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { useHouseIndex } from '../../houseIndex/presentation/useHouseIndex'
import { assetLoans } from '../../loans/application/assetLoans'
import { assetNamed, ASSETS_OVERVIEW_ROUTE } from '../../overview/presentation/assetLinks'
import { carriedByIndex } from '../../values/domain/assetValue'
import { assetsOnDay } from '../../values/presentation/assetsOnDay'
import { valueCaption } from '../../values/presentation/valueCaption'
import { words as valueWords } from '../../values/presentation/words'
import { useAssetsBooks } from '../../workbook/application/assetsStore'
import type { Valuation } from '../../workbook/domain/valuation'
import AssetDialog from './AssetDialog.vue'
import ValuationDialog from './ValuationDialog.vue'
import { words } from './words'
import { today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** One asset: what it is worth today and how that was reached, the bank loan on it with what you owe and what is yours after it, and its valuations newest first. */
const { state } = useAssetsBooks()
const index = useHouseIndex()
const route = useRoute()
const day = today()

const entry = computed(() => (state.workbook === null ? null : assetNamed(state.workbook, route.query.asset)))
const shown = computed(() => (entry.value === null ? null : (assetsOnDay({ assets: [entry.value] }, day, index.value, assetLoans(day))[0] ?? null)))
const waiting = computed(() => entry.value !== null && index.value === 'loading' && carriedByIndex(entry.value.asset))

const valueText = computed(() => (shown.value?.value == null ? valueWords.noValue : formatMoney(shown.value.value.cents)))

/** Why the loan's figures are not shown yet or at all, or why the value is the one typed or paid. */
const lines = computed(() => {
  if (shown.value === null) return []
  const { link, equity, asset } = shown.value
  const loanLine = { none: null, shared: words.loan.shared, opening: words.loan.opening, failed: words.loan.failed, gone: words.loan.gone, linked: equity.owed === null ? words.loan.noPlan : null }[
    link.kind
  ]
  return [...(loanLine === null ? [] : [loanLine]), ...(index.value === 'failed' && carriedByIndex(asset) ? [valueWords.indexFailed] : [])]
})

/** What counts while the asset has no valuation: the price paid, carried by the index or estimated by the customs table, or nothing. */
const noValuation = computed(() => {
  const kind = shown.value?.value?.basis.kind ?? null
  if (kind === null) return words.valuations.none.nothing
  if (kind === 'house-index' || kind === 'index-not-out') return words.valuations.none.index
  return kind === 'customs' ? words.valuations.none.customs : words.valuations.none.price
})

const facts = computed((): Fact[] => {
  const asset = entry.value?.asset ?? null
  if (asset === null) return []
  return [
    ...(asset.bought === null ? [] : [{ label: words.facts.bought, value: dayLabel(asset.bought) }]),
    ...(asset.price === null ? [] : [{ label: words.facts.price, value: formatMoney(asset.price) }]),
    ...(asset.region === null ? [] : [{ label: words.facts.region, value: valueWords.regions[asset.region] }]),
    ...(asset.firstRegistration === null ? [] : [{ label: words.facts.firstRegistration, value: dayLabel(asset.firstRegistration) }]),
  ]
})

const newestFirst = computed(() => [...(entry.value?.valuations ?? [])].reverse())

const editing = ref(false)
const valuationOpen = ref(false)
const editingValuation = ref<Valuation | null>(null)

function openValuation(valuation: Valuation | null): void {
  editingValuation.value = valuation
  valuationOpen.value = true
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <UButton :to="ASSETS_OVERVIEW_ROUTE" :label="words.allAssets" icon="i-lucide-arrow-left" color="neutral" variant="link" class="-mb-4 self-start px-0" data-testid="back-to-assets" />
    <template v-if="entry !== null && shown !== null">
      <PageHeader :title="entry.asset.name" :description="[valueWords.kinds[entry.asset.kind], entry.asset.note].filter((part) => part !== '').join('. ')">
        <template #actions>
          <UButton :label="words.edit" icon="i-lucide-pencil" color="neutral" variant="outline" data-testid="asset-edit" @click="editing = true" />
          <UButton :label="words.addValuation" icon="i-lucide-plus" data-testid="valuation-add" @click="openValuation(null)" />
        </template>
      </PageHeader>
      <DashboardGrid layout="tiles" data-testid="asset-tiles">
        <KpiTile
          :label="words.tiles.value"
          :value="valueText"
          :caption="waiting || shown.value === null ? '' : valueCaption(shown.value)"
          :definition="shown.value?.basis.kind === 'house-index' ? valueWords.indexDefinition : ''"
          :to="null"
          data-testid="asset-value"
        >
          <template v-if="waiting" #value>
            <span class="block type-body font-normal" data-testid="asset-value-waiting">{{ valueWords.waitingForIndex }}</span>
          </template>
        </KpiTile>
        <template v-if="shown.link.kind === 'linked' && shown.equity.owed !== null">
          <KpiTile :label="words.tiles.owedOn(shown.link.loan.name)" :value="formatMoney(shown.equity.owed)" :to="shown.link.loan.to" data-testid="asset-owed" />
          <KpiTile v-if="shown.equity.yours !== null" :label="words.tiles.yours" :value="formatMoney(shown.equity.yours)" :to="null" data-testid="asset-yours" />
        </template>
      </DashboardGrid>
      <div v-if="lines.length > 0" class="flex flex-col gap-1" data-testid="asset-notes">
        <p v-for="line in lines" :key="line" class="type-caption">{{ line }}</p>
      </div>
      <DashboardGrid layout="pair">
        <AppCard v-if="facts.length > 0" as="article" class="p-4 sm:p-5" data-testid="asset-facts">
          <FactGrid :facts="facts" />
        </AppCard>
        <AppCard :title="words.valuations.title" :subtitle="words.valuations.subtitle" data-testid="valuation-list">
          <p v-if="newestFirst.length === 0" class="px-4 pb-4 text-sm text-muted sm:px-5">{{ noValuation }}</p>
          <ul v-else class="flex flex-col pb-2">
            <li v-for="valuation in newestFirst" :key="valuation.id" class="flex items-center gap-3 border-t border-default px-4 py-2 first:border-t-0 sm:px-5" data-testid="valuation-line">
              <div class="min-w-0 flex-1">
                <MoneyText :cents="valuation.value" class="text-sm text-highlighted" />
                <p class="text-xs text-muted">{{ [dayLabel(valuation.date), valuation.note].filter((part) => part !== '').join(', ') }}</p>
              </div>
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="words.valuations.change(dayLabel(valuation.date))"
                data-testid="valuation-edit"
                @click="openValuation(valuation)"
              />
            </li>
          </ul>
        </AppCard>
      </DashboardGrid>
      <AssetDialog v-model:open="editing" :entry="entry" />
      <ValuationDialog v-model:open="valuationOpen" :entry="entry" :editing="editingValuation" :today="day" />
    </template>
    <ScreenSkeleton v-else-if="state.workbook === null && state.status !== 'error'" />
    <template v-else-if="state.workbook !== null">
      <PageHeader :title="words.asset" />
      <AppCard>
        <p class="px-4 py-6 text-sm text-muted sm:px-5" data-testid="asset-missing">{{ words.missing }}</p>
      </AppCard>
    </template>
  </section>
</template>
