<script setup lang="ts">
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { BILLING_STATUS } from './billingView'
import type { BillingRowLine } from './billingView'
import { words } from './words'

/** The year's plan rows, newest date first and in the tab's order within a date: a table on a wide screen, one card per row on a phone. */
defineProps<{
  rows: readonly BillingRowLine[]
  showClient: boolean
  /** Off while another write runs. */
  editable: boolean
}>()

const emit = defineEmits<{
  edit: [row: BillingRowLine]
}>()

const phone = usePhoneLayout()
</script>

<template>
  <ul v-if="phone" class="flex flex-col gap-2" data-testid="billing-rows">
    <li v-for="row in rows" :key="row.id" class="rounded-control border border-default px-3 py-2.5" data-testid="billing-row">
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 items-start gap-2">
          <span class="swatch" :style="{ background: row.colour }" aria-hidden="true" />
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-highlighted">{{ row.item }}</p>
            <p class="figure text-xs text-muted">
              {{ dayLabel(row.date) }}<template v-if="showClient">, {{ row.clientName }}</template>
            </p>
            <p v-if="row.description" class="truncate text-xs text-muted">{{ row.description }}</p>
          </div>
        </div>
        <MoneyText :cents="row.amount" class="shrink-0 text-sm font-medium text-highlighted" />
      </div>
      <div class="mt-1 flex items-center justify-between gap-3">
        <UBadge :label="BILLING_STATUS[row.status].label" :color="BILLING_STATUS[row.status].color" variant="subtle" size="sm" />
        <UButton
          :label="words.rows.edit"
          icon="i-lucide-square-pen"
          color="neutral"
          variant="ghost"
          size="sm"
          class="-me-2"
          :disabled="!editable"
          :aria-label="words.rows.editRow(row.item, dayLabel(row.date))"
          data-testid="billing-row-edit"
          @click="emit('edit', row)"
        />
      </div>
    </li>
  </ul>

  <div v-else class="overflow-x-auto">
    <table class="data-table billing-table w-full text-sm" data-testid="billing-rows">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.rows.billableFrom }}</th>
          <th scope="col" class="text-start">{{ words.rows.item }}</th>
          <th scope="col" class="text-start">{{ words.rows.description }}</th>
          <th v-if="showClient" scope="col" class="text-start">{{ words.rows.client }}</th>
          <th scope="col" class="text-end">{{ words.rows.amount }}</th>
          <th scope="col" class="text-start">{{ words.rows.invoiced }}</th>
          <th scope="col">
            <span class="sr-only">{{ words.rows.edit }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" data-testid="billing-row">
          <td class="figure whitespace-nowrap text-toned">{{ dayLabel(row.date) }}</td>
          <th scope="row" class="cell-wraps text-start font-normal">
            <span class="inline-flex items-center gap-2 text-highlighted">
              <span class="swatch" :style="{ background: row.colour }" aria-hidden="true" />
              {{ row.item }}
            </span>
          </th>
          <td class="cell-wraps text-toned">{{ row.description }}</td>
          <td v-if="showClient" class="cell-wraps text-toned">{{ row.clientName }}</td>
          <td class="text-end"><MoneyText :cents="row.amount" class="text-highlighted" /></td>
          <td>
            <UBadge :label="BILLING_STATUS[row.status].label" :color="BILLING_STATUS[row.status].color" variant="subtle" size="sm" />
          </td>
          <td class="text-end">
            <UButton
              icon="i-lucide-square-pen"
              color="neutral"
              variant="ghost"
              size="xs"
              :disabled="!editable"
              :aria-label="words.rows.editRow(row.item, dayLabel(row.date))"
              data-testid="billing-row-edit"
              @click="emit('edit', row)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.swatch {
  flex-shrink: 0;
  width: 0.625rem;
  height: 0.625rem;
  margin-top: 0.3125rem;
  border-radius: 2px;
}

.billing-table .swatch {
  margin-top: 0;
}

.billing-table th,
.billing-table td {
  padding-inline: 0.5rem;
  vertical-align: middle;
}
</style>
