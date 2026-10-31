import { computed, ref, shallowRef } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { readPortfolioWorkbookFile } from '../application/portfolioWorkbookFile'
import type { WorkbookRows } from '../domain/importDryRun'
import { NO_CHOICES, settledImport } from './importChoices'
import type { ImportChoices, SettledImport } from './importChoices'
import { words } from './words'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { NO_RATES } from '../../prices/domain/rateBook'
import type { RateBook } from '../../prices/domain/rateBook'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { newRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

export interface WorkbookImport {
  readonly fileName: Readonly<Ref<string>>
  readonly loading: Readonly<Ref<boolean>>
  /** Why the file picked cannot be imported, or null. */
  readonly failure: Readonly<Ref<string | null>>
  readonly reading: Readonly<Ref<WorkbookRows | null>>
  /** Null until a workbook is read and the Investments file is open. */
  readonly settled: ComputedRef<SettledImport | null>
  readonly book: ComputedRef<InvestmentBook | null>
  readonly rates: ComputedRef<RateBook>
  readonly choices: Readonly<Ref<ImportChoices>>
  /** The records gone from the workbook that the person ticked to delete. */
  readonly deleting: Readonly<Ref<ReadonlySet<RecordId>>>
  load(fileName: string, bytes: () => Promise<ArrayBuffer | Uint8Array>): Promise<void>
  /** Puts the file and every choice away, as a dialog opened again starts. */
  forget(): void
  choose<Part extends keyof ImportChoices>(part: Part, key: string, choice: ImportChoices[Part][string]): void
  markDeleting(record: RecordId, deleted: boolean): void
}

/**
 * One import of the portfolio workbook against the Investments file on screen: the file read, what the person chose on
 * each step, and the dry run those choices make, at the ECB rates of this browser's copy of the prices file. A new
 * file starts the choices afresh, and new accounts and holdings keep their ids while it is on screen.
 */
export function useWorkbookImport(): WorkbookImport {
  const store = useInvestmentsBooks()
  const { sources } = usePortfolio()
  const fileName = ref('')
  const loading = ref(false)
  const failure = ref<string | null>(null)
  // Shallow, so the rows and their decimals stay plain objects.
  const reading = shallowRef<WorkbookRows | null>(null)
  const choices = shallowRef<ImportChoices>(NO_CHOICES)
  const deleting = shallowRef<ReadonlySet<RecordId>>(new Set())
  let ids = new Map<string, string>()

  const newId = (key: string): string => {
    const id = ids.get(key) ?? newRecordId()
    ids.set(key, id)
    return id
  }

  const book = computed(() => store.state.workbook?.book ?? null)
  const rates = computed(() => sources.value?.rates ?? NO_RATES)
  const settled = computed(() => (reading.value === null || book.value === null ? null : settledImport(reading.value, book.value, rates.value, choices.value, newId)))

  function forget(): void {
    failure.value = null
    reading.value = null
    choices.value = NO_CHOICES
    deleting.value = new Set()
    ids = new Map()
    fileName.value = ''
  }

  async function load(name: string, bytes: () => Promise<ArrayBuffer | Uint8Array>): Promise<void> {
    forget()
    loading.value = true
    fileName.value = name
    try {
      const read = await readPortfolioWorkbookFile(await bytes()).catch(() => null)
      if (read === null) {
        failure.value = words.file.notSpreadsheet(name)
      } else if (read.kind === 'refused') {
        failure.value = read.refusal.kind === 'no-transactions-tab' ? words.file.noTransactionsTab(name) : words.file.missingColumns(name, read.refusal.columns.join(', '))
      } else {
        reading.value = read
      }
    } finally {
      loading.value = false
    }
  }

  return {
    fileName,
    loading,
    failure,
    reading,
    settled,
    book,
    rates,
    choices,
    deleting,
    load,
    forget,
    choose(part, key, choice) {
      choices.value = { ...choices.value, [part]: { ...choices.value[part], [key]: choice } }
    },
    markDeleting(record, deleted) {
      const next = new Set(deleting.value)
      if (deleted) next.add(record)
      else next.delete(record)
      deleting.value = next
    },
  }
}
