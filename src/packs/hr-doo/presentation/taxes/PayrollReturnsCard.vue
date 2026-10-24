<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import { usePhoneLayout } from '../../../../shared/layout/viewport'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { PAYOUT_WEEK } from './accountantView'
import type { PayrollRow } from './accountantView'

/**
 * The year's salary workbooks by worked month, against the bank and the ruleset: a table on a wide
 * screen, one card per month on a phone. Under each figure the workbook states is ours, which opens
 * its rows, and under a row whose rules differ are the lines the ruleset works out otherwise.
 */
const props = defineProps<{
  rows: readonly PayrollRow[]
  year: number
  /** Why the folder could not be listed, or null. */
  problem: string | null
  /** Said in place of the rows before any read, such as while Drive is read. */
  empty: string
}>()

const phone = usePhoneLayout()

const summary = computed(() => {
  const read = props.rows.filter((row) => row.kind === 'read')
  const differing = read.filter((row) => row.badges.some((badge) => badge.tone === 'error')).length
  const unread = props.rows.length - read.length
  return [
    `${read.length} ${read.length === 1 ? 'month' : 'months'} read`,
    differing === 0 ? '' : `${differing} ${differing === 1 ? 'differs' : 'differ'}`,
    unread === 0 ? '' : `${unread} could not be read`,
  ]
    .filter((part) => part !== '')
    .join(', ')
})
</script>

<template>
  <AppCard
    id="accountant-payroll"
    title="Payroll from the accountant"
    :subtitle="`Each worked month's salary workbook against the owner pay rows and their taxes ${PAYOUT_WEEK}, and every line against the ruleset.`"
    collapse-id="year.accountant-payroll"
    :summary="summary"
    data-testid="accountant-payroll"
  >
    <p v-if="problem" class="px-4 py-6 text-sm text-error sm:px-5" data-testid="accountant-payroll-problem">{{ problem }}</p>
    <p v-else-if="rows.length === 0" class="px-4 py-6 text-sm text-muted sm:px-5">{{ empty || `No salary workbook for ${year} in the folder.` }}</p>
    <ul v-else-if="phone" class="flex flex-col gap-2 px-4 pt-3 pb-4">
      <li v-for="row in rows" :key="row.key" class="return-card" :data-kind="row.kind" :data-period="row.key">
        <p class="text-sm font-medium text-highlighted">
          {{ row.month }}<span v-if="row.paidOn" class="font-normal text-muted">, paid {{ row.paidOn }}</span>
        </p>
        <dl v-if="row.kind === 'read'" class="return-cells mt-1">
          <div>
            <dt>To the state</dt>
            <dd><MoneyText :cents="row.stateTheirs ?? 0" /></dd>
          </div>
          <div>
            <dt>Bank</dt>
            <dd>
              <DrillLink :to="row.stateOurs?.to ?? null" :label="`${row.month}, paid to the state, open the rows`"><MoneyText :cents="row.stateOurs?.cents ?? 0" /></DrillLink>
            </dd>
          </div>
          <div>
            <dt>To the employee</dt>
            <dd><MoneyText :cents="row.employeeTheirs ?? 0" /></dd>
          </div>
          <div>
            <dt>Bank</dt>
            <dd>
              <DrillLink :to="row.employeeOurs?.to ?? null" :label="`${row.month}, paid to the employee, open the rows`"><MoneyText :cents="row.employeeOurs?.cents ?? 0" /></DrillLink>
            </dd>
          </div>
        </dl>
        <div class="mt-1 flex flex-wrap items-center gap-2">
          <DrillLink v-for="badge in row.badges" :key="badge.key" :to="badge.to" :label="badge.name">
            <UBadge :label="badge.label" :color="badge.tone" variant="subtle" size="sm" />
          </DrillLink>
        </div>
        <ul v-if="row.ruleLines.length" class="mt-1 flex flex-col text-xs text-toned" :aria-label="`${row.month}, lines the ruleset works out otherwise`">
          <li v-for="line in row.ruleLines" :key="line.key">
            {{ line.label }}<template v-if="line.theirs !== null && line.ours !== null">: <MoneyText :cents="line.theirs" /> in the workbook, <MoneyText :cents="line.ours" /> by the ruleset</template>
          </li>
        </ul>
        <p v-for="note in row.notes" :key="note" class="mt-1 text-xs text-toned">{{ note }}</p>
      </li>
    </ul>
    <div v-else class="@container overflow-x-auto px-1 pb-2 sm:px-2">
      <table class="data-table w-full text-sm">
        <thead>
          <tr>
            <th scope="col" class="w-28 text-start">Worked</th>
            <th scope="col" class="hidden w-28 text-start @3xl:table-cell">Paid</th>
            <th scope="col" class="hidden w-28 text-end @3xl:table-cell">Gross I</th>
            <th scope="col" class="w-32 text-end">To the state</th>
            <th scope="col" class="w-32 text-end">To the employee</th>
            <th scope="col" class="text-start">Checks</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" :data-kind="row.kind" :data-period="row.key">
            <th scope="row" class="text-start font-normal text-toned">{{ row.month }}</th>
            <td class="figure hidden text-muted @3xl:table-cell">{{ row.paidOn }}</td>
            <td class="hidden text-end @3xl:table-cell"><MoneyText v-if="row.gross !== null" :cents="row.gross" /></td>
            <td class="text-end">
              <template v-if="row.stateTheirs !== null && row.stateOurs !== null">
                <MoneyText :cents="row.stateTheirs" />
                <span class="block text-xs text-muted">
                  Bank <DrillLink :to="row.stateOurs.to" :label="`${row.month}, paid to the state, open the rows`"><MoneyText :cents="row.stateOurs.cents" /></DrillLink>
                </span>
              </template>
            </td>
            <td class="text-end">
              <template v-if="row.employeeTheirs !== null && row.employeeOurs !== null">
                <MoneyText :cents="row.employeeTheirs" />
                <span class="block text-xs text-muted">
                  Bank <DrillLink :to="row.employeeOurs.to" :label="`${row.month}, paid to the employee, open the rows`"><MoneyText :cents="row.employeeOurs.cents" /></DrillLink>
                </span>
              </template>
            </td>
            <td>
              <div class="flex flex-wrap items-center gap-1.5">
                <DrillLink v-for="badge in row.badges" :key="badge.key" :to="badge.to" :label="badge.name">
                  <UBadge :label="badge.label" :color="badge.tone" variant="subtle" size="sm" />
                </DrillLink>
              </div>
              <ul v-if="row.ruleLines.length" class="mt-1 flex flex-col text-xs whitespace-normal text-toned" :aria-label="`${row.month}, lines the ruleset works out otherwise`">
                <li v-for="line in row.ruleLines" :key="line.key">
                  {{ line.label }}<template v-if="line.theirs !== null && line.ours !== null">: <MoneyText :cents="line.theirs" /> in the workbook, <MoneyText :cents="line.ours" /> by the ruleset</template>
                </li>
              </ul>
              <p v-for="note in row.notes" :key="note" class="mt-1 text-xs whitespace-normal text-toned">{{ note }}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppCard>
</template>

<style scoped src="./returnCard.css"></style>
