<script setup lang="ts">
import type { AssetYears, YearOfAsset } from '../../rows/domain/assetMoney'
import { words } from './words'
import { formatPercent, percentAsShown } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { moneyToneClass } from '../../../../shared/ui/moneyTone'

/**
 * What the rows linked to an asset earned and cost in each full year, newest first, with the net in euros and as a share of the
 * value in that year, and under them the year so far in euros only. `shared` says the share is of your part.
 */
const props = defineProps<{
  years: AssetYears
  shared: boolean
}>()

const lines = (): readonly { readonly key: string; readonly label: string; readonly year: YearOfAsset }[] => [
  ...props.years.full.map((year) => ({ key: String(year.year), label: String(year.year), year })),
  ...(props.years.soFar === null ? [] : [{ key: 'so-far', label: words.money.soFar, year: props.years.soFar }]),
]
const unrated = (): number => [...props.years.full, ...(props.years.soFar === null ? [] : [props.years.soFar])].reduce((count, year) => count + year.unrated, 0)
const notes = (): readonly string[] => [
  ...(props.years.full.some((year) => year.share !== null) ? [props.shared ? words.money.ofYourPart : words.money.ofValue] : []),
  ...(props.years.full.some((year) => year.share === null) ? [words.money.noShare] : []),
  ...(unrated() === 0 ? [] : [plural(words.money.unrated(unrated()), unrated())]),
]
</script>

<template>
  <AppCard :title="words.money.title" :subtitle="words.money.subtitle" data-testid="asset-money">
    <FigureTable class="px-1 pb-2 sm:px-2" :label="words.money.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.money.year }}</th>
          <th scope="col" class="hidden text-end @sm:table-cell">{{ words.money.earned }}</th>
          <th scope="col" class="hidden text-end @sm:table-cell">{{ words.money.cost }}</th>
          <th scope="col" class="text-end">{{ words.money.net }}</th>
          <th scope="col" class="text-end">{{ words.money.share }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in lines()" :key="line.key" data-testid="asset-money-year">
          <th scope="row" class="text-start font-normal">{{ line.label }}</th>
          <td class="hidden text-end @sm:table-cell"><MoneyText :cents="line.year.earned" /></td>
          <td class="hidden text-end @sm:table-cell"><MoneyText :cents="line.year.cost" sign="magnitude" /></td>
          <td class="text-end"><MoneyText :cents="line.year.net" tone="outcome" /></td>
          <td class="figure text-end">
            <span v-if="line.year.share !== null" :class="moneyToneClass(percentAsShown(line.year.share), 'outcome')">{{ formatPercent(line.year.share, 'always') }}</span>
          </td>
        </tr>
      </tbody>
    </FigureTable>
    <div v-if="notes().length > 0" class="flex flex-col gap-1 px-4 pb-4 sm:px-5">
      <p v-for="note in notes()" :key="note" class="type-caption">{{ note }}</p>
    </div>
  </AppCard>
</template>
