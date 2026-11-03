<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import type { CapitalGainsYear, TaxSale } from '../domain/taxYear'
import { taxRegisterFile, taxRegisterFileName } from '../infrastructure/taxRegisterFile'
import { words } from './words'
import type { PortfolioSources } from '../../holdings/domain/holding'
import { holdingLink } from '../../holdings/presentation/holdingLinks'
import { QUANTITY_PLACES } from '../../holdings/presentation/holdingText'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { downloadFile } from '../../../../shared/files/downloadFile'
import { formatCount, formatCurrencyAmount, formatMoney, formatQuantity } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import { XLSX_MIME_TYPE } from '../../../../shared/xlsx/sheetGrids'

/** Each sale of the year with the lots it closed, in its currency and in euros at HNB's rate of its settlement day, and the register to download. */
const props = defineProps<{
  gains: CapitalGainsYear
  sources: PortfolioSources
}>()

const text = words.sales
const toast = useToast()
const showAll = ref(false)
const shown = computed(() => (showAll.value ? props.gains.sales : props.gains.sales.slice(0, FIRST_SHOWN)))
const summary = computed(() => plural(text.summary(props.gains.sales.length, formatMoney(props.gains.taxableGains)), props.gains.sales.length))

function rateLine(sale: TaxSale): string | null {
  switch (sale.rate.kind) {
    case 'euro':
      return null
    case 'missing':
      return text.noRate(dayLabel(sale.settles))
    case 'hnb': {
      const rate = text.rate(formatQuantity(sale.rate.rate.unitsPerEuro, QUANTITY_PLACES))
      return sale.rate.rate.estimatedFrom === null ? rate : `${rate}. ${text.rateNotOut(dayLabel(sale.rate.rate.estimatedFrom))}`
    }
  }
}

const downloading = ref(false)

async function download(): Promise<void> {
  if (downloading.value) return
  downloading.value = true
  try {
    const { book, rates } = props.sources
    downloadFile(await taxRegisterFile(book, rates, props.gains.year), taxRegisterFileName(props.gains.year), XLSX_MIME_TYPE)
  } catch {
    toast.add({ title: text.downloadFailed, color: 'error' })
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <AppCard :title="text.title" :subtitle="text.subtitle(gains.year)" collapse-id="investments.tax.sales" :summary="summary" data-testid="tax-sales">
    <template #actions>
      <UButton icon="i-lucide-download" color="neutral" variant="outline" size="sm" :label="text.download" :loading="downloading" data-testid="tax-download" @click="download" />
    </template>
    <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="text.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ text.bought }}</th>
          <th scope="col" class="hidden text-end @3xl:table-cell">{{ text.units }}</th>
          <th scope="col" class="hidden text-end @3xl:table-cell">{{ text.daysHeld }}</th>
          <th scope="col" class="hidden text-end @3xl:table-cell">{{ text.cost }}</th>
          <th scope="col" class="hidden text-end @3xl:table-cell">{{ text.proceeds }}</th>
          <th scope="col" class="hidden text-end @3xl:table-cell">{{ text.fees }}</th>
          <th scope="col" class="hidden text-end @lg:table-cell">{{ text.gainInCurrency }}</th>
          <th scope="col" class="text-end">{{ text.gainInEuros }}</th>
          <th scope="col" class="text-end">{{ text.status }}</th>
        </tr>
      </thead>
      <tbody v-for="sale in shown" :key="sale.trade.id" data-testid="tax-sale">
        <tr class="group-row">
          <th scope="rowgroup" colspan="9" class="cell-wraps text-start">
            <span class="flex items-start justify-between gap-3">
              <span class="min-w-0">
                <DrillLink :to="holdingLink(sale.instrument)">{{ sale.instrument.name }}</DrillLink>
                <span class="block type-caption font-normal">{{ text.sold(dayLabel(sale.trade.date)) }}, {{ text.settles(dayLabel(sale.settles)) }}</span>
                <span
                  v-if="rateLine(sale) !== null"
                  class="block type-caption font-normal"
                  :class="{ 'text-warning': sale.rate.kind !== 'hnb' || sale.rate.rate.estimatedFrom !== null }"
                  data-testid="tax-sale-rate"
                >
                  {{ rateLine(sale) }}
                </span>
              </span>
              <MoneyText v-if="sale.gain !== null" :cents="sale.gain" sign="always" tone="outcome" class="shrink-0" />
            </span>
            <span v-if="sale.settlesNextYear" class="flex items-start gap-1 type-caption font-normal text-warning" data-testid="tax-sale-next-year">
              <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {{ text.nextYear }}
            </span>
          </th>
        </tr>
        <tr v-for="(line, place) in sale.lines" :key="place" data-testid="tax-sale-line">
          <th scope="row" class="cell-wraps text-start font-normal">
            {{ dayLabel(line.realised.opened) }}
            <span class="block type-caption @3xl:hidden">{{ text.lot(formatQuantity(line.realised.quantity, QUANTITY_PLACES), formatCount(line.realised.daysHeld)) }}</span>
            <span class="block type-caption @3xl:hidden">
              {{
                text.legs(
                  formatCurrencyAmount(line.realised.costInCurrency, sale.instrument.currency),
                  formatCurrencyAmount(line.realised.proceedsInCurrency, sale.instrument.currency),
                  formatCurrencyAmount(line.realised.feesInCurrency, sale.instrument.currency),
                )
              }}
            </span>
            <span v-if="line.nearTaxFreeDay" class="flex items-start gap-1 type-caption text-warning" data-testid="tax-near-tax-free">
              <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {{ text.nearTaxFreeDay(dayLabel(line.taxFreeFrom)) }}
            </span>
          </th>
          <td class="figure hidden text-end @3xl:table-cell">{{ formatQuantity(line.realised.quantity, QUANTITY_PLACES) }}</td>
          <td class="figure hidden text-end @3xl:table-cell">{{ formatCount(line.realised.daysHeld) }}</td>
          <td class="figure hidden text-end @3xl:table-cell">{{ formatCurrencyAmount(line.realised.costInCurrency, sale.instrument.currency) }}</td>
          <td class="figure hidden text-end @3xl:table-cell">{{ formatCurrencyAmount(line.realised.proceedsInCurrency, sale.instrument.currency) }}</td>
          <td class="figure hidden text-end @3xl:table-cell">{{ formatCurrencyAmount(line.realised.feesInCurrency, sale.instrument.currency) }}</td>
          <td class="figure hidden text-end @lg:table-cell">{{ formatCurrencyAmount(line.gainInCurrency, sale.instrument.currency) }}</td>
          <td class="cell-wraps text-end">
            <MoneyText v-if="line.gain !== null" :cents="line.gain" sign="always" tone="outcome" />
            <span class="block type-caption @lg:hidden">{{ formatCurrencyAmount(line.gainInCurrency, sale.instrument.currency) }}</span>
          </td>
          <td class="cell-wraps text-end type-caption" data-testid="tax-line-status">{{ text.statuses[line.status] }}</td>
        </tr>
      </tbody>
    </FigureTable>
    <div v-if="gains.sales.length > FIRST_SHOWN" class="px-4 pb-4 sm:px-5">
      <ShowAllButton v-model:expanded="showAll" :total="gains.sales.length" />
    </div>
  </AppCard>
</template>
