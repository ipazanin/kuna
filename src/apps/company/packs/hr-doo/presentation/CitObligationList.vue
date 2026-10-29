<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import { dayLabel } from '../../../../../shared/calendar/dayLabel'
import type { TracedFigure } from '../ruleset/tracedFigure'
import type { CitObligationStatus, MatchedCitObligation } from '../domain/cit/matchCitPayments'

/** One corporate tax payment the schedule expects, beside what the bank rows paid on it. */
export interface CitObligationLine {
  readonly key: string
  readonly label: string
  readonly dueOn: string
  readonly expected: number
  readonly paid: number
  /** The bank rows that paid it, or null when none did. */
  readonly paidTo: RouteLocationRaw | null
  readonly outstanding: number
  readonly status: CitObligationStatus
}

const CIT_STATUS_WORDING: Readonly<Record<CitObligationStatus, { readonly label: string; readonly color: 'success' | 'warning' | 'error' | 'neutral' }>> = {
  paid: { label: 'Paid', color: 'success' },
  due: { label: 'Due this month', color: 'warning' },
  overdue: { label: 'Overdue', color: 'error' },
  'to-come': { label: 'To come', color: 'neutral' },
}

export function citObligationLine(entry: MatchedCitObligation, linkOf: (figure: TracedFigure) => RouteLocationRaw | null): CitObligationLine {
  const { obligation } = entry
  return {
    key: `${obligation.kind}-${obligation.taxYear}-${obligation.month ?? 'year'}`,
    label: obligation.expected.label,
    dueOn: dayLabel(obligation.dueOn),
    expected: obligation.expected.amount,
    paid: entry.paid.amount,
    paidTo: linkOf(entry.paid),
    outstanding: entry.outstanding,
    status: entry.status,
  }
}
</script>

<script setup lang="ts">
import UBadge from '@nuxt/ui/components/Badge.vue'

import { usePhoneLayout } from '../../../../../shared/layout/viewport'
import DrillLink from '../../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../../shared/ui/MoneyText.vue'

/**
 * Expected against paid, oldest due date first: a table on a wide screen, one card per payment on a
 * phone. In a narrow card the table moves the due date and the status under the payment's name.
 */
defineProps<{
  lines: readonly CitObligationLine[]
  testId: string
}>()

const phone = usePhoneLayout()
</script>

<template>
  <ul v-if="phone" class="flex flex-col gap-2" :data-testid="testId">
    <li v-for="line in lines" :key="line.key" class="obligation-card" :data-status="line.status">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-medium" :class="line.status === 'to-come' ? 'text-muted' : 'text-highlighted'">{{ line.label }}</p>
          <p class="text-xs text-muted">Due {{ line.dueOn }}</p>
        </div>
        <UBadge :label="CIT_STATUS_WORDING[line.status].label" :color="CIT_STATUS_WORDING[line.status].color" variant="subtle" size="sm" class="shrink-0" />
      </div>
      <dl class="obligation-cells mt-2">
        <div>
          <dt>Expected</dt>
          <dd><MoneyText :cents="line.expected" /></dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>
            <DrillLink :to="line.paidTo" :label="`${line.label}, paid, open the rows`"><MoneyText :cents="line.paid" /></DrillLink>
          </dd>
        </div>
        <div v-if="line.outstanding > 0">
          <dt>Still owed</dt>
          <dd :class="{ 'text-error': line.status === 'overdue' }"><MoneyText :cents="line.outstanding" /></dd>
        </div>
      </dl>
    </li>
  </ul>

  <div v-else class="@container overflow-x-auto">
    <table class="data-table obligation-table w-full text-sm" :data-testid="testId">
      <thead>
        <tr>
          <th scope="col" class="text-start">Payment</th>
          <th scope="col" class="hidden w-32 text-start @2xl:table-cell">Due</th>
          <th scope="col" class="w-28 text-end">Expected</th>
          <th scope="col" class="w-28 text-end">Paid</th>
          <th scope="col" class="w-28 text-end">Still owed</th>
          <th scope="col" class="hidden w-36 text-start @2xl:table-cell">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in lines" :key="line.key" :data-status="line.status" :class="{ 'is-to-come': line.status === 'to-come' }">
          <th scope="row" class="truncate text-start font-normal text-toned">
            {{ line.label }}
            <span class="block text-xs text-muted @2xl:hidden">Due {{ line.dueOn }}</span>
            <UBadge :label="CIT_STATUS_WORDING[line.status].label" :color="CIT_STATUS_WORDING[line.status].color" variant="subtle" size="sm" class="mt-1 @2xl:hidden" />
          </th>
          <td class="figure hidden text-muted @2xl:table-cell">{{ line.dueOn }}</td>
          <td class="text-end"><MoneyText :cents="line.expected" /></td>
          <td class="text-end">
            <DrillLink :to="line.paidTo" :label="`${line.label}, paid, open the rows`"><MoneyText :cents="line.paid" /></DrillLink>
          </td>
          <td class="text-end" :class="{ 'text-error': line.status === 'overdue' }">
            <MoneyText v-if="line.outstanding > 0" :cents="line.outstanding" /><span v-else class="text-dimmed">–</span>
          </td>
          <td class="hidden @2xl:table-cell"><UBadge :label="CIT_STATUS_WORDING[line.status].label" :color="CIT_STATUS_WORDING[line.status].color" variant="subtle" size="sm" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.obligation-card {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-control);
  padding: 0.625rem 0.75rem;
}

.obligation-card[data-status='overdue'] {
  border-color: color-mix(in oklab, var(--tone-negative) 45%, var(--border-default));
}

.obligation-cells {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.375rem 0.75rem;
}

.obligation-cells dt {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.obligation-cells dd {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  font-size: 0.875rem;
  color: var(--ink);
}

.obligation-table {
  table-layout: fixed;
}

tr.is-to-come > * {
  color: var(--ink-muted);
}
</style>
