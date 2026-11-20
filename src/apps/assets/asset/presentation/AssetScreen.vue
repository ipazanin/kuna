<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { useHouseIndex } from '../../houseIndex/presentation/useHouseIndex'
import { assetLoans } from '../../loans/application/assetLoans'
import { assetNamed, ASSETS_OVERVIEW_ROUTE } from '../../overview/presentation/assetLinks'
import { carriedByIndex } from '../../values/domain/assetValue'
import { assetsOnDay } from '../../values/domain/assetsOnDay'
import { valueCaption } from '../../values/presentation/valueCaption'
import { words as valueWords } from '../../values/presentation/words'
import { useAssetsBooks } from '../../workbook/application/assetsStore'
import type { AssetShare } from '../../workbook/domain/assetShare'
import type { Valuation } from '../../workbook/domain/valuation'
import AssetDialog from './AssetDialog.vue'
import AssetShareDialog from './AssetShareDialog.vue'
import ValuationDialog from './ValuationDialog.vue'
import { words } from './words'
import { today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { percentText } from '../../../../shared/money/percent'
import type { Percent } from '../../../../shared/money/percent'
import { isShared, isWhole } from '../../../../shared/money/yourPart'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChangeListCard from '../../../../shared/ui/ChangeListCard.vue'
import type { ChangeLine } from '../../../../shared/ui/ChangeListCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** One asset: what it is worth today and how that was reached, your part of it, the bank loan on it with what you owe and what is yours after it, its valuations newest first, and your part over time. */
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
  const loanWhole = shown.value.share !== null && link.kind === 'linked' && equity.owed !== null && link.loan.whole === undefined
  return [...(loanLine === null ? [] : [loanLine]), ...(loanWhole ? [words.loan.countsWhole] : []), ...(index.value === 'failed' && carriedByIndex(asset) ? [valueWords.indexFailed] : [])]
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

/** Each valuation, newest first. */
const valuationLines = computed((): ChangeLine[] =>
  [...(entry.value?.valuations ?? [])].reverse().map((valuation) => ({
    key: valuation.id,
    title: formatMoney(valuation.value),
    label: dayLabel(valuation.date),
    detail: [dayLabel(valuation.date), valuation.note].filter((part) => part !== '').join(', '),
  })),
)

/** An asset you own with others at any time, which shows its Your part card. Until then the part is set in the asset dialog. */
const shared = computed(() => entry.value !== null && isShared(entry.value.asset.share, entry.value.shares))

/** The line of the part the asset dialog sets, from the day it was bought. */
const START = 'start'

function partTitle(share: Percent): string {
  return isWhole(share) ? words.shares.all : percentText(share)
}

/** Your part from the day it was bought, which the asset dialog sets, then each dated change, oldest first. */
const shareLines = computed((): ChangeLine[] => {
  if (entry.value === null) return []
  const { asset, shares } = entry.value
  return [
    { key: START, title: asset.share === undefined ? words.shares.all : partTitle(asset.share), detail: words.shares.fromStart(asset.bought === null ? null : dayLabel(asset.bought)) },
    ...shares.map((change) => ({ key: change.id, title: partTitle(change.share), detail: words.shares.from(dayLabel(change.from), change.note) })),
  ]
})

const editing = ref(false)
const valuationOpen = ref(false)
const editingValuation = ref<Valuation | null>(null)

const shareOpen = ref(false)
const editingShare = ref<AssetShare | null>(null)

function openShare(key: string | null): void {
  if (key === START) {
    editing.value = true
    return
  }
  editingShare.value = entry.value?.shares.find((change) => change.id === key) ?? null
  shareOpen.value = true
}

function openValuation(key: string | null): void {
  editingValuation.value = entry.value?.valuations.find((valuation) => valuation.id === key) ?? null
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
        <KpiTile
          v-if="shown.share !== null && shown.equity.value !== null"
          :label="words.tiles.yourPart"
          :value="formatMoney(shown.equity.value)"
          :caption="words.tiles.partOfValue(percentText(shown.share))"
          :to="null"
          data-testid="asset-your-part"
        />
        <template v-if="shown.link.kind === 'linked' && shown.equity.owed !== null">
          <KpiTile
            :label="words.tiles.owedOn(shown.link.loan.name)"
            :value="formatMoney(shown.equity.owed)"
            :caption="shown.link.loan.whole === undefined ? '' : words.tiles.partOfOwed(formatMoney(shown.link.loan.whole))"
            :to="shown.link.loan.to"
            data-testid="asset-owed"
          />
          <KpiTile v-if="shown.equity.yours !== null" :label="words.tiles.yours" :value="formatMoney(shown.equity.yours)" :to="null" data-testid="asset-yours" />
        </template>
      </DashboardGrid>
      <div v-if="lines.length > 0" class="flex flex-col gap-1" data-testid="asset-notes">
        <p v-for="line in lines" :key="line" class="type-caption">{{ line }}</p>
      </div>
      <DashboardGrid :layout="shared ? 'cards' : 'pair'">
        <AppCard v-if="facts.length > 0" as="article" class="p-4 sm:p-5" data-testid="asset-facts">
          <FactGrid :facts="facts" />
        </AppCard>
        <ChangeListCard
          :title="words.valuations.title"
          :subtitle="words.valuations.subtitle"
          :lines="valuationLines"
          :empty="noValuation"
          :can-add="false"
          collapse-id="assets.valuations"
          data-testid="valuation-list"
          @change="openValuation"
        />
        <ChangeListCard
          v-if="shared"
          :title="words.shares.title"
          :subtitle="words.shares.subtitle"
          :lines="shareLines"
          :empty="words.shares.all"
          :add-label="words.shares.add"
          collapse-id="assets.shares"
          data-testid="asset-shares"
          @add="openShare(null)"
          @change="openShare"
        />
      </DashboardGrid>
      <AssetDialog v-model:open="editing" :entry="entry" />
      <AssetShareDialog v-model:open="shareOpen" :entry="entry" :editing="editingShare" :today="day" />
      <ValuationDialog v-model:open="valuationOpen" :entry="entry" :editing="editingValuation" :today="day" />
    </template>
    <ScreenSkeleton v-else-if="state.workbook === null && state.status !== 'error'" />
    <template v-else-if="state.workbook !== null">
      <PageHeader :title="words.asset" />
      <AppCard>
        <p class="px-4 py-6 type-aside sm:px-5" data-testid="asset-missing">{{ words.missing }}</p>
      </AppCard>
    </template>
  </section>
</template>
