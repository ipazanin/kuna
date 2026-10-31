<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import type { CadenceState } from '../../domain/payrollCadence'

export interface CadenceCell {
  readonly month: MonthKey
  readonly state: CadenceState
  readonly amount: number
  readonly to: RouteLocationRaw | null
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { monthKey } from '../../../../../../shared/calendar/monthKey'
import { monthLabel, shortMonthName } from '../../../../../../shared/calendar/monthLabel'
import { usePhoneLayout } from '../../../../../../shared/layout/viewport'
import { formatCompactMoney, formatMoney } from '../../../../../../shared/money/moneyFormat'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import { words } from './words'

/**
 * One watched tax as a calendar: a row per year and a column per month, each month paid, missed
 * or not due yet. A phone turns it so the months run down the side and each year is a column.
 */
const props = defineProps<{
  name: string
  cells: readonly CadenceCell[]
}>()

const phone = usePhoneLayout()

const STATES: Readonly<Record<CadenceState, { readonly label: string; readonly icon: string }>> = {
  paid: { label: words.calendar.paid, icon: 'i-lucide-check' },
  missing: { label: words.calendar.missed, icon: 'i-lucide-x' },
  'not-yet-due': { label: words.calendar.notDue, icon: 'i-lucide-clock' },
}

const MONTH_NAMES = Array.from({ length: 12 }, (_, index) => shortMonthName(monthKey(2026, index + 1)))

const years = computed(() => [...new Set(props.cells.map((cell) => Number(cell.month.slice(0, 4))))])
const cellByMonth = computed(() => new Map(props.cells.map((cell) => [cell.month, cell])))

function cellAt(year: number, monthIndex: number): CadenceCell | null {
  return cellByMonth.value.get(monthKey(year, monthIndex + 1)) ?? null
}

/** Rows and columns in reading order for the layout on screen. */
const grid = computed(() => {
  if (phone.value) {
    return {
      columns: years.value.map(String),
      rows: MONTH_NAMES.map((name, monthIndex) => ({ label: name, cells: years.value.map((year) => cellAt(year, monthIndex)) })),
    }
  }
  return {
    columns: MONTH_NAMES,
    rows: years.value.map((year) => ({ label: String(year), cells: MONTH_NAMES.map((_, monthIndex) => cellAt(year, monthIndex)) })),
  }
})

function spoken(cell: CadenceCell): string {
  const month = monthLabel(cell.month)
  if (cell.state === 'missing') return words.calendar.missedCell(month)
  if (cell.state === 'not-yet-due') return words.calendar.notDueCell(month)
  return words.calendar.paidCell(month, formatMoney(cell.amount))
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <ul class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-toned" :aria-label="words.calendar.key(name)">
      <li v-for="(meaning, state) in STATES" :key="state" class="inline-flex items-center gap-1.5">
        <span class="cadence-swatch" :class="`is-${state}`" aria-hidden="true"><UIcon :name="meaning.icon" class="size-2.5" /></span>
        {{ meaning.label }}
      </li>
    </ul>
    <div class="overflow-x-auto">
      <table class="cadence-table w-full">
        <caption class="sr-only">
          {{
            words.calendar.caption(name)
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <span class="sr-only">{{ phone ? words.calendar.month : words.calendar.year }}</span>
            </th>
            <th v-for="column in grid.columns" :key="column" scope="col" class="text-center text-xs font-medium text-muted">{{ column }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in grid.rows" :key="row.label">
            <th scope="row" class="pe-2 text-start text-xs font-medium text-muted">{{ row.label }}</th>
            <td v-for="(cell, index) in row.cells" :key="index">
              <DrillLink v-if="cell" :to="cell.to" :label="spoken(cell)" class="cadence-cell" :class="`is-${cell.state}`" :data-testid="`cadence-${cell.state}`">
                <UIcon :name="STATES[cell.state].icon" class="size-3.5 shrink-0" aria-hidden="true" />
                <span v-if="cell.state === 'paid'" class="cadence-amount figure">{{ formatCompactMoney(cell.amount) }}</span>
              </DrillLink>
              <span v-else class="cadence-cell is-outside" aria-hidden="true" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.cadence-table {
  border-collapse: separate;
  border-spacing: 3px;
  table-layout: fixed;
}

.cadence-table thead th:first-child,
.cadence-table tbody th {
  width: 3rem;
}

.cadence-cell {
  display: flex;
  height: 2.75rem;
  width: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  border-radius: 4px;
  font-size: 0.6875rem;
  line-height: 1;
  text-decoration: none;
}

.cadence-cell.is-paid {
  background: color-mix(in srgb, var(--tone-positive) 16%, transparent);
  color: var(--tone-positive);
}

.cadence-cell.is-missing {
  background: color-mix(in srgb, var(--tone-negative) 16%, transparent);
  box-shadow: inset 0 0 0 1.5px var(--tone-negative);
  color: var(--tone-negative);
}

.cadence-cell.is-not-yet-due {
  background: repeating-linear-gradient(45deg, var(--chart-ghost) 0 1.5px, transparent 1.5px 5px), var(--surface-elevated);
  color: var(--ink-muted);
}

.cadence-cell.is-outside {
  background: var(--surface-elevated);
  opacity: 0.5;
}

.cadence-amount {
  color: var(--ink-secondary);
}

.cadence-swatch {
  display: inline-flex;
  width: 14px;
  height: 14px;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
}

.cadence-swatch.is-paid {
  background: color-mix(in srgb, var(--tone-positive) 16%, transparent);
  color: var(--tone-positive);
}

.cadence-swatch.is-missing {
  background: color-mix(in srgb, var(--tone-negative) 16%, transparent);
  box-shadow: inset 0 0 0 1px var(--tone-negative);
  color: var(--tone-negative);
}

.cadence-swatch.is-not-yet-due {
  background: var(--surface-elevated);
  box-shadow: inset 0 0 0 1px var(--border-strong);
  color: var(--ink-muted);
}
</style>
