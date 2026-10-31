<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../../shared/ui/PageTabs.vue'
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
import { words } from './words'

const TABS: readonly PageTab[] = [
  { label: words.tabs.invoices, value: 'invoices', icon: 'i-lucide-receipt-text' },
  { label: words.tabs.plan, value: 'plan', icon: 'i-lucide-calendar-clock' },
  { label: words.tabs.clients, value: 'clients', icon: 'i-lucide-users' },
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
  const invoicesTab = (hash: string) => ({ path: '/company/invoicing', hash })
  return [
    {
      label: words.tiles.next,
      value: next === null ? '–' : formatMoney(next.amount),
      caption: next === null ? words.tiles.allInvoiced : `${monthLabel(next.month)}, ${nextClient}`,
      definition: words.tiles.nextDefinition,
      to: next === null ? { path: '/company/invoicing', query: { tab: 'plan' } } : planMonthLink(next.month),
    },
    {
      label: words.tiles.outstanding,
      value: formatMoney(owed.outstanding),
      caption: owed.openCount === 0 ? words.tiles.allPaid : plural(words.tiles.open(owed.openCount), owed.openCount),
      definition: words.tiles.outstandingDefinition,
      to: invoicesTab('#invoices-card'),
    },
    {
      label: words.tiles.overdue,
      value: formatMoney(owed.overdue),
      caption: owed.overdueCount === 0 ? words.tiles.nothingLate : plural(words.tiles.late(owed.overdueCount), owed.overdueCount),
      definition: words.tiles.overdueDefinition,
      to: invoicesTab('#invoices-ageing'),
    },
    {
      label: words.tiles.daysToPaid,
      value: paid.median === null ? '–' : words.tiles.days(paid.median),
      caption: paid.median === null ? words.tiles.nonePaid : words.tiles.medianOver(paid.days.length),
      definition: words.tiles.daysDefinition,
      to: invoicesTab('#invoices-days'),
    },
  ]
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description">
      <template v-if="hasClients" #actions>
        <UButton
          :label="words.make"
          icon="i-lucide-file-plus-2"
          size="sm"
          :disabled="state.writing"
          data-testid="invoice-make"
          @click="openRun({ kind: 'new', client: billing?.expected[0]?.client ?? null })"
        />
      </template>
    </PageHeader>

    <DashboardGrid v-if="tiles" layout="tiles" data-testid="invoicing-tiles">
      <KpiTile v-for="tile in tiles" :key="tile.label" v-bind="tile" />
    </DashboardGrid>

    <PageTabs :tabs="TABS" :label="words.tabs.label" @select="clientsLinked = false">
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
