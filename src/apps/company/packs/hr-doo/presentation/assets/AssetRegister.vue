<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

export interface AssetLine {
  readonly key: string
  readonly name: string
  /** The ledger row that paid for it, or null when none was found. */
  readonly payment: RouteLocationRaw | null
  readonly bought: string
  readonly inUse: string
  readonly cost: number
  readonly group: string
  /** "50%", "100%, doubled", or "Small inventory". */
  readonly rate: string
  readonly rateLink: RouteLocationRaw
  /** Null when the asset carries no depreciation this year. */
  readonly charge: number | null
  readonly accumulated: number
  readonly bookValue: number
  /** "Written off 12 Jun 2025" once nothing is left on the books, else null. */
  readonly gone: string | null
  readonly fundedBy: string | null
}

export interface AssetTotals {
  readonly cost: number
  readonly charge: number
  readonly accumulated: number
  readonly bookValue: number
}
</script>

<script setup lang="ts">
import { useMediaQuery } from '../../../../../../shared/layout/viewport'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import { words } from './words'

/** The assets tab with what the books make of each asset: a table on a wide screen, one card per asset below 1440 px, where ten columns do not fit beside the sidebar. */
defineProps<{
  lines: readonly AssetLine[]
  totals: AssetTotals
  year: number
  today: string
}>()

const narrow = useMediaQuery('(max-width: 1439px)')
</script>

<template>
  <div v-if="narrow" class="flex flex-col gap-2">
    <ul class="grid gap-2 sm:grid-cols-2" data-testid="asset-register">
      <li v-for="line in lines" :key="line.key" class="rounded-control border border-default px-3 py-2.5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <DrillLink :to="line.payment" :label="words.register.openPayment(line.name)" class="text-sm font-medium text-highlighted">
              <span class="truncate">{{ line.name }}</span>
            </DrillLink>
            <p class="text-xs text-muted">
              {{ line.group }}<template v-if="line.fundedBy">{{ words.register.paidBy(line.fundedBy) }}</template>
            </p>
          </div>
          <div class="shrink-0 text-end">
            <MoneyText :cents="line.bookValue" class="text-sm font-medium text-highlighted" />
            <p class="text-xs text-muted">{{ line.gone ?? words.register.bookValue }}</p>
          </div>
        </div>
        <dl class="asset-cells mt-2">
          <div>
            <dt>{{ words.register.bought }}</dt>
            <dd>{{ line.bought }}</dd>
          </div>
          <div>
            <dt>{{ words.register.inUse }}</dt>
            <dd>{{ line.inUse }}</dd>
          </div>
          <div>
            <dt>{{ words.register.cost }}</dt>
            <dd><MoneyText :cents="line.cost" /></dd>
          </div>
          <div>
            <dt>{{ words.register.rate }}</dt>
            <dd>
              <DrillLink :to="line.rateLink" :label="words.register.openRule(line.rate)">{{ line.rate }}</DrillLink>
            </dd>
          </div>
          <div>
            <dt>{{ words.register.chargeIn(year) }}</dt>
            <dd><MoneyText v-if="line.charge !== null" :cents="line.charge" /><span v-else class="text-muted">–</span></dd>
          </div>
          <div>
            <dt>{{ words.register.accumulated }}</dt>
            <dd><MoneyText :cents="line.accumulated" /></dd>
          </div>
        </dl>
        <p v-if="line.payment === null" class="mt-1.5 text-xs text-warning">{{ words.register.noPayment }}</p>
      </li>
    </ul>
    <dl class="asset-cells px-3">
      <div>
        <dt>{{ words.register.allCost }}</dt>
        <dd><MoneyText :cents="totals.cost" /></dd>
      </div>
      <div>
        <dt>{{ words.register.bookValueOn(today) }}</dt>
        <dd class="font-medium text-highlighted"><MoneyText :cents="totals.bookValue" /></dd>
      </div>
    </dl>
  </div>

  <div v-else class="overflow-x-auto">
    <table class="data-table asset-table w-full text-sm" data-testid="asset-register">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.register.asset }}</th>
          <th scope="col" class="text-start">{{ words.register.bought }}</th>
          <th scope="col" class="text-start">{{ words.register.inUse }}</th>
          <th scope="col" class="text-end">{{ words.register.cost }}</th>
          <th scope="col" class="text-start">{{ words.register.group }}</th>
          <th scope="col" class="text-end">{{ words.register.rate }}</th>
          <th scope="col" class="text-end">{{ words.register.chargeIn(year) }}</th>
          <th scope="col" class="text-end">{{ words.register.accumulated }}</th>
          <th scope="col" class="text-end">{{ words.register.bookValueOn(today) }}</th>
          <th scope="col" class="text-start">{{ words.register.fundedBy }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in lines" :key="line.key">
          <th scope="row" class="cell-wraps text-start font-normal">
            <DrillLink v-if="line.payment" :to="line.payment" :label="words.register.openPayment(line.name)" class="text-highlighted">{{ line.name }}</DrillLink>
            <span v-else class="text-highlighted">{{ line.name }}</span>
            <span v-if="line.payment === null" class="block text-xs text-warning">{{ words.register.noPayment }}</span>
          </th>
          <td class="figure text-toned">{{ line.bought }}</td>
          <td class="figure text-toned">{{ line.inUse }}</td>
          <td class="text-end"><MoneyText :cents="line.cost" /></td>
          <td class="cell-wraps text-toned">{{ line.group }}</td>
          <td class="figure cell-wraps text-end">
            <DrillLink :to="line.rateLink" :label="words.register.openRule(line.rate)">{{ line.rate }}</DrillLink>
          </td>
          <td class="text-end"><MoneyText v-if="line.charge !== null" :cents="line.charge" /><span v-else class="text-muted">–</span></td>
          <td class="text-end"><MoneyText :cents="line.accumulated" /></td>
          <td class="text-end">
            <MoneyText :cents="line.bookValue" class="text-highlighted" />
            <span v-if="line.gone" class="block text-xs text-muted">{{ line.gone }}</span>
          </td>
          <td class="cell-wraps text-toned">
            <span v-if="line.fundedBy" class="identifier">{{ line.fundedBy }}</span
            ><span v-else class="text-muted">–</span>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" class="text-start" colspan="3">{{ words.register.allAssets }}</th>
          <td class="text-end"><MoneyText :cents="totals.cost" /></td>
          <td colspan="2" />
          <td class="text-end"><MoneyText :cents="totals.charge" /></td>
          <td class="text-end"><MoneyText :cents="totals.accumulated" /></td>
          <td class="text-end"><MoneyText :cents="totals.bookValue" /></td>
          <td />
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<style scoped>
.asset-table th,
.asset-table td {
  padding-inline: 0.5rem;
  vertical-align: top;
}

/* Long headers wrap so the ten columns fit beside the sidebar. */
.asset-table thead th {
  white-space: normal;
  vertical-align: bottom;
}

.asset-cells {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.375rem 0.75rem;
}

.asset-cells dt {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.asset-cells dd {
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}
</style>
