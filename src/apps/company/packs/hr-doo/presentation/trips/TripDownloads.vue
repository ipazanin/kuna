<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { filingDrive } from '../../../../documents/application/filingDrive'
import type { DriveFile } from '../../../../documents/application/driveFiling'
import { setSettings } from '../../../../settings/application/settingWrites'
import { TRIP_FOLDER_KEY } from '../../../../settings/domain/settings'
import { words as settingsWords } from '../../../../settings/domain/words'
import { useBookedWorkbook } from '../../../../transactions/application/useBookedWorkbook'
import { useWorkbook } from '../../../../workbook/application/workbookStore'
import { NO_RECORDS } from '../../../../../../shared/storage/domain/recordsRead'
import { fileTripDocuments } from '../../application/tripFiling'
import { useRates } from '../../../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../../../shared/rates/domain/ratesState'
import { downloadFile } from '../../../../../../shared/files/downloadFile'
import { XLSX_MIME_TYPE } from '../../../../../../shared/xlsx/sheetGrids'
import type { InvoicingTerms } from '../../../../settings/domain/settings'
import type { Employee } from '../../domain/employees/employees'
import type { TripFile } from '../../domain/trips/tripReading'
import { settlementOf, travellerName } from './tripsView'
import { words } from './words'

/** The order and its settlement as a PDF to sign and as an xlsx to edit, downloaded or, for books on Drive, filed there. */
const props = defineProps<{
  file: TripFile
  employees: readonly Employee[]
  /** The company as its invoices print it, which heads the order. */
  company: InvoicingTerms
}>()

const toast = useToast()
const rates = useRates()
const store = useWorkbook()
const booked = useBookedWorkbook()
const making = ref<'pdf' | 'xlsx' | 'drive' | null>(null)

function context() {
  const { company } = props
  return {
    issuer: { name: company.name, oib: company.oib, address: company.address },
    traveller: travellerName(props.file.trip.traveller, props.employees),
    place: company.place,
  }
}

async function documentOf(kind: 'pdf' | 'xlsx'): Promise<DriveFile> {
  const { tripFileName } = await import('../../infrastructure/tripDocument')
  const settlement = settlementOf(props.file, everydayRates(rates.value))
  const name = tripFileName(props.file.trip.number, kind)
  if (kind === 'pdf') {
    const [{ tripPdf }, { documentFonts }] = await Promise.all([import('../../infrastructure/tripPdf'), import('../../../../documents/infrastructure/documentFonts')])
    return { name, content: new Uint8Array(await tripPdf(props.file, settlement, context(), await documentFonts())), mimeType: 'application/pdf' }
  }
  const { tripWorkbookFile } = await import('../../infrastructure/tripWorkbookFile')
  return { name, content: await tripWorkbookFile(props.file, settlement, context()), mimeType: XLSX_MIME_TYPE }
}

async function download(kind: 'pdf' | 'xlsx'): Promise<void> {
  making.value = kind
  try {
    const document = await documentOf(kind)
    downloadFile(document.content as BlobPart, document.name, document.mimeType)
  } catch {
    toast.add({ title: words.downloads.failed, color: 'error' })
  } finally {
    making.value = null
  }
}

/** Files both on Drive, the travel orders folder picked once and kept in the settings. Run it from a click, since a Google token may need a popup. */
async function fileOnDrive(): Promise<void> {
  making.value = 'drive'
  try {
    const drive = await filingDrive()
    const kept = booked.value?.settings.tripFolderId ?? ''
    const rootId = kept === '' ? ((await drive.pickFolders(null, words.downloads.pickFolder))[0]?.id ?? null) : kept
    if (rootId === null) {
      toast.add({ title: words.downloads.noFolder, color: 'warning' })
      return
    }
    if (kept === '') {
      await store.write(settingsWords.settingSentences.tripFolderSaved, (unit) => setSettings(unit, store.state.records?.settings ?? NO_RECORDS, [{ key: TRIP_FOLDER_KEY, value: rootId }]))
    }
    const files = [await documentOf('pdf'), await documentOf('xlsx')]
    await fileTripDocuments(drive, rootId, props.file.trip, files)
    toast.add({ title: words.downloads.filed(files.map((file) => file.name)), color: 'success' })
  } catch (failure) {
    toast.add({ title: words.downloads.notFiled, description: failure instanceof Error ? failure.message : String(failure), color: 'error' })
  } finally {
    making.value = null
  }
}
</script>

<template>
  <UButton :label="words.downloads.pdf" icon="i-lucide-file-down" color="neutral" variant="outline" size="sm" :loading="making === 'pdf'" data-testid="trip-download-pdf" @click="download('pdf')" />
  <UButton :label="words.downloads.xlsx" icon="i-lucide-sheet" color="neutral" variant="outline" size="sm" :loading="making === 'xlsx'" data-testid="trip-download-xlsx" @click="download('xlsx')" />
  <UButton
    v-if="booked?.source === 'drive'"
    :label="words.downloads.toDrive"
    icon="i-lucide-hard-drive-upload"
    color="neutral"
    variant="outline"
    size="sm"
    :loading="making === 'drive'"
    data-testid="trip-file-drive"
    @click="fileOnDrive"
  />
</template>
