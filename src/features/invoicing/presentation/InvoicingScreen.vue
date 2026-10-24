<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { monthLabel } from '../../../shared/calendar/monthLabel'
import { formatWholeMoney } from '../../../shared/money/moneyFormat'
import KpiTile from '../../../shared/ui/KpiTile.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../shared/ui/PageTabs.vue'
import { useBillingPlan } from '../../billingPlan/application/useBillingPlan'
import BillingPlanPanel from '../../billingPlan/presentation/BillingPlanPanel.vue'
import { periodRange } from '../../filters/domain/filterState'
import { amountsOwed } from '../../receivables/domain/ageing'
import { daysToPaid } from '../../receivables/domain/daysToPaid'
import { receivablesOf } from '../../receivables/domain/invoiceMatching'
import InvoicesPanel from '../../receivables/presentation/InvoicesPanel.vue'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { newestBookingOf } from '../../workbook/domain/workbook'
import ClientsPanel from './ClientsPanel.vue'
import InvoiceRunDialog from './InvoiceRunDialog.vue'
import { planMonthLink } from './invoicingLinks'
import type { InvoiceRunMode } from './useInvoiceRun'

const TABS: readonly PageTab[] = [
  { label: 'Invoices', value: 'invoices', icon: 'i-lucide-receipt-text' },
  { label: 'Plan', value: 'plan', icon: 'i-lucide-calendar-clock' },
  { label: 'Clients', value: 'clients', icon: 'i-lucide-users' },
]

const { state } = useWorkbook()
const ledger = useFilteredLedger()
const route = useRoute()

const asOf = computed(() => newestBookingOf(state.workbook?.transactions ?? []))
const billing = useBillingPlan(asOf)

/** A link from elsewhere to the clients opens their card, until another tab is picked. */
const clientsLinked = ref(route.query.tab === 'clients')

const runMode = ref<InvoiceRunMode>({ kind: 'new', client: null })
const runOpen = ref(false)

function openRun(mode: InvoiceRunMode): void {
  runMode.value = mode
  runOpen.value = true
}

const hasClients = computed(() => (state.workbook?.clients.length ?? 0) > 0)

const decimal = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

/** Figures as of the newest booking, whatever a tab's period, client or year says. Each opens the tab that holds it. */
const tiles = computed(() => {
  const current = ledger.value
  const day = asOf.value
  if (current === null || day === null) return null
  const { booked: workbook, window } = current
  if (workbook.invoices.length === 0 && workbook.billingPlan.length === 0) return null
  const invoices = receivablesOf(workbook.transactions, workbook.categories, workbook.invoices, workbook.clients).clients.flatMap((entry) => entry.invoices)
  const owed = amountsOwed(invoices, day)
  const paid = daysToPaid(invoices, periodRange({ preset: 'l12' }, window))
  const next = billing.value?.expected[0] ?? null
  const nextClient = next === null ? '' : workbook.clients.find((client) => client.slug === next.client)?.name || next.client
  const invoicesTab = (hash: string) => ({ path: '/invoicing', hash })
  return [
    {
      label: 'Next invoice',
      value: next === null ? '–' : formatWholeMoney(next.amount),
      caption: next === null ? 'Every plan row is invoiced' : `${monthLabel(next.month)}, ${nextClient}`,
      definition: 'The oldest month with plan rows no invoice has billed yet, for one client. It opens that month on the Plan tab.',
      to: next === null ? { path: '/invoicing', query: { tab: 'plan' } } : planMonthLink(next.month),
    },
    {
      label: 'Outstanding',
      value: formatWholeMoney(owed.outstanding),
      caption: owed.openCount === 0 ? 'Every invoice is paid' : `${owed.openCount} ${owed.openCount === 1 ? 'invoice' : 'invoices'} open`,
      definition: 'What every invoice still has unpaid, after the payments matched to it oldest first. An overpayment never makes it negative.',
      to: invoicesTab('#invoices-card'),
    },
    {
      label: 'Overdue',
      value: formatWholeMoney(owed.overdue),
      caption: owed.overdueCount === 0 ? 'Nothing past its due date' : `${owed.overdueCount} ${owed.overdueCount === 1 ? 'invoice' : 'invoices'} past the due date`,
      definition: 'The part of what is outstanding whose due date has passed, as of the newest booking in the ledger. An invoice with no due date counts from its issue date.',
      to: invoicesTab('#invoices-ageing'),
    },
    {
      label: 'Days to get paid',
      value: paid.median === null ? '–' : `${decimal.format(paid.median)} days`,
      caption: paid.median === null ? 'No invoice paid in the last 12 months' : `Median over ${paid.days.length} paid in the last 12 months`,
      definition:
        'The median of the days from an invoice’s issue date to the payment that settled it, over the invoices settled in the last 12 months. The median, because one invoice paid months late moves a mean a long way.',
      to: invoicesTab('#invoices-days'),
    },
  ]
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Invoicing" description="What to bill this month, and who still owes the company.">
      <template v-if="hasClients" #actions>
        <UButton
          label="Make invoice"
          icon="i-lucide-file-plus-2"
          size="sm"
          :disabled="state.writing"
          data-testid="invoice-make"
          @click="openRun({ kind: 'new', client: billing?.expected[0]?.client ?? null })"
        />
      </template>
    </PageHeader>

    <div v-if="tiles" class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="invoicing-tiles">
      <KpiTile v-for="tile in tiles" :key="tile.label" v-bind="tile" />
    </div>

    <PageTabs :tabs="TABS" label="Invoices, plan and clients" @select="clientsLinked = false">
      <template #invoices>
        <InvoicesPanel @run="openRun" />
      </template>
      <template #plan>
        <BillingPlanPanel />
      </template>
      <template #clients>
        <ClientsPanel v-if="state.workbook" :linked="clientsLinked" />
      </template>
    </PageTabs>

    <InvoiceRunDialog v-model:open="runOpen" :mode="runMode" />
  </section>
</template>
