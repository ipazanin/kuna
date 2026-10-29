<script setup lang="ts">
import { ref, watch } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { BILLING_STATUS } from './billingView'
import type { BillingMonthLine } from './billingView'

/** Each month of the year with plan rows or invoices above the plan, open on the one a link names. */
const props = defineProps<{
  months: readonly BillingMonthLine[]
  /** The month to open and scroll to, from the address. */
  selected: MonthKey | null
  /** Shows each row's client, when more than one client has rows. */
  showClient: boolean
}>()

const expanded = ref<ReadonlySet<MonthKey>>(new Set())

watch(
  () => props.selected,
  (month) => {
    if (month !== null) expanded.value = new Set([...expanded.value, month])
  },
  { immediate: true },
)

function toggle(month: MonthKey): void {
  const next = new Set(expanded.value)
  if (!next.delete(month)) next.add(month)
  expanded.value = next
}
</script>

<template>
  <ol class="flex flex-col" data-testid="billing-months">
    <li v-for="month in months" :id="`billing-month-${month.month}`" :key="month.month" class="month" :data-selected="month.month === selected || undefined">
      <button
        type="button"
        class="month-toggle"
        :aria-expanded="expanded.has(month.month)"
        :aria-controls="`billing-month-detail-${month.month}`"
        data-testid="billing-month-toggle"
        @click="toggle(month.month)"
      >
        <span class="month-label text-sm font-medium text-highlighted">{{ month.label }}</span>
        <span class="month-figures text-xs text-muted">
          <span><MoneyText :cents="month.planned" class="text-toned" /> planned</span>
          <span><MoneyText :cents="month.invoiced" class="text-toned" /> invoiced</span>
        </span>
        <span class="month-status flex flex-wrap items-center justify-end gap-1.5">
          <UBadge v-if="month.status" :label="BILLING_STATUS[month.status].label" :color="BILLING_STATUS[month.status].color" variant="subtle" size="sm" />
          <UBadge v-if="month.withoutPlan > 0" label="Above the plan" color="warning" variant="outline" size="sm" />
        </span>
        <UIcon name="i-lucide-chevron-down" class="chevron size-4 shrink-0 text-muted" :class="{ turned: expanded.has(month.month) }" aria-hidden="true" />
      </button>

      <div v-if="expanded.has(month.month)" :id="`billing-month-detail-${month.month}`" class="month-detail">
        <p v-if="month.open > 0" class="callout text-xs">
          <UIcon name="i-lucide-file-clock" class="size-3.5 shrink-0" aria-hidden="true" />
          <span><MoneyText :cents="month.open" /> of the month's rows is not invoiced yet.</span>
        </p>
        <ul v-if="month.rows.length > 0" class="flex flex-col">
          <li v-for="row in month.rows" :key="row.id" class="plan-line" data-testid="billing-month-row">
            <span class="swatch" :style="{ background: row.colour }" aria-hidden="true" />
            <span class="min-w-0">
              <span class="block truncate text-sm text-toned">{{ row.item }}<span v-if="row.description" class="text-muted">, {{ row.description }}</span></span>
              <span class="figure block text-xs text-muted">{{ shortDayLabel(row.date) }}<template v-if="showClient">, {{ row.clientName }}</template></span>
              <span v-if="row.invoices.length > 0 || row.open > 0" class="mt-1 flex flex-wrap gap-1">
                <span v-for="share in row.invoices" :key="share.key" class="share">
                  <span class="text-muted">{{ share.number }}</span>
                  <MoneyText :cents="share.amount" class="text-toned" />
                </span>
                <span v-if="row.open > 0" class="share open">
                  <span>Open</span>
                  <MoneyText :cents="row.open" />
                </span>
              </span>
            </span>
            <MoneyText :cents="row.amount" class="text-sm text-highlighted" />
          </li>
        </ul>
        <div v-if="month.withoutPlanLines.length > 0" class="flex flex-col gap-1" data-testid="billing-without-plan">
          <p class="callout text-xs">
            <UIcon name="i-lucide-file-question-mark" class="size-3.5 shrink-0" aria-hidden="true" />
            <span>Invoiced in {{ month.label }} above the plan rows it could reach. Add the row it billed, or check the amounts.</span>
          </p>
          <ul class="flex flex-col">
            <li v-for="line in month.withoutPlanLines" :key="line.key" class="plan-line">
              <span class="swatch hollow" aria-hidden="true" />
              <span class="min-w-0">
                <span class="block truncate text-sm text-toned">Invoice {{ line.number }}</span>
                <span class="figure block text-xs text-muted">Issued {{ shortDayLabel(line.issued) }}, {{ line.clientName }}</span>
              </span>
              <MoneyText :cents="line.amount" class="text-sm text-highlighted" />
            </li>
          </ul>
        </div>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.month + .month {
  border-top: 1px solid var(--border-default);
}

.month-toggle {
  display: grid;
  width: 100%;
  min-height: 3rem;
  grid-template-columns: 7rem minmax(0, 1fr) auto 1rem;
  grid-template-areas: 'label figures status chevron';
  align-items: center;
  column-gap: 0.75rem;
  padding: 0.5rem 0;
  text-align: start;
}

.month-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-control);
}

.month-label {
  grid-area: label;
}

.month-figures {
  grid-area: figures;
  display: flex;
  flex-wrap: wrap;
  gap: 0.125rem 1rem;
}

.month-status {
  grid-area: status;
}

.chevron {
  grid-area: chevron;
  transition: transform 160ms ease;
}

.chevron.turned {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
}

.month-detail {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0 0 0.75rem;
}

.callout {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  color: var(--tone-warning);
}

.callout > svg {
  margin-top: 0.125rem;
}

.plan-line {
  display: grid;
  grid-template-columns: 0.625rem minmax(0, 1fr) auto;
  align-items: start;
  column-gap: 0.625rem;
  padding: 0.375rem 0;
}

.swatch {
  width: 0.625rem;
  height: 0.625rem;
  margin-top: 0.3125rem;
  border-radius: 2px;
}

.swatch.hollow {
  box-shadow: inset 0 0 0 1.5px var(--tone-warning);
}

.share {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.0625rem 0.5rem;
  border-radius: var(--radius-control);
  background: var(--surface-elevated);
  font-size: 0.75rem;
}

.share.open {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--border-strong);
  color: var(--tone-warning);
}

@media (max-width: 639px) {
  .month-toggle {
    grid-template-columns: minmax(0, 1fr) auto 1rem;
    grid-template-areas:
      'label status chevron'
      'figures figures chevron';
    row-gap: 0.25rem;
  }
}
</style>
