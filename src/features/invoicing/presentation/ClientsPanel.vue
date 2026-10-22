<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import AppCard from '../../../shared/ui/AppCard.vue'
import { CLIENT_ROWS } from '../../settings/application/workbookTabRows'
import { CLIENT_COLUMNS } from '../../settings/presentation/factTabColumns'
import FactTabEditor from '../../settings/presentation/FactTabEditor.vue'
import { useSettingsSave } from '../../settings/presentation/useSettingsSave'
import type { TabRowsChange } from '../../workbook/domain/rowChanges'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { readClientRows } from '../../workbook/infrastructure/workbookReader'
import { TEMPLATE_COLUMNS } from '../../workbook/infrastructure/workbookTemplate'
import { useRowWrites } from '../../workbook/presentation/useRowWrites'
import { REQUIRED_ISSUER } from '../domain/invoiceDocument'
import InvoicingTermsForm from './InvoicingTermsForm.vue'

/** Who the company bills, and the terms the billing plan and the invoices follow. */
defineProps<{
  /** True while a link from elsewhere points at the clients, so the card opens even when this device keeps it collapsed. */
  linked: boolean
}>()

const { state } = useWorkbook()
const route = useRoute()
const clientWrites = useRowWrites(CLIENT_ROWS)
const { settings, saving, save } = useSettingsSave()

const rows = computed(() => state.snapshot?.clients ?? [])
const sheetLacks = computed(() => (state.choice?.source ?? state.workbook?.source) === 'google' && (state.snapshot?.meta.missingTabs.includes('clients') ?? false))
const billingItems = computed(() => [...new Set(state.workbook?.billingPlan.map((row) => row.item) ?? [])])

const termsSummary = computed(() => {
  const client = settings.value.billing.client
  const billed = state.workbook?.clients.find((candidate) => candidate.slug === client)
  const missing = REQUIRED_ISSUER.filter(([field]) => settings.value.invoicing[field].trim() === '').length
  const billing = client === '' ? 'No client billed on terms' : `${billed?.name || client} billed on terms`
  return `${billing}. ${missing === 0 ? 'Every detail an invoice needs is set.' : `${missing} of the ${REQUIRED_ISSUER.length} details an invoice needs ${missing === 1 ? 'is' : 'are'} missing.`}`
})

function saveClients(change: TabRowsChange): void {
  void clientWrites.write(change, { title: 'Clients saved' }, 'Not saved')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <AppCard
      title="Clients"
      collapse-id="invoicing.clients"
      :summary="`${rows.length} ${rows.length === 1 ? 'client row' : 'client rows'}`"
      :reveal="linked"
    >
      <template #subtitle>
        Who pays your invoices, one row per IBAN they pay from, so a client paying from two accounts has two rows under one name.
        <span v-if="sheetLacks" class="mt-2 block text-toned">
          The Sheet has no clients tab yet. Add one named clients with these headers in row 1, then sync:
          <span class="identifier">{{ TEMPLATE_COLUMNS.clients.map((column) => column.name).join(', ') }}</span>.
        </span>
      </template>
      <FactTabEditor
        :rows="rows"
        :columns="CLIENT_COLUMNS"
        :read="readClientRows"
        :new-row="() => ({})"
        row-noun="client row"
        tab-noun="clients"
        :saving="clientWrites.busy.value || state.writing"
        @save="saveClients"
      />
    </AppCard>

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
        <InvoicingTermsForm
          :settings="settings"
          :saving="saving || state.writing"
          :clients="state.workbook?.clients ?? []"
          :billing-items="billingItems"
          @save="save"
        />
      </div>
    </AppCard>
  </div>
</template>
