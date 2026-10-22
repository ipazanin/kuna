<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import type { CivilDate } from '../../../shared/calendar/civilDate'
import { rangeContains } from '../../../shared/calendar/dateRange'
import { chartTokens } from '../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../shared/layout/viewport'
import { ZERO, addMoney, sumMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { formatWholeMoney } from '../../../shared/money/moneyFormat'
import AppCard from '../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../shared/ui/ShowAllButton.vue'
import { useFilters } from '../../filters/application/filterStore'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import type { DrillTarget } from '../../filters/domain/drillTarget'
import { periodRange } from '../../filters/domain/filterState'
import type { FilterState, Period } from '../../filters/domain/filterState'
import { periodInWords } from '../../filters/domain/periodInWords'
import DrillChartCard from '../../filters/presentation/DrillChartCard.vue'
import PeriodBar from '../../filters/presentation/PeriodBar.vue'
import { CLIENTS_LINK } from '../../invoicing/presentation/invoicingLinks'
import type { InvoiceRunMode } from '../../invoicing/presentation/useInvoiceRun'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { listedRowKey } from '../../workbook/domain/splits'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import { invoiceOrder, newestBookingOf } from '../../workbook/domain/workbook'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { ageingOf, amountsOwed, daysPastDue } from '../domain/ageing'
import { daysToPaid } from '../domain/daysToPaid'
import { RECEIVABLE_ROLES, receivablesOf } from '../domain/invoiceMatching'
import type { ClientReceivables, PaymentRow } from '../domain/invoiceMatching'
import DaysToPaidStrip from './DaysToPaidStrip.vue'
import type { DaysToPaidRow } from './DaysToPaidStrip.vue'
import InvoiceDialog from './InvoiceDialog.vue'
import InvoiceList from './InvoiceList.vue'
import type { InvoiceLine, InvoicePaymentLine } from './InvoiceList.vue'
import { ageingChart, ageingLegend } from './receivablesCharts'

/** Every invoice and what is owed on it, matched against the revenue credits client by client. */
const emit = defineEmits<{
  /** Make an invoice, or export a recorded one again. */
  run: [mode: InvoiceRunMode]
}>()

const ledger = useFilteredLedger()
const { filters: shared, setFilters, drillLocation } = useFilters()
const filters = computed(() => shared.value as FilterState)
const route = useRoute()
const router = useRouter()
const phone = usePhoneLayout()
const { state } = useWorkbook()

/** The invoice the dialog edits, or null to add one. */
const editing = ref<number | null>(null)
const dialogOpen = ref(false)

function openInvoice(sheetRow: number | null): void {
  editing.value = sheetRow
  dialogOpen.value = true
}

function reexport(sheetRow: number): void {
  dialogOpen.value = false
  emit('run', { kind: 'reexport', sheetRow })
}

const invoiceDialog = computed(() => {
  const workbook = state.workbook
  if (workbook === null) return null
  const latest = [...workbook.invoices].sort((upper, lower) => invoiceOrder(lower, upper))[0]
  return {
    clients: workbook.clients.map((client) => ({ slug: client.slug, name: client.name })),
    defaultIssued: newestBookingOf(workbook.transactions) ?? latest?.issued,
    latestNumber: latest?.number ?? '',
  }
})

const ALL_CLIENTS = 'all'
const PRESETS = ['l3', 'l12', 'year', 'all'] as const

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const decimal = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

function day(date: CivilDate): string {
  return dayFormat.format(new Date(date))
}

const period = computed({
  get: () => filters.value.period,
  set: (next: Period) => void setFilters({ ...filters.value, period: next }),
})

/** The client in view lives in the query, so a link opens the same client. */
const chosenClient = computed({
  get: () => (typeof route.query.client === 'string' ? route.query.client : ALL_CLIENTS),
  set: (client: string) => {
    const { client: _previous, ...others } = route.query
    void router.replace({ query: client === ALL_CLIENTS ? others : { ...others, client } })
  },
})

const showAllInvoices = ref(false)

function clientName(entry: ClientReceivables): string {
  return entry.client.name || entry.client.slug
}

/** The revenue rows a client paid from, which is where a figure about what it owes leads. */
function paymentsDrill(entries: readonly ClientReceivables[], revenue: readonly string[], range: { from: CivilDate; to: CivilDate } | null): DrillTarget {
  return drillToTransactions({
    period: range === null ? { preset: 'all' } : { preset: 'custom', range },
    categories: [...revenue],
    counterparties: entries.flatMap((entry) => entry.client.ibans.map((iban) => counterpartyIdentity({ counterparty: '', counterpartyIban: iban }).key)),
  })
}

const view = computed(() => {
  const current = ledger.value
  if (current === null) {
    return null
  }
  const { workbook, window } = current
  const transactions = workbook.transactions
  const receivables = receivablesOf(transactions, workbook.categories, workbook.invoices, workbook.clients)
  const revenue = workbook.categories.filter((category) => category.roles.includes(RECEIVABLE_ROLES.revenue)).map((category) => category.slug)
  const asOf = transactions.reduce((newest, transaction) => (transaction.date > newest ? transaction.date : newest), transactions[0]!.date)
  const range = periodRange(period.value, window)
  const inView = receivables.clients.filter((entry) => chosenClient.value === ALL_CLIENTS || entry.client.slug === chosenClient.value)
  const matched = inView.flatMap((entry) => entry.invoices.map((invoice) => ({ entry, invoice })))
  const everyInvoice = matched.map(({ invoice }) => invoice)
  const paid = daysToPaid(everyInvoice, range)
  const { outstanding } = amountsOwed(everyInvoice, asOf)
  const unattributed = receivables.unattributedCredits
  const unattributedTotal = sumMoney(unattributed.map((credit) => credit.transaction.amount))
  const payers = new Set(unattributed.map((credit) => counterpartyIdentity(credit.transaction).key)).size
  const tokens = chartTokens()

  const paymentLine = (prefix: string) => (allocation: { payment: PaymentRow; amount: Money }, index: number): InvoicePaymentLine => ({
    key: `${prefix}-${listedRowKey(allocation.payment.transaction)}-${index}`,
    date: day(allocation.payment.transaction.date),
    amount: allocation.amount,
    to: drillLocation(allocation.payment.drill),
  })

  const listed = matched
    .filter(({ invoice }) => invoice.remaining > 0 || range === null || rangeContains(range, invoice.invoice.issued))
    .sort((upper, lower) => invoiceOrder(lower.invoice.invoice, upper.invoice.invoice))
    .map(({ entry, invoice }): InvoiceLine => {
      const days = daysPastDue(invoice, asOf)
      const { due } = invoice.invoice
      const open = invoice.remaining > 0
      const timing =
        !open || days < 0
          ? due === null
            ? 'no due date'
            : `due ${day(due)}`
          : due === null
            ? `${days} ${days === 1 ? 'day' : 'days'} since issue`
            : days === 0
              ? 'due today'
              : `${days} ${days === 1 ? 'day' : 'days'} past due`
      return {
        key: `${entry.client.slug}-${invoice.invoice.sheetRow}`,
        sheetRow: invoice.invoice.sheetRow,
        number: invoice.invoice.number,
        client: clientName(entry),
        item: invoice.invoice.item,
        issued: day(invoice.invoice.issued),
        timing,
        late: open && due !== null && days > 0,
        amount: invoice.invoice.amount,
        remaining: invoice.remaining,
        status: invoice.status,
        received: invoice.received === null ? null : day(invoice.received),
        payments: invoice.allocations.map(paymentLine('paid')),
        overpayments: invoice.overpayments.map(paymentLine('over')),
      }
    })

  const daysRows = inView
    .filter((entry) => entry.invoices.length > 0)
    .map((entry): DaysToPaidRow => {
      const own = daysToPaid(entry.invoices, range)
      return { key: entry.client.slug, name: clientName(entry), days: own.days, median: own.median, mean: own.mean, to: drillLocation(paymentsDrill([entry], revenue, range)) }
    })

  const ageingClients = inView
    .filter((entry) => entry.outstanding > 0)
    .map((entry) => ({ name: clientName(entry), byBucket: ageingOf(entry.invoices, asOf), drill: paymentsDrill([entry], revenue, null) }))

  const sums = [
    { label: 'Overpaid by the client', amount: inView.reduce((total, entry) => addMoney(total, entry.overpaid), ZERO) },
    { label: 'Refunded to the client', amount: inView.reduce((total, entry) => addMoney(total, entry.refunded), ZERO) },
    { label: 'Paid with no invoice on file', amount: inView.reduce((total, entry) => addMoney(total, entry.creditsWithNoInvoice), ZERO) },
  ]

  return {
    hasInvoices: workbook.invoices.length > 0,
    asOf: day(asOf),
    periodText: periodInWords(period.value, window),
    window,
    clientItems: [{ label: 'All clients', value: ALL_CLIENTS }, ...receivables.clients.map((entry) => ({ label: clientName(entry), value: entry.client.slug }))],
    showClientPicker: receivables.clients.length > 1,
    showClient: inView.length > 1,
    ageing: ageingChart(ageingClients, tokens),
    ageingEmpty: ageingClients.length === 0,
    ageingLegend: ageingLegend(tokens),
    ageingHeight: Math.max(140, ageingClients.length * 48 + 56),
    daysRows,
    daysSummary:
      paid.median === null ? 'No invoice paid in the period' : `Median ${decimal.format(paid.median)} days, mean ${decimal.format(paid.mean ?? 0)} over ${paid.days.length} paid`,
    invoices: listed,
    invoicesSummary: `${listed.length} ${listed.length === 1 ? 'invoice' : 'invoices'}, ${formatWholeMoney(outstanding)} outstanding`,
    sums,
    unattributedSummary: `${formatWholeMoney(unattributedTotal)} from ${payers} ${payers === 1 ? 'payer' : 'payers'}`,
    unattributed: unattributed.map((credit) => ({
      key: listedRowKey(credit.transaction),
      date: day(credit.transaction.date),
      counterparty: credit.transaction.counterparty || 'No counterparty',
      amount: credit.transaction.amount,
      to: drillLocation(credit.drill),
    })),
  }
})

const shownInvoices = computed(() => {
  const invoices = view.value?.invoices ?? []
  return showAllInvoices.value ? invoices : invoices.slice(0, FIRST_SHOWN)
})

const noClients = computed(() => (invoiceDialog.value?.clients.length ?? 0) === 0)
</script>

<template>
  <div class="flex flex-col gap-6">
    <LedgerGate>
      <template v-if="view">
        <UEmpty
          v-if="!view.hasInvoices"
          icon="i-lucide-receipt-text"
          title="No invoices yet"
          :description="
            noClients
              ? 'Invoices are matched against the revenue credits, client by client. Add the clients first, one row per IBAN they pay from.'
              : 'Invoices are matched against the revenue credits, client by client. Make the first one with Make invoice, or record one made elsewhere.'
          "
          variant="outline"
          class="rounded-card border-dashed bg-raised/40"
          :actions="
            noClients
              ? [{ label: 'Add a client', icon: 'i-lucide-users', color: 'neutral', variant: 'outline', to: CLIENTS_LINK }]
              : [{ label: 'Record one made elsewhere', icon: 'i-lucide-plus', color: 'neutral', variant: 'outline', onClick: () => openInvoice(null) }]
          "
          data-testid="receivables-empty"
        />
        <template v-else>
          <div class="flex flex-wrap items-center gap-3" data-testid="receivables-controls">
            <PeriodBar v-model:period="period" :window="view.window" :presets="PRESETS" :stacked="phone" />
            <USelect
              v-if="view.showClientPicker"
              v-model="chosenClient"
              :items="view.clientItems"
              aria-label="Client"
              class="w-full sm:w-48"
              data-testid="client-picker"
            />
          </div>

          <div class="wide-pair">
            <AppCard
              id="invoices-card"
              title="Every invoice, with the payments that settled it"
              collapse-id="invoicing.invoices"
              :summary="view.invoicesSummary"
              :reveal="route.hash === '#invoices-card'"
              data-testid="invoices"
            >
              <template #subtitle>
                The invoices issued in {{ view.periodText }}, and every one still open. Payments fill the oldest invoice first, and only invoices already issued on
                the day a payment arrives.
              </template>
              <template #actions>
                <UButton
                  label="Record invoice"
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :disabled="state.writing || noClients"
                  :title="noClients ? 'Add the client on the Clients tab first' : 'Add the row of an invoice made elsewhere'"
                  data-testid="invoice-add"
                  @click="openInvoice(null)"
                />
              </template>
              <template #header>
                <dl class="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                  <div v-for="sum in view.sums" :key="sum.label" class="min-w-0">
                    <dt class="text-xs text-muted">{{ sum.label }}</dt>
                    <dd class="text-sm font-medium text-highlighted"><MoneyText :cents="sum.amount" precision="whole" /></dd>
                  </div>
                </dl>
              </template>
              <p v-if="view.invoices.length === 0" class="px-5 py-8 text-sm text-muted">No invoice was issued in this period, and none is open.</p>
              <template v-else>
                <div class="px-4 pt-1 pb-2 sm:px-5">
                  <InvoiceList :invoices="shownInvoices" :show-client="view.showClient" :editable="!state.writing" @edit="openInvoice" />
                </div>
                <ShowAllButton v-if="view.invoices.length > FIRST_SHOWN" v-model:expanded="showAllInvoices" :total="view.invoices.length" class="px-4 pb-4 sm:px-5" />
              </template>
            </AppCard>

            <div class="grid gap-4 xl:grid-cols-2 3xl:grid-cols-1 3xl:content-start">
              <DrillChartCard
                id="invoices-ageing"
                class="xl:col-span-2 3xl:col-span-1"
                :chart="view.ageing"
                title="What is owed, by how late it is"
                :subtitle="`On ${view.asOf}, the newest booking. Late counts from the due date, or from the issue date when an invoice has none.`"
                :empty="view.ageingEmpty"
                :height="view.ageingHeight"
              >
                <template #legend><ChartLegend :entries="view.ageingLegend" /></template>
              </DrillChartCard>

              <AppCard
                id="invoices-days"
                title="Days to get paid"
                :subtitle="`${view.periodText}. Each dot is an invoice settled in the period, the line its client’s median.`"
                collapse-id="invoicing.days"
                :summary="view.daysSummary"
                start-collapsed
                :reveal="route.hash === '#invoices-days'"
              >
                <p v-if="view.daysRows.length === 0" class="px-5 py-8 text-sm text-muted">No client has an invoice yet.</p>
                <div v-else class="overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
                  <DaysToPaidStrip :rows="view.daysRows" />
                </div>
              </AppCard>

              <AppCard
                v-if="view.unattributed.length > 0"
                title="Revenue no client accounts for"
                subtitle="From an IBAN the clients tab does not name, so it pays no invoice. Add the IBAN to the clients tab to match it."
                collapse-id="invoicing.unattributed"
                :summary="view.unattributedSummary"
                start-collapsed
                data-testid="unattributed-credits"
              >
                <ul class="flex flex-col px-4 pt-1 pb-2 sm:px-5">
                  <li v-for="credit in view.unattributed" :key="credit.key" class="credit-row">
                    <span class="figure text-xs text-muted">{{ credit.date }}</span>
                    <span class="min-w-0 truncate text-sm text-toned">{{ credit.counterparty }}</span>
                    <DrillLink :to="credit.to" :label="`Credit of ${credit.date} from ${credit.counterparty}, open the row`" class="justify-self-end">
                      <MoneyText :cents="credit.amount" precision="whole" class="text-sm font-medium text-highlighted" />
                    </DrillLink>
                  </li>
                </ul>
              </AppCard>
            </div>
          </div>
        </template>
      </template>
    </LedgerGate>
    <InvoiceDialog
      v-if="invoiceDialog && invoiceDialog.defaultIssued"
      v-model:open="dialogOpen"
      :sheet-row="editing"
      :clients="invoiceDialog.clients"
      :default-issued="invoiceDialog.defaultIssued"
      :latest-number="invoiceDialog.latestNumber"
      @reexport="reexport"
    />
  </div>
</template>

<style scoped>
.credit-row {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 0.75rem;
  padding: 0.5rem 0;
}

.credit-row + .credit-row {
  border-top: 1px solid var(--border-default);
}
</style>
