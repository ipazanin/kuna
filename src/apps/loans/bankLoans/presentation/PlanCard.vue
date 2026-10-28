<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { PlanLine, PlanYear } from './bankLoanView'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import AppCard from '../../../../shared/ui/AppCard.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/**
 * The plan by year with each year's totals, the given year open. The table drops columns by the
 * card's width, so a phone shows the date, your share and the balance, and a tap on a row shows the rest.
 */
const props = defineProps<{
  years: readonly PlanYear[]
  /** The year that starts open, the current one. */
  openYear: number
  hasSubsidy: boolean
}>()

const opened = ref(new Set<number>([props.openYear]))
const tapped = ref(new Set<string>())

function toggle<T>(set: Set<T>, entry: T): Set<T> {
  const next = new Set(set)
  if (!next.delete(entry)) next.add(entry)
  return next
}

const summary = computed(() => {
  const instalments = props.years.flatMap((year) => year.lines).filter((line) => line.kind === 'instalment').length
  return `${instalments} instalments over ${props.years.length} ${props.years.length === 1 ? 'year' : 'years'}`
})

function dateOf(line: PlanLine): string {
  return line.number === null ? shortDayLabel(line.date) : `${shortDayLabel(line.date)}, no. ${line.number}`
}
</script>

<template>
  <AppCard title="Plan" subtitle="Every payment the terms give, by the year it falls due. A payment still to come at a variable rate is an estimate." collapse-id="loans.plan" :summary="summary" data-testid="loan-plan">
    <ol class="flex flex-col pb-2">
      <li v-for="year in years" :key="year.year" class="border-t border-default first:border-t-0" :data-year="year.year">
        <button
          type="button"
          class="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-start hover:bg-elevated/40 sm:px-5"
          :aria-expanded="opened.has(year.year)"
          data-testid="plan-year"
          @click="opened = toggle(opened, year.year)"
        >
          <span class="flex items-center gap-2 text-sm font-medium text-highlighted">
            <span class="figure">{{ year.year }}</span>
            <UBadge v-if="year.estimate" label="Estimate" color="neutral" variant="subtle" size="sm" />
          </span>
          <span class="flex items-center gap-3 text-xs text-muted">
            <span class="whitespace-nowrap">You pay <MoneyText :cents="year.totals.yourShare" class="text-toned" /></span>
            <span class="whitespace-nowrap">Owed after <MoneyText :cents="year.balance" class="text-toned" /></span>
            <UIcon name="i-lucide-chevron-down" class="size-4 transition-transform" :class="{ 'rotate-180': opened.has(year.year) }" aria-hidden="true" />
          </span>
        </button>
        <div v-if="opened.has(year.year)" class="@container px-1 pb-2 sm:px-2">
          <table class="data-table w-full text-sm" :aria-label="`Plan for ${year.year}`">
            <thead>
              <tr>
                <th scope="col" class="text-start">Due</th>
                <th scope="col" class="text-end">You pay</th>
                <th scope="col" class="hidden text-end @md:table-cell">Instalment</th>
                <th scope="col" class="hidden text-end @xl:table-cell">Interest</th>
                <th scope="col" class="hidden text-end @xl:table-cell">Principal</th>
                <th v-if="hasSubsidy" scope="col" class="hidden text-end @2xl:table-cell">Subsidy</th>
                <th scope="col" class="text-end">Owed after</th>
                <th scope="col" class="hidden text-start @3xl:table-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="line in year.lines" :key="line.key">
                <tr :data-kind="line.kind" :data-late="line.late || undefined" data-testid="plan-row">
                  <th scope="row" class="text-start font-normal">
                    <UButton
                      color="neutral"
                      variant="link"
                      class="-mx-1 px-1 @3xl:hidden"
                      :aria-expanded="tapped.has(line.key)"
                      :aria-label="`${dateOf(line)}, show interest, principal and status`"
                      data-testid="plan-row-toggle"
                      @click="tapped = toggle(tapped, line.key)"
                    >
                      <span class="text-highlighted">{{ dateOf(line) }}</span>
                    </UButton>
                    <span class="hidden text-highlighted @3xl:inline">{{ dateOf(line) }}</span>
                    <span v-if="line.estimate" class="ms-1 text-xs text-muted">est.</span>
                    <span v-if="line.late" class="ms-1 text-xs text-warning">late</span>
                    <span v-if="line.kind === 'extra-payment'" class="ms-1 text-xs text-muted">extra</span>
                  </th>
                  <td class="text-end"><MoneyText :cents="line.yourShare" /></td>
                  <td class="hidden text-end @md:table-cell"><MoneyText :cents="line.payment" /></td>
                  <td class="hidden text-end @xl:table-cell"><MoneyText :cents="line.interest" /></td>
                  <td class="hidden text-end @xl:table-cell"><MoneyText :cents="line.principal" /></td>
                  <td v-if="hasSubsidy" class="hidden text-end @2xl:table-cell"><MoneyText :cents="line.subsidy" /></td>
                  <td class="text-end"><MoneyText :cents="line.balance" /></td>
                  <td class="hidden text-start text-muted @3xl:table-cell">{{ line.status }}</td>
                </tr>
                <tr v-if="tapped.has(line.key)" class="@3xl:hidden" data-testid="plan-row-detail">
                  <td :colspan="hasSubsidy ? 8 : 7" class="cell-wraps">
                    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                      <dt class="text-muted">Instalment</dt>
                      <dd class="text-end"><MoneyText :cents="line.payment" /></dd>
                      <dt class="text-muted">Interest</dt>
                      <dd class="text-end"><MoneyText :cents="line.interest" /></dd>
                      <dt class="text-muted">Principal</dt>
                      <dd class="text-end"><MoneyText :cents="line.principal" /></dd>
                      <template v-if="hasSubsidy">
                        <dt class="text-muted">Subsidy</dt>
                        <dd class="text-end"><MoneyText :cents="line.subsidy" /></dd>
                      </template>
                      <dt class="text-muted">Status</dt>
                      <dd class="text-end">{{ line.status }}{{ line.estimate ? ', an estimate' : '' }}</dd>
                    </dl>
                  </td>
                </tr>
              </template>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" class="text-start">Total {{ year.year }}</th>
                <td class="text-end"><MoneyText :cents="year.totals.yourShare" /></td>
                <td class="hidden text-end @md:table-cell"><MoneyText :cents="year.totals.payment" /></td>
                <td class="hidden text-end @xl:table-cell"><MoneyText :cents="year.totals.interest" /></td>
                <td class="hidden text-end @xl:table-cell"><MoneyText :cents="year.totals.principal" /></td>
                <td v-if="hasSubsidy" class="hidden text-end @2xl:table-cell"><MoneyText :cents="year.totals.subsidy" /></td>
                <td class="text-end"><MoneyText :cents="year.balance" /></td>
                <td class="hidden @3xl:table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      </li>
    </ol>
  </AppCard>
</template>
