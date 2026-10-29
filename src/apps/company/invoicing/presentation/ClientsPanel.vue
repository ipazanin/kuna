<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import AppCard from '../../../../shared/ui/AppCard.vue'
import { CLIENT_WRITES } from '../../settings/application/namedRecordWrites'
import { CLIENT_COLUMNS } from '../../settings/presentation/factTabColumns'
import FactTabCard from '../../settings/presentation/FactTabCard.vue'
import { useSettingsSave } from '../../settings/presentation/useSettingsSave'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { clientOfFields, readClients } from '../../workbook/domain/clientsReading'
import { REQUIRED_ISSUER } from '../domain/invoiceDocument'
import InvoicingTermsForm from './InvoicingTermsForm.vue'

/** Who the company bills, and the terms the billing plan and the invoices follow. */
defineProps<{
  /** True while a link from elsewhere points at the clients, so the card opens even when this device keeps it collapsed. */
  linked: boolean
}>()

const { state } = useWorkbook()
const route = useRoute()
const { settings, saving, save } = useSettingsSave()

const billingItems = computed(() => [...new Set(state.workbook?.billingPlan.map((row) => row.item) ?? [])])

const termsSummary = computed(() => {
  const client = settings.value.billing.client
  const billed = state.workbook?.clients.find((candidate) => candidate.slug === client)
  const missing = REQUIRED_ISSUER.filter(([field]) => settings.value.invoicing[field].trim() === '').length
  const billing = client === '' ? 'No client billed on terms' : `${billed?.name || client} billed on terms`
  return `${billing}. ${missing === 0 ? 'Every detail an invoice needs is set.' : `${missing} of the ${REQUIRED_ISSUER.length} details an invoice needs ${missing === 1 ? 'is' : 'are'} missing.`}`
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <FactTabCard
      :rules="CLIENT_WRITES"
      title="Clients"
      description="Who pays your invoices, one row per client with every IBAN they pay from."
      collapse-id="invoicing.clients"
      :columns="CLIENT_COLUMNS"
      :read="readClients"
      :make="clientOfFields"
      row-noun="client"
      tab-noun="clients"
      saved-title="Clients saved"
      :reveal="linked"
    />

    <AppCard
      id="invoicing-terms"
      title="Billing and invoice terms"
      subtitle="From the settings tab. The billing plan fills its months from the terms, and every invoice prints these details."
      collapse-id="invoicing.terms"
      :summary="termsSummary"
      start-collapsed
      :reveal="route.hash === '#invoicing-terms'"
      data-testid="invoicing-terms-card"
    >
      <div class="px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
        <InvoicingTermsForm :settings="settings" :saving="saving || state.writing" :clients="state.workbook?.clients ?? []" :billing-items="billingItems" @save="save" />
      </div>
    </AppCard>
  </div>
</template>
