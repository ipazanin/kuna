<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

export interface GrantYearLine {
  readonly year: number
  readonly released: Money
  readonly deferred: Money
  readonly when: 'past' | 'current' | 'ahead'
}

export interface GrantLine {
  readonly key: string
  readonly name: string
  readonly received: string
  /** The grant's receipt on the ledger, by its day and the grant categories. */
  readonly receipt: RouteLocationRaw | null
  readonly amount: Money
  readonly policy: string
  readonly employmentUntil: string | null
  /** "231 days to go" until the day, then "The required period is over". */
  readonly employmentState: string | null
  /** What the grantor could claim back if employment ended today, or null when the grants tab has no terms for today. */
  readonly clawback: { readonly amount: Money; readonly until: string | null } | null
  readonly years: readonly GrantYearLine[]
  /** The variable part no funded cost will ever release. */
  readonly neverReleased: Money
}

export interface GrantComparisonLine {
  readonly key: string
  readonly label: string
  readonly accountant: Money
  readonly ours: Money
  readonly residual: Money
}
</script>

<script setup lang="ts">
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import NoteLine from '../../../../../../shared/ui/NoteLine.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import { words } from './words'
import type { Money } from '../../../../../../shared/money/money'

/** Each grant's release beside the assets it paid for, its employment condition and what a broken condition would cost today. */
defineProps<{
  grants: readonly GrantLine[]
  comparisons: readonly GrantComparisonLine[]
}>()
</script>

<template>
  <p v-if="grants.length === 0" class="type-aside">{{ words.grants.none }}</p>
  <div v-else class="grid gap-x-8 gap-y-5 @2xl:grid-cols-2" data-testid="grant-panel">
    <section v-for="grant in grants" :key="grant.key" :aria-label="grant.name" class="flex min-w-0 flex-col gap-3">
      <div>
        <h3 class="type-card-title">
          <span class="identifier">{{ grant.name }}</span
          >, <MoneyText :cents="grant.amount" />
        </h3>
        <p class="type-caption">
          {{ words.grants.received }}<DrillLink :to="grant.receipt" in-prose :label="words.grants.receivedRow(grant.received)">{{ grant.received }}</DrillLink
          >{{ words.grants.receivedEnd }} {{ grant.policy }}
        </p>
      </div>

      <dl class="grant-facts">
        <div>
          <dt>{{ words.grants.employmentUntil }}</dt>
          <dd class="text-highlighted">{{ grant.employmentUntil ?? words.grants.notOnTab }}</dd>
          <dd v-if="grant.employmentState" class="type-caption">{{ grant.employmentState }}</dd>
        </div>
        <div data-testid="grant-clawback">
          <dt>{{ words.grants.repaidToday }}</dt>
          <dd v-if="grant.clawback" class="text-highlighted"><MoneyText :cents="grant.clawback.amount" /></dd>
          <dd v-else class="text-highlighted">{{ words.grants.notOnTab }}</dd>
          <dd v-if="grant.clawback?.until" class="type-caption">{{ words.grants.holdsUntil(grant.clawback.until) }}</dd>
        </div>
      </dl>

      <table class="data-table grant-table w-full text-sm">
        <thead>
          <tr>
            <th scope="col" class="text-start">{{ words.grants.year }}</th>
            <th scope="col" class="text-end">{{ words.grants.released }}</th>
            <th scope="col" class="text-end">{{ words.grants.deferredAtYearEnd }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="year in grant.years" :key="year.year">
            <th scope="row" class="figure text-start font-normal text-toned">
              {{ year.year }}<span v-if="year.when === 'ahead'" class="block type-caption sm:ms-1.5 sm:inline">{{ words.grants.toCome }}</span>
            </th>
            <td class="text-end"><MoneyText :cents="year.released" /></td>
            <td class="text-end"><MoneyText :cents="year.deferred" /></td>
          </tr>
        </tbody>
      </table>
      <p v-if="grant.neverReleased > 0" class="type-caption"><MoneyText :cents="grant.neverReleased" class="text-toned" />{{ words.grants.neverReleased }}</p>
    </section>

    <section v-if="comparisons.length > 0" :aria-label="words.grants.againstAccountant" class="flex min-w-0 flex-col gap-2" data-testid="grant-residuals">
      <h3 class="type-label">{{ words.grants.againstAccountantTitle }}</h3>
      <ul class="flex flex-col gap-2">
        <li v-for="line in comparisons" :key="line.key" class="comparison-row">
          <p class="type-body">{{ line.label }}</p>
          <dl class="comparison-figures">
            <div>
              <dt>{{ words.grants.accountant }}</dt>
              <dd><MoneyText :cents="line.accountant" /></dd>
            </div>
            <div>
              <dt>{{ words.grants.ours }}</dt>
              <dd><MoneyText :cents="line.ours" /></dd>
            </div>
            <div>
              <dt>{{ words.grants.residual }}</dt>
              <dd>
                <NoteLine as="span" size="inherit" inline :tone="line.residual === 0 ? 'success' : 'warning'"><MoneyText :cents="line.residual" sign="always" /></NoteLine>
              </dd>
            </div>
          </dl>
        </li>
      </ul>
      <p class="type-caption">{{ words.grants.residualNote }}</p>
    </section>
  </div>
</template>

<style scoped>
.grant-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.grant-facts dt,
.comparison-figures dt {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.grant-facts dd {
  font-size: 0.875rem;
  font-weight: 500;
}

.grant-table th,
.grant-table td {
  padding-inline: 0.5rem;
}

.grant-table thead th {
  white-space: normal;
  vertical-align: bottom;
}

.comparison-row + .comparison-row {
  border-top: 1px solid var(--border-default);
  padding-top: 0.5rem;
}

.comparison-figures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  font-size: 0.875rem;
}
</style>
