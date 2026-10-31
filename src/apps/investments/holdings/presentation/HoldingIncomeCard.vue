<script setup lang="ts">
import { computed, ref } from 'vue'

import type { LatestRecord } from '../domain/latestRecords'
import { words as recordWords } from '../../workbook/domain/words'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatCurrencyAmount } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

/** A holding's dividends and coupons newest first, each gross and withheld in its currency and received in euros. */
const props = defineProps<{
  /** The holding's records newest first. Only its income shows here. */
  records: readonly LatestRecord[]
}>()

type IncomeRecord = Extract<LatestRecord, { readonly kind: 'income' }>

const payments = computed(() => props.records.filter((entry): entry is IncomeRecord => entry.kind === 'income'))
const showAll = ref(false)
const shown = computed(() => (showAll.value ? payments.value : payments.value.slice(0, FIRST_SHOWN)))
</script>

<template>
  <AppCard :title="words.income.title" :subtitle="words.income.subtitle" data-testid="holding-income">
    <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="words.income.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.income.paid }}</th>
          <th scope="col" class="text-end">{{ words.income.gross }}</th>
          <th scope="col" class="text-end">{{ words.income.withheld }}</th>
          <th scope="col" class="text-end">{{ words.income.received }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="payment in shown" :key="payment.record.id" data-testid="holding-payment">
          <th scope="row" class="text-start font-normal">
            <span class="text-toned">{{ dayLabel(payment.record.date) }}</span>
            <span class="block type-caption">{{ recordWords.incomeKinds[payment.record.kind] }}</span>
          </th>
          <td class="figure text-end">{{ formatCurrencyAmount(payment.record.gross, payment.record.currency) }}</td>
          <td class="figure text-end">{{ formatCurrencyAmount(payment.record.withheld, payment.record.currency) }}</td>
          <td class="text-end"><MoneyText :cents="payment.euros" /></td>
        </tr>
      </tbody>
    </FigureTable>
    <div v-if="payments.length > FIRST_SHOWN" class="px-4 pb-4 sm:px-5">
      <ShowAllButton v-model:expanded="showAll" :total="payments.length" />
    </div>
  </AppCard>
</template>
