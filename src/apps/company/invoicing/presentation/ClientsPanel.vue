<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import { planItemsOf } from '../../billingPlan/domain/planItems'
import { CLIENT_WRITES } from '../../settings/application/namedRecordWrites'
import { CLIENT_COLUMNS } from '../../settings/presentation/factTabColumns'
import FactTabCard from '../../settings/presentation/FactTabCard.vue'
import { useSettingsSave } from '../../settings/presentation/useSettingsSave'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { clientOfFields, readClients } from '../../workbook/domain/clientsReading'
import type { ClientRecord } from '../../workbook/domain/clientsReading'
import { REQUIRED_ISSUER } from '../domain/invoiceDocument'
import ClientDialog from './ClientDialog.vue'
import InvoicingTermsForm from './InvoicingTermsForm.vue'
import { words } from './words'

/** Who the company bills, and the terms the billing plan and the invoices follow. A tap on a client's row opens every field of it in one dialog. */
defineProps<{
  /** True while a link from elsewhere points at the clients, so the card opens even when this device keeps it collapsed. */
  linked: boolean
}>()

const { state } = useWorkbook()
const route = useRoute()
const { settings, saving, refused, save } = useSettingsSave()

const opened = ref('')
const dialogOpen = ref(false)

function openLabel(client: ClientRecord): string {
  return words.clients.open(client.name || client.slug)
}

function openClient(client: ClientRecord): void {
  opened.value = client.slug
  dialogOpen.value = true
}

const billingItems = computed(() => planItemsOf(state.workbook?.billingPlan ?? []))

const termsSummary = computed(() => {
  const client = settings.value.billing.client
  const billed = state.workbook?.clients.find((candidate) => candidate.slug === client)
  const missing = REQUIRED_ISSUER.filter(([field]) => settings.value.invoicing[field].trim() === '').length
  const billing = client === '' ? words.clients.noTermsClient : words.clients.billedOnTerms(billed?.name || client)
  return `${billing}. ${missing === 0 ? words.clients.allDetails : plural(words.clients.detailsMissing(missing, REQUIRED_ISSUER.length), missing)}`
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <FactTabCard
      :rules="CLIENT_WRITES"
      :title="words.clients.title"
      :description="words.clients.description"
      collapse-id="invoicing.clients"
      :columns="CLIENT_COLUMNS"
      :read="readClients"
      :make="clientOfFields"
      :saved-title="words.clients.saved"
      :reveal="linked"
      :open-label="openLabel"
      @open="openClient"
    />
    <ClientDialog v-model:open="dialogOpen" :slug="opened" />

    <AppCard
      id="invoicing-terms"
      :title="words.clients.termsTitle"
      :subtitle="words.clients.termsSubtitle"
      collapse-id="invoicing.terms"
      :summary="termsSummary"
      start-collapsed
      :reveal="route.hash === '#invoicing-terms'"
      data-testid="invoicing-terms-card"
    >
      <div class="px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
        <InvoicingTermsForm :settings="settings" :saving="saving" :refused="refused" :clients="state.workbook?.clients ?? []" :billing-items="billingItems" @save="save" />
      </div>
    </AppCard>
  </div>
</template>
