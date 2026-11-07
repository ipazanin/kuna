<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import AssetDialog from '../../asset/presentation/AssetDialog.vue'
import { words as homeWords } from '../../home/presentation/words'
import { yoursCaption } from '../../home/presentation/assetsHubFigures'
import { useHouseIndex } from '../../houseIndex/presentation/useHouseIndex'
import { assetLoans } from '../../loans/application/assetLoans'
import { carriedByIndex } from '../../values/domain/assetValue'
import { assetsOnDay, assetsTotal } from '../../values/presentation/assetsOnDay'
import { words as valueWords } from '../../values/presentation/words'
import { useAssetsBooks } from '../../workbook/application/assetsStore'
import AssetCard from './AssetCard.vue'
import { words } from './words'
import { today } from '../../../../shared/calendar/civilDate'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import RecordProblemsAlert from '../../../../shared/storage/presentation/RecordProblemsAlert.vue'
import { fileKeptNote } from '../../../../shared/storage/presentation/fileKeptNote'
import { plural } from '../../../../shared/text/translation'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** Every asset the Assets file holds, led by what they are worth together, one card each. */
const { state } = useAssetsBooks()
const index = useHouseIndex()
const day = today()

const loading = computed(() => state.workbook === null && state.status !== 'error')
const fileNote = computed(() => fileKeptNote(state.choice, words.empty))

const loans = computed(() => assetLoans(day))
const assets = computed(() => (state.workbook === null ? [] : assetsOnDay(state.workbook, day, index.value, loans.value)))
const total = computed(() => (state.workbook === null ? null : assetsTotal(state.workbook, day, index.value, loans.value)))
const lines = computed(() => {
  const counted = total.value
  if (counted === null || counted === 'opening') return []
  return [...(counted.unvalued === 0 ? [] : [plural(homeWords.withoutValue(counted.unvalued), counted.unvalued)]), ...(counted.indexFailed ? [valueWords.indexFailed] : [])]
})

const adding = ref(false)
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description">
      <template v-if="assets.length > 0" #actions>
        <UButton :label="words.addAsset" icon="i-lucide-plus" data-testid="add-asset" @click="adding = true" />
      </template>
    </PageHeader>
    <ScreenSkeleton v-if="loading" :heading="false" :cards="2" data-testid="assets-loading" />
    <template v-else-if="state.workbook !== null">
      <EmptyState v-if="assets.length === 0" icon="i-lucide-house" :title="words.empty.title" data-testid="assets-empty">
        <template #description>
          <span class="block">{{ words.empty.description }}</span>
        </template>
        <template #actions>
          <div class="flex flex-col items-center gap-4">
            <UButton :label="words.addAsset" icon="i-lucide-plus" data-testid="add-asset" @click="adding = true" />
            <span class="type-caption">{{ fileNote }}</span>
          </div>
        </template>
      </EmptyState>
      <template v-else>
        <DashboardGrid layout="tiles" data-testid="assets-tiles">
          <KpiTile
            :label="homeWords.value"
            :value="total === null || total === 'opening' ? valueWords.waitingForIndex : formatMoney(total.value)"
            :caption="total === null || total === 'opening' ? '' : (yoursCaption(total.yoursAfter) ?? '')"
            :to="null"
            data-testid="assets-value"
          >
            <template v-if="total === 'opening'" #value>
              <span class="block type-body font-normal" data-testid="assets-value-waiting">{{ valueWords.waitingForIndex }}</span>
            </template>
          </KpiTile>
        </DashboardGrid>
        <div v-if="lines.length > 0" class="flex flex-col gap-1" data-testid="assets-notes">
          <p v-for="line in lines" :key="line" class="type-caption">{{ line }}</p>
        </div>
        <RecordProblemsAlert
          v-if="state.workbook.problems.length > 0"
          :title="plural(words.problems.title(state.workbook.problems.length), state.workbook.problems.length)"
          :problems="state.workbook.problems"
          data-testid="assets-problems"
        />
        <DashboardGrid data-testid="asset-cards">
          <AssetCard v-for="entry in assets" :key="entry.asset.id" :entry="entry" :waiting="index === 'loading' && carriedByIndex(entry.asset)" />
        </DashboardGrid>
      </template>
    </template>
    <AssetDialog v-model:open="adding" :entry="null" />
  </section>
</template>
