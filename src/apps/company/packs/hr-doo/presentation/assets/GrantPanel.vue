<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

export interface GrantYearLine {
  readonly year: number
  readonly released: number
  readonly deferred: number
  readonly when: 'past' | 'current' | 'ahead'
}

export interface GrantLine {
  readonly key: string
  readonly name: string
  readonly received: string
  /** The grant's receipt on the ledger, by its day and the grant categories. */
  readonly receipt: RouteLocationRaw | null
  readonly amount: number
  readonly policy: string
  readonly employmentUntil: string | null
  /** "231 days to go" until the day, then "The required period is over". */
  readonly employmentState: string | null
  /** What the grantor could claim back if employment ended today, or null when the grants tab has no terms for today. */
  readonly clawback: { readonly amount: number; readonly until: string | null } | null
  readonly years: readonly GrantYearLine[]
  /** The variable part no funded cost will ever release. */
  readonly neverReleased: number
}

export interface GrantComparisonLine {
  readonly key: string
  readonly label: string
  readonly accountant: number
  readonly ours: number
  readonly residual: number
}
</script>

<script setup lang="ts">
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'

/** Each grant's release beside the assets it paid for, its employment condition and what a broken condition would cost today. */
defineProps<{
  grants: readonly GrantLine[]
  comparisons: readonly GrantComparisonLine[]
}>()
</script>

<template>
  <p v-if="grants.length === 0" class="text-sm text-muted">The grants tab lists no grant, so nothing is released beside the depreciation.</p>
  <div v-else class="grid gap-x-8 gap-y-5 lg:grid-cols-2" data-testid="grant-panel">
    <section v-for="grant in grants" :key="grant.key" :aria-label="grant.name" class="flex min-w-0 flex-col gap-3">
      <div>
        <h3 class="text-sm font-medium text-highlighted"><span class="identifier">{{ grant.name }}</span>, <MoneyText :cents="grant.amount" /></h3>
        <p class="text-xs text-muted">
          Received <DrillLink :to="grant.receipt" in-prose :label="`Grant received ${grant.received}, open the row`">{{ grant.received }}</DrillLink>. {{ grant.policy }}
        </p>
      </div>

      <dl class="grant-facts">
        <div>
          <dt>Employment required until</dt>
          <dd class="text-highlighted">{{ grant.employmentUntil ?? 'Not on the grants tab' }}</dd>
          <dd v-if="grant.employmentState" class="text-xs text-muted">{{ grant.employmentState }}</dd>
        </div>
        <div data-testid="grant-clawback">
          <dt>Repaid if employment ended today</dt>
          <dd v-if="grant.clawback" class="text-highlighted"><MoneyText :cents="grant.clawback.amount" /></dd>
          <dd v-else class="text-highlighted">Not on the grants tab</dd>
          <dd v-if="grant.clawback?.until" class="text-xs text-muted">This amount holds until {{ grant.clawback.until }}</dd>
        </div>
      </dl>

      <table class="data-table grant-table w-full text-sm">
        <thead>
          <tr>
            <th scope="col" class="text-start">Year</th>
            <th scope="col" class="text-end">Released</th>
            <th scope="col" class="text-end">Deferred at year end</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="year in grant.years" :key="year.year">
            <th scope="row" class="figure text-start font-normal text-toned">
              {{ year.year }}<span v-if="year.when === 'ahead'" class="block text-xs text-muted sm:ms-1.5 sm:inline">to come</span>
            </th>
            <td class="text-end"><MoneyText :cents="year.released" /></td>
            <td class="text-end"><MoneyText :cents="year.deferred" /></td>
          </tr>
        </tbody>
      </table>
      <p v-if="grant.neverReleased > 0" class="text-xs text-muted">
        <MoneyText :cents="grant.neverReleased" class="text-toned" /> of the variable part is never released, because the assets it paid for cost less than that part.
      </p>
    </section>

    <section v-if="comparisons.length > 0" aria-label="Against the accountant's grant lines" class="flex min-w-0 flex-col gap-2" data-testid="grant-residuals">
      <h3 class="text-xs font-medium text-muted">Against the accountant's grant lines on the year-end tab</h3>
      <ul class="flex flex-col gap-2">
        <li v-for="line in comparisons" :key="line.key" class="comparison-row">
          <p class="text-sm text-toned">{{ line.label }}</p>
          <dl class="comparison-figures">
            <div><dt>Accountant</dt><dd><MoneyText :cents="line.accountant" /></dd></div>
            <div><dt>Ours</dt><dd><MoneyText :cents="line.ours" /></dd></div>
            <div>
              <dt>Residual</dt>
              <dd :class="line.residual === 0 ? 'text-positive' : 'text-[var(--tone-warning)]'"><MoneyText :cents="line.residual" sign="always" /></dd>
            </div>
          </dl>
        </li>
      </ul>
      <p class="text-xs text-muted">The residual is the accountant's figure less ours. A gap often means a funded purchase is missing from the assets tab.</p>
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
