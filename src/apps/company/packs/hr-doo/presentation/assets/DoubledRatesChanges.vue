<script lang="ts">
export interface DoubledRatesLine {
  readonly year: number
  readonly depreciation: number
  readonly grantReleased: number
  readonly profitBeforeTax: number
  readonly profitTax: number
  /** The corporate tax rate the profit tax change used, such as "10%". */
  readonly rate: string
}
</script>

<script setup lang="ts">
import { usePhoneLayout } from '../../../../../../shared/layout/viewport'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import FigureTable from '../../../../../../shared/ui/FigureTable.vue'
import { words } from './words'

/** Per year, what doubled rates would change against the rates the workbook asks for. */
defineProps<{
  lines: readonly DoubledRatesLine[]
  /** Whether any grant follows the depreciation, so its column is worth showing. */
  showGrant: boolean
}>()

const phone = usePhoneLayout()
</script>

<template>
  <ul v-if="phone" class="flex flex-col gap-2" data-testid="doubled-rates-changes">
    <li v-for="line in lines" :key="line.year" class="rounded-control border border-default px-3 py-2">
      <p class="figure text-sm font-medium text-highlighted">{{ line.year }}</p>
      <dl class="change-cells">
        <div>
          <dt>{{ words.changes.depreciation }}</dt>
          <dd><MoneyText :cents="line.depreciation" sign="always" /></dd>
        </div>
        <div v-if="showGrant">
          <dt>{{ words.changes.grantReleased }}</dt>
          <dd><MoneyText :cents="line.grantReleased" sign="always" /></dd>
        </div>
        <div>
          <dt>{{ words.changes.profitBeforeTax }}</dt>
          <dd><MoneyText :cents="line.profitBeforeTax" sign="always" /></dd>
        </div>
        <div>
          <dt>{{ words.changes.profitTaxAt(line.rate) }}</dt>
          <dd><MoneyText :cents="line.profitTax" sign="always" /></dd>
        </div>
      </dl>
    </li>
  </ul>
  <FigureTable v-else data-testid="doubled-rates-changes">
    <thead>
      <tr>
        <th scope="col" class="text-start align-bottom">{{ words.changes.year }}</th>
        <th scope="col" class="cell-wraps text-end align-bottom">{{ words.changes.depreciation }}</th>
        <th v-if="showGrant" scope="col" class="cell-wraps text-end align-bottom">{{ words.changes.grantReleased }}</th>
        <th scope="col" class="cell-wraps text-end align-bottom">{{ words.changes.profitBeforeTax }}</th>
        <th scope="col" class="cell-wraps text-end align-bottom">{{ words.changes.profitTax }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="line in lines" :key="line.year">
        <th scope="row" class="figure text-start font-normal text-toned">{{ line.year }}</th>
        <td class="text-end"><MoneyText :cents="line.depreciation" sign="always" /></td>
        <td v-if="showGrant" class="text-end"><MoneyText :cents="line.grantReleased" sign="always" /></td>
        <td class="text-end"><MoneyText :cents="line.profitBeforeTax" sign="always" /></td>
        <td class="text-end">
          <span class="inline-flex flex-wrap items-baseline justify-end gap-x-1.5">
            <MoneyText :cents="line.profitTax" sign="always" class="text-highlighted" />
            <span class="text-xs text-muted">{{ words.changes.at(line.rate) }}</span>
          </span>
        </td>
      </tr>
    </tbody>
  </FigureTable>
</template>

<style scoped>
.change-cells {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.375rem 0.75rem;
  margin-top: 0.375rem;
}

.change-cells dt {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.change-cells dd {
  font-size: 0.875rem;
}
</style>
