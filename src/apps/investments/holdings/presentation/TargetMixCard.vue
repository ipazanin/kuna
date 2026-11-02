<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'

import type { HoldingMix, HoldingMixes } from '../domain/holdingMix'
import { depositSplit, targetGaps, targetedMix } from '../domain/targetMix'
import { groupName } from './mixDonut'
import TargetsDialog from './TargetsDialog.vue'
import { words } from './words'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { Mix } from '../../workbook/domain/mixGroup'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { decimalText } from '../../../../shared/money/decimal'
import { ZERO } from '../../../../shared/money/money'
import { formatMoney, formatShare } from '../../../../shared/money/moneyFormat'
import { typedAmount } from '../../../../shared/money/typedAmount'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** Each group of the mix that has targets against its target, and what an amount put in would buy of each. */
const props = defineProps<{
  book: InvestmentBook
  mixes: HoldingMixes
}>()

const text = words.targets
const phone = usePhoneLayout()
const setting = ref(false)
const putIn = ref('')

const targets = computed(() => targetedMix(props.book.targets))
const targeted = computed((): HoldingMix<Mix> | null => (targets.value === null ? null : props.mixes[targets.value.mix]))
const gaps = computed(() => (targeted.value === null || targets.value === null ? [] : targetGaps(targeted.value.parts, targets.value.targets, targeted.value.whole)))
const deposit = computed(() => {
  const amount = typedAmount(putIn.value)
  return amount === null || amount <= 0 ? null : amount
})
const buys = computed(() => {
  const mix = targeted.value
  if (mix === null || targets.value === null || deposit.value === null) return null
  return new Map(depositSplit(mix.parts, targets.value.targets, mix.whole, deposit.value).map((line) => [line.group, line.buy]))
})

const nameOf = (group: string): string => (targeted.value === null ? group : groupName(targeted.value.mix, group, props.book))

const summary = computed(() => {
  if (targeted.value === null) return text.none
  const largest = [...gaps.value].sort((first, second) => Math.abs(second.gap) - Math.abs(first.gap))[0]
  return largest === undefined || largest.gap === ZERO ? text.onTarget : text.largestGap(nameOf(largest.group), formatMoney(largest.gap, 'always'))
})
</script>

<template>
  <AppCard
    :title="text.title"
    :subtitle="targeted === null ? undefined : words.mixes.titles[targeted.mix]"
    collapse-id="holdings.targets"
    :summary="summary"
    :start-collapsed="phone"
    data-testid="holdings-targets"
  >
    <template #actions>
      <UButton :label="text.set" icon="i-lucide-target" color="neutral" variant="outline" size="sm" data-testid="targets-set" @click="setting = true" />
    </template>
    <div v-if="targeted === null" class="px-4 pt-3 pb-4 sm:px-5">
      <EmptyState icon="i-lucide-target" :title="text.none" :description="text.noneDescription" data-testid="targets-none" />
    </div>
    <template v-else>
      <FigureTable class="px-1 sm:px-2" :label="text.title" data-testid="targets-table">
        <thead>
          <tr>
            <th scope="col" class="text-start">{{ text.columns.group }}</th>
            <th scope="col" class="hidden text-end @md:table-cell">{{ text.columns.now }}</th>
            <th scope="col" class="text-end">{{ text.columns.target }}</th>
            <th scope="col" class="text-end">{{ text.columns.gap }}</th>
            <th v-if="buys !== null" scope="col" class="text-end">{{ text.columns.buy }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in gaps" :key="line.group" data-testid="targets-line">
            <th scope="row" class="cell-wraps text-start font-normal">
              <span class="text-highlighted">{{ nameOf(line.group) }}</span>
              <span class="block type-caption @md:hidden">{{ line.share === null ? '–' : formatShare(line.share) }}</span>
            </th>
            <td class="figure hidden text-end @md:table-cell">{{ line.share === null ? '–' : formatShare(line.share) }}</td>
            <td class="figure text-end">{{ formatShare(Number(decimalText(line.target)) / 100) }}</td>
            <td class="text-end"><MoneyText :cents="line.gap" sign="always" data-testid="targets-gap" /></td>
            <td v-if="buys !== null" class="text-end"><MoneyText :cents="buys.get(line.group) ?? ZERO" data-testid="targets-buy" /></td>
          </tr>
        </tbody>
      </FigureTable>
      <div class="px-4 pt-3 pb-4 sm:px-5">
        <UFormField :label="text.putIn" :help="text.putInHelp">
          <MoneyInput v-model="putIn" class="w-full sm:w-56" data-testid="targets-put-in" />
        </UFormField>
      </div>
    </template>
    <TargetsDialog v-model:open="setting" :book="book" :mixes="mixes" />
  </AppCard>
</template>
