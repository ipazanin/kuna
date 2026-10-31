import { computed, ref, shallowRef, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { readPortfolioWorkbookFile } from '../application/portfolioWorkbookFile'
import type { WorkbookRows } from '../domain/importDryRun'
import { ratesWanted } from '../domain/workbookRates'
import { NO_CHOICES, settledImport } from './importChoices'
import type { ImportChoices, SettledImport, SplitsAnswer } from './importChoices'
import { words } from './words'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import type { PricesFetching } from '../../prices/application/pricesUpdate'
import type { SplitsLookedUp } from '../../prices/application/splitLookup'
import { usePrices } from '../../prices/presentation/usePrices'
import { useSplitLookup } from '../../prices/presentation/useSplitLookup'
import { NO_RATES } from '../../prices/domain/rateBook'
import type { RateBook } from '../../prices/domain/rateBook'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { newRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The ECB rates a workbook's rows need, while Kuna fetches them or once the fetch left some missing. */
export type RatesFetch = { readonly kind: 'fetching' } | { readonly kind: 'failed'; readonly currencies: readonly string[]; readonly from: CivilDate }

export interface WorkbookImport {
  readonly fileName: Readonly<Ref<string>>
  readonly loading: Readonly<Ref<boolean>>
  /** Why the file picked cannot be imported, or null. */
  readonly failure: Readonly<Ref<string | null>>
  readonly reading: Readonly<Ref<WorkbookRows | null>>
  /** Null once the prices file holds every rate the rows need. */
  readonly ratesFetch: Readonly<Ref<RatesFetch | null>>
  /** The prices fetch under way, which the rates fetch counts its series in. */
  readonly fetching: ComputedRef<PricesFetching | null>
  /** The splits lookup under way, counting the symbols it has asked for. */
  readonly splitsLookup: Readonly<Ref<PricesFetching | null>>
  /** The name of the vendor splits are looked up with. */
  readonly splitVendor: string
  /** A workbook is read, every rate it needs is there and no splits lookup runs. */
  readonly ready: ComputedRef<boolean>
  /** Null until a workbook is read and the Investments file is open. */
  readonly settled: ComputedRef<SettledImport | null>
  readonly book: ComputedRef<InvestmentBook | null>
  readonly rates: ComputedRef<RateBook>
  readonly choices: Readonly<Ref<ImportChoices>>
  /** The records gone from the workbook that the person ticked to delete. */
  readonly deleting: Readonly<Ref<ReadonlySet<RecordId>>>
  load(fileName: string, bytes: () => Promise<ArrayBuffer | Uint8Array>): Promise<void>
  /** Fetches the rates the workbook read needs again, after a fetch that left some missing. */
  fetchRates(): Promise<void>
  /** Puts the file and every choice away, as a dialog opened again starts. */
  forget(): void
  choose<Part extends keyof ImportChoices>(part: Part, key: string, choice: ImportChoices[Part][string]): void
  markDeleting(record: RecordId, deleted: boolean): void
}

/**
 * One import of the portfolio workbook against the Investments file on screen: the file read, what the person chose on
 * each step, and the dry run those choices make, at the ECB rates of this browser's copy of the prices file. Rates the
 * rows need that the copy lacks are fetched first, and until they are there no step goes on, so euro rows never import
 * without the foreign rows beside them. A new file starts the choices afresh, and new accounts and holdings keep their
 * ids while it is on screen. The splits of the workbook's split rows are looked up with the vendor once per symbol
 * while the dialog is open, and a symbol a changed holding names is looked up when it comes.
 */
export function useWorkbookImport(): WorkbookImport {
  const store = useInvestmentsBooks()
  const { sources } = usePortfolio()
  const prices = usePrices()
  const splitLookup = useSplitLookup()
  const fileName = ref('')
  const loading = ref(false)
  const failure = ref<string | null>(null)
  // Shallow, so the rows and their decimals stay plain objects.
  const reading = shallowRef<WorkbookRows | null>(null)
  const ratesFetch = shallowRef<RatesFetch | null>(null)
  const splitsLookup = shallowRef<PricesFetching | null>(null)
  const lookedUp = shallowRef<ReadonlyMap<string, SplitsLookedUp>>(new Map())
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
  const ready = computed(() => reading.value !== null && ratesFetch.value === null && splitsLookup.value === null)
  const splitsOf = (symbol: string): SplitsAnswer => (!splitLookup.hasKey() ? { kind: 'no-key' } : (lookedUp.value.get(symbol) ?? { kind: 'pending' }))
  const settled = computed(() =>
    reading.value === null || ratesFetch.value !== null || book.value === null ? null : settledImport(reading.value, book.value, rates.value, choices.value, newId, splitsOf),
  )
  const symbolsToLookUp = computed(() => {
    // The splits come first, so the lookup follows them even while this browser holds no key, which is read as it is asked.
    const symbols = new Set((settled.value?.splits ?? []).flatMap((step) => (step.symbol === null || lookedUp.value.has(step.symbol) ? [] : [step.symbol])))
    return splitLookup.hasKey() ? [...symbols] : []
  })
  let lookingUp = false

  async function lookUpSplits(): Promise<void> {
    const symbols = symbolsToLookUp.value
    if (lookingUp || symbols.length === 0) return
    lookingUp = true
    try {
      const found = await splitLookup.lookUp(symbols, (asked, of) => {
        splitsLookup.value = { asked, of }
      })
      lookedUp.value = new Map([...lookedUp.value, ...symbols.map((symbol) => [symbol, found.get(symbol) ?? { kind: 'failed', reason: 'no-answer' }] as const)])
    } finally {
      lookingUp = false
      splitsLookup.value = null
    }
  }

  watch(symbolsToLookUp, () => void lookUpSplits())
  const fetching = computed(() => prices.state.fetching)

  function forget(): void {
    failure.value = null
    reading.value = null
    ratesFetch.value = null
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
    await fetchRates()
  }

  async function fetchRates(): Promise<void> {
    const read = reading.value
    const wanted = read === null ? null : ratesWanted(read.rows, rates.value)
    if (read === null || wanted === null) {
      ratesFetch.value = null
      return
    }
    ratesFetch.value = { kind: 'fetching' }
    await prices.fetchRates(wanted).catch(() => null)
    if (reading.value !== read) return
    const missing = ratesWanted(read.rows, rates.value)
    ratesFetch.value = missing === null ? null : { kind: 'failed', currencies: missing.currencies, from: missing.from }
  }

  return {
    fileName,
    loading,
    failure,
    reading,
    ratesFetch,
    splitsLookup,
    splitVendor: splitLookup.vendorName,
    fetching,
    ready,
    settled,
    book,
    rates,
    choices,
    deleting,
    load,
    fetchRates,
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
