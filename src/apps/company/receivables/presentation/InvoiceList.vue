<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { InvoiceStatus } from '../domain/invoiceMatching'

export interface InvoicePaymentLine {
  readonly key: string
  readonly date: string
  readonly amount: number
  readonly to: RouteLocationRaw | null
}

export interface InvoiceLine {
  readonly id: RecordId
  readonly number: string
  readonly client: string
  readonly item: string
  readonly issued: string
  /** "due 3 Nov", "no due date", or for a late one "41 days late". */
  readonly timing: string
  readonly late: boolean
  readonly amount: number
  readonly remaining: number
  readonly status: InvoiceStatus
  readonly received: string | null
  readonly payments: readonly InvoicePaymentLine[]
  readonly overpayments: readonly InvoicePaymentLine[]
}
</script>

<script setup lang="ts">
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import DrillLink from '../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** Each invoice, newest first, with the payments the matching gave it. */
defineProps<{
  invoices: readonly InvoiceLine[]
  /** Shows each invoice's client, when more than one is in view. */
  showClient: boolean
  /** Off while another write runs. */
  editable: boolean
}>()

const emit = defineEmits<{
  edit: [id: RecordId]
}>()

const STATUS = {
  paid: { label: 'Paid', color: 'success' },
  partial: { label: 'Part paid', color: 'warning' },
  outstanding: { label: 'Unpaid', color: 'error' },
} as const
</script>

<template>
  <ul class="flex flex-col" data-testid="invoice-list">
    <li v-for="invoice in invoices" :key="invoice.id" class="invoice-row">
      <div class="invoice-head">
        <div class="invoice-id min-w-0">
          <p class="flex min-w-0 items-baseline gap-2">
            <span class="figure text-sm font-medium text-highlighted">{{ invoice.number }}</span>
            <span v-if="showClient" class="truncate text-xs text-muted">{{ invoice.client }}</span>
          </p>
          <p v-if="invoice.item" class="truncate text-xs text-muted">{{ invoice.item }}</p>
        </div>
        <p class="invoice-timing figure text-xs text-toned">
          {{ invoice.issued }}<span :class="invoice.late ? 'text-[var(--tone-warning)]' : 'text-muted'">, {{ invoice.timing }}</span>
        </p>
        <MoneyText :cents="invoice.amount" precision="whole" class="invoice-amount text-end text-sm font-medium text-highlighted" />
        <UBadge :label="STATUS[invoice.status].label" :color="STATUS[invoice.status].color" variant="subtle" size="sm" class="invoice-status justify-self-start" />
        <p class="invoice-outcome text-xs text-muted">
          <template v-if="invoice.status === 'paid' && invoice.received">Paid {{ invoice.received }}</template>
          <template v-else-if="invoice.status === 'paid'">Nothing to pay</template>
          <template v-else><MoneyText :cents="invoice.remaining" precision="whole" class="text-toned" /> still owed</template>
        </p>
        <UButton
          icon="i-lucide-square-pen"
          color="neutral"
          variant="ghost"
          size="xs"
          class="invoice-edit"
          :disabled="!editable"
          :aria-label="`Edit invoice ${invoice.number}`"
          data-testid="invoice-edit"
          @click="emit('edit', invoice.id)"
        />
      </div>
      <ol v-if="invoice.payments.length > 0 || invoice.overpayments.length > 0" class="invoice-trail" :aria-label="`Payments matched to invoice ${invoice.number}`">
        <li v-for="payment in invoice.payments" :key="payment.key">
          <DrillLink :to="payment.to" :label="`Payment of ${payment.date} towards invoice ${invoice.number}, open the row`" class="payment-share">
            <span class="text-muted">{{ payment.date }}</span>
            <MoneyText :cents="payment.amount" precision="whole" class="text-toned" />
          </DrillLink>
        </li>
        <li v-for="overpayment in invoice.overpayments" :key="`over-${overpayment.key}`">
          <DrillLink :to="overpayment.to" :label="`Overpaid on ${overpayment.date}, open the row`" class="payment-share overpaid">
            <span class="text-muted">Overpaid {{ overpayment.date }}</span>
            <MoneyText :cents="overpayment.amount" precision="whole" sign="always" class="text-toned" />
          </DrillLink>
        </li>
      </ol>
    </li>
  </ul>
</template>

<style scoped>
.invoice-row {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.625rem 0;
}

.invoice-row + .invoice-row {
  border-top: 1px solid var(--border-default);
}

.invoice-head {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.2fr) 5.5rem 5.5rem minmax(0, 1fr) auto;
  grid-template-areas: 'id timing amount status outcome edit';
  align-items: center;
  column-gap: 0.75rem;
}

.invoice-id {
  grid-area: id;
}

.invoice-timing {
  grid-area: timing;
}

.invoice-amount {
  grid-area: amount;
}

.invoice-status {
  grid-area: status;
}

.invoice-outcome {
  grid-area: outcome;
  text-align: end;
}

.invoice-edit {
  grid-area: edit;
  justify-self: end;
}

.invoice-trail {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
}

.payment-share {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-control);
  background: var(--surface-elevated);
  font-size: 0.75rem;
}

.payment-share.overpaid {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--border-strong);
}

@media (max-width: 767px) {
  .invoice-head {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'id amount'
      'timing status'
      'outcome edit';
    row-gap: 0.25rem;
  }

  .invoice-status {
    justify-self: end;
  }

  .invoice-outcome {
    text-align: start;
  }
}
</style>
