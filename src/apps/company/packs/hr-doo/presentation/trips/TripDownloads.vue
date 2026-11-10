<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { useRates } from '../../../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../../../shared/rates/domain/ratesState'
import { downloadFile } from '../../../../../../shared/files/downloadFile'
import { XLSX_MIME_TYPE } from '../../../../../../shared/xlsx/sheetGrids'
import type { InvoicingTerms } from '../../../../settings/domain/settings'
import type { Employee } from '../../domain/employees/employees'
import type { TripFile } from '../../domain/trips/tripReading'
import { settlementOf, travellerName } from './tripsView'
import { words } from './words'

/** The order and its settlement as a PDF to sign and as an xlsx to edit. */
const props = defineProps<{
  file: TripFile
  employees: readonly Employee[]
  /** The company as its invoices print it, which heads the order. */
  company: InvoicingTerms
}>()

const toast = useToast()
const rates = useRates()
const making = ref<'pdf' | 'xlsx' | null>(null)

function context() {
  const { company } = props
  return {
    issuer: { name: company.name, oib: company.vatId.replace(/\D/g, ''), address: company.address },
    traveller: travellerName(props.file.trip.traveller, props.employees),
    place: company.place,
  }
}

async function download(kind: 'pdf' | 'xlsx'): Promise<void> {
  making.value = kind
  try {
    const { tripFileName } = await import('../../infrastructure/tripDocument')
    const settlement = settlementOf(props.file, everydayRates(rates.value))
    if (kind === 'pdf') {
      const [{ tripPdf }, { documentFonts }] = await Promise.all([import('../../infrastructure/tripPdf'), import('../../../../documents/infrastructure/documentFonts')])
      downloadFile(new Uint8Array(await tripPdf(props.file, settlement, context(), await documentFonts())), tripFileName(props.file.trip.number, 'pdf'), 'application/pdf')
    } else {
      const { tripWorkbookFile } = await import('../../infrastructure/tripWorkbookFile')
      downloadFile(await tripWorkbookFile(props.file, settlement, context()), tripFileName(props.file.trip.number, 'xlsx'), XLSX_MIME_TYPE)
    }
  } catch {
    toast.add({ title: words.downloads.failed, color: 'error' })
  } finally {
    making.value = null
  }
}
</script>

<template>
  <UButton :label="words.downloads.pdf" icon="i-lucide-file-down" color="neutral" variant="outline" size="sm" :loading="making === 'pdf'" data-testid="trip-download-pdf" @click="download('pdf')" />
  <UButton :label="words.downloads.xlsx" icon="i-lucide-sheet" color="neutral" variant="outline" size="sm" :loading="making === 'xlsx'" data-testid="trip-download-xlsx" @click="download('xlsx')" />
</template>
