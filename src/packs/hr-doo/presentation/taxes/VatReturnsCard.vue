<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import { usePhoneLayout } from '../../../../shared/layout/viewport'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import type { VatReturnRow } from './accountantView'

/**
 * The year's VAT returns against the books: a table on a wide screen, one card per month on a phone.
 * A differing badge opens the rows it compared, and a file the reader refused says where.
 */
const props = defineProps<{
  rows: readonly VatReturnRow[]
  year: number
  /** Why the folder could not be listed, or null. */
  problem: string | null
  /** Said in place of the rows before any read, such as while Drive is read. */
  empty: string
}>()

const phone = usePhoneLayout()

const summary = computed(() => {
  const filed = props.rows.filter((row) => row.kind === 'filed')
  const differing = filed.filter((row) => row.badges.some((badge) => badge.tone === 'error')).length
  const unread = props.rows.filter((row) => row.kind === 'unread').length
  return [
    `${filed.length} ${filed.length === 1 ? 'return' : 'returns'} read`,
    differing === 0 ? '' : `${differing} ${differing === 1 ? 'differs' : 'differ'}`,
    unread === 0 ? '' : `${unread} could not be read`,
  ]
    .filter((part) => part !== '')
    .join(', ')
})
</script>

<template>
  <AppCard
    id="vat-returns"
    title="VAT returns"
    subtitle="The accountant's returns against the books. The carry is the VAT position to the month's end, the sales are the invoices delivered in the month."
    collapse-id="year.vat-returns"
    :summary="summary"
    data-testid="vat-returns"
  >
    <p v-if="problem" class="px-4 py-6 text-sm text-error sm:px-5" data-testid="vat-returns-problem">{{ problem }}</p>
    <p v-else-if="rows.length === 0" class="px-4 py-6 text-sm text-muted sm:px-5">{{ empty || `No VAT return for ${year} in the folder.` }}</p>
    <ul v-else-if="phone" class="flex flex-col gap-2 px-4 pt-3 pb-4">
      <li v-for="row in rows" :key="row.key" class="return-card" :data-kind="row.kind" :data-period="row.key">
        <p class="text-sm font-medium text-highlighted">{{ row.month }}</p>
        <p v-if="row.kind === 'not-filed'" class="text-sm text-muted">No return filed</p>
        <dl v-if="row.kind === 'filed'" class="return-cells mt-1">
          <div>
            <dt>Sales</dt>
            <dd><MoneyText :cents="row.sales ?? 0" /></dd>
          </div>
          <div>
            <dt>Input VAT</dt>
            <dd><MoneyText :cents="row.inputVat ?? 0" /></dd>
          </div>
          <div>
            <dt>Carried forward</dt>
            <dd><MoneyText :cents="row.theirCarry ?? 0" /></dd>
          </div>
          <div>
            <dt>Ours</dt>
            <dd>
              <DrillLink :to="row.ourCarry?.to ?? null" :label="`${row.month}, our carry, open the rows`"><MoneyText :cents="row.ourCarry?.cents ?? 0" /></DrillLink>
            </dd>
          </div>
        </dl>
        <div v-if="row.badges.length" class="mt-1 flex flex-wrap items-center gap-2">
          <DrillLink v-for="badge in row.badges" :key="badge.key" :to="badge.to" :label="badge.name">
            <UBadge :label="badge.label" :color="badge.tone" variant="subtle" size="sm" />
          </DrillLink>
        </div>
        <p v-for="note in row.notes" :key="note" class="mt-1 text-xs text-toned">{{ note }}</p>
      </li>
    </ul>
    <div v-else class="@container overflow-x-auto px-1 pb-2 sm:px-2">
      <table class="data-table w-full text-sm">
        <thead>
          <tr>
            <th scope="col" class="w-28 text-start">Month</th>
            <th scope="col" class="hidden w-28 text-end @3xl:table-cell">Sales</th>
            <th scope="col" class="hidden w-24 text-end @3xl:table-cell">Input VAT</th>
            <th scope="col" class="w-32 text-end">Carried forward</th>
            <th scope="col" class="w-28 text-end">Ours</th>
            <th scope="col" class="text-start">Checks</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" :data-kind="row.kind" :data-period="row.key">
            <th scope="row" class="text-start font-normal text-toned">{{ row.month }}</th>
            <td class="hidden text-end @3xl:table-cell"><MoneyText v-if="row.sales !== null" :cents="row.sales" /></td>
            <td class="hidden text-end @3xl:table-cell"><MoneyText v-if="row.inputVat !== null" :cents="row.inputVat" /></td>
            <td class="text-end"><MoneyText v-if="row.theirCarry !== null" :cents="row.theirCarry" /></td>
            <td class="text-end">
              <DrillLink v-if="row.ourCarry !== null" :to="row.ourCarry.to" :label="`${row.month}, our carry, open the rows`"><MoneyText :cents="row.ourCarry.cents" /></DrillLink>
            </td>
            <td>
              <p v-if="row.kind === 'not-filed'" class="text-muted">No return filed</p>
              <div v-else class="flex flex-wrap items-center gap-1.5">
                <DrillLink v-for="badge in row.badges" :key="badge.key" :to="badge.to" :label="badge.name">
                  <UBadge :label="badge.label" :color="badge.tone" variant="subtle" size="sm" />
                </DrillLink>
              </div>
              <p v-for="note in row.notes" :key="note" class="mt-1 text-xs whitespace-normal text-toned">{{ note }}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppCard>
</template>

<style scoped src="./returnCard.css"></style>
