import { computed, ref, shallowRef } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { readClosesCsv } from '../domain/closesCsv'
import type { ClosesCsvReading } from '../domain/closesCsv'
import { closesImportLine, holdingsNamedBy } from '../domain/closesImport'
import type { ClosesImportLine } from '../domain/closesImport'
import { emptyPricesFile } from '../domain/pricesFile'
import type { Instrument } from '../../workbook/domain/instrument'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { usePrices } from './usePrices'

/** One file dropped, what it reads as, the holdings its name matches and the one it is for. */
export interface ClosesFileRow {
  readonly name: string
  readonly reading: ClosesCsvReading
  /** The holdings whose symbol the file is named after: one picks itself, none or two leave the pick to the person. */
  readonly matches: readonly Instrument[]
  readonly line: ClosesImportLine | null
}

export interface ClosesImport {
  readonly rows: ComputedRef<readonly ClosesFileRow[]>
  /** The lines the dry run would write, one per file read and matched. */
  readonly lines: ComputedRef<readonly ClosesImportLine[]>
  /** The holdings a file may be picked for: every one priced by a vendor, held or sold. */
  readonly holdings: ComputedRef<readonly Instrument[]>
  readonly reading: Readonly<Ref<boolean>>
  read(files: readonly File[]): Promise<void>
  /** Takes the file for the holding of this instrument id. */
  pick(fileName: string, instrumentId: string): void
  clear(): void
}

/** The files of closes dropped on the Prices tab, matched to holdings by their names, with the dry run of each against the prices file. */
export function useClosesImport(): ClosesImport {
  const { state } = useInvestmentsBooks()
  const prices = usePrices()
  const read = shallowRef<readonly { readonly name: string; readonly reading: ClosesCsvReading }[]>([])
  const picked = ref<Record<string, string>>({})
  const reading = ref(false)

  const holdings = computed(() => (state.workbook?.book.instruments ?? []).filter((instrument) => instrument.prices !== 'manual' && instrument.sourceSymbol !== ''))
  const rows = computed((): ClosesFileRow[] => {
    const book = state.workbook?.book
    const file = prices.state.copy?.file ?? emptyPricesFile()
    return read.value.map(({ name, reading: fileReading }) => {
      const matches = holdingsNamedBy(name, holdings.value)
      const chosen = holdings.value.find((instrument) => instrument.id === picked.value[name]) ?? (matches.length === 1 ? matches[0] : undefined)
      const line = book === undefined || chosen === undefined || fileReading.kind !== 'read' ? null : closesImportLine(file, book, chosen, fileReading.closes)
      return { name, reading: fileReading, matches, line }
    })
  })
  const lines = computed(() => rows.value.flatMap((row) => (row.line === null ? [] : [row.line])))

  return {
    rows,
    lines,
    holdings,
    reading,
    async read(files) {
      reading.value = true
      try {
        const texts = await Promise.all(files.map(async (file) => ({ name: file.name, reading: readClosesCsv(await file.text()) })))
        const others = read.value.filter((known) => !texts.some((text) => text.name === known.name))
        read.value = [...others, ...texts].sort((first, second) => first.name.localeCompare(second.name))
      } finally {
        reading.value = false
      }
    },
    pick(fileName, instrumentId) {
      picked.value = { ...picked.value, [fileName]: instrumentId }
    },
    clear() {
      read.value = []
      picked.value = {}
    },
  }
}
