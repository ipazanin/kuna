import { computed, onScopeDispose, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { QuotesFetched, QuotesOff } from '../application/quoteFetch'
import { usePrices } from './usePrices'
import { words } from './words'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { useSecretsChanged } from '../../../../shared/secrets/presentation/pageSecrets'
import { plural } from '../../../../shared/text/translation'

/** Which vendors a click asks depends on the hour, so the button looks again each minute while the screen is open. */
const CLOCK_MILLISECONDS = 60_000

/** Why Fetch today is off, and whether the fix is on Prices. */
export interface FetchTodayOff {
  readonly line: string
  readonly opensPrices: boolean
}

export interface FetchToday {
  /** Why the click would ask nothing, or null while it would ask a vendor. */
  readonly blocked: ComputedRef<FetchTodayOff | null>
  readonly busy: ComputedRef<boolean>
  /** What the last click left to say, such as holdings that got no price or a fetch that failed, or null. */
  readonly outcome: Readonly<Ref<string | null>>
  /** Never rejects. A fetch that fails is said in `outcome`. */
  run(): Promise<void>
}

function offLine(off: QuotesOff): string {
  switch (off.kind) {
    case 'nothing-quoted':
      return words.today.nothingQuoted
    case 'no-key':
      return words.today.noKey
    case 'before-close':
      return words.today.beforeClose(off.fromHour)
    case 'all-in':
      return words.today.allIn
  }
}

/** What a Fetch today click leaves to say: how many holdings got no price, that the fetch failed, or null when it all came in. */
export async function fetchTodayOutcome(fetch: () => Promise<QuotesFetched | 'running' | 'no-books'>): Promise<string | null> {
  try {
    const fetched = await fetch()
    return typeof fetched !== 'string' && fetched.failed > 0 ? plural(words.today.failed(fetched.failed), fetched.failed) : null
  } catch {
    return words.run.failed
  }
}

/** Fetch today on a screen: the click, whether it is under way, and why it is off when no vendor would be asked. */
export function useFetchToday(): FetchToday {
  const prices = usePrices()
  const { state } = useInvestmentsBooks()
  const keysChanged = useSecretsChanged()
  const outcome = ref<string | null>(null)
  const now = ref(Date.now())
  const clock = setInterval(() => {
    now.value = Date.now()
  }, CLOCK_MILLISECONDS)
  onScopeDispose(() => clearInterval(clock))
  const blocked = computed((): FetchTodayOff | null => {
    const book = state.workbook?.book
    if (book === undefined) {
      return { line: words.today.nothingQuoted, opensPrices: false }
    }
    void keysChanged.value
    const off = prices.quotesOff(book, new Date(now.value).toISOString())
    return off === null ? null : { line: offLine(off), opensPrices: off.kind === 'no-key' }
  })
  return {
    blocked,
    busy: computed(() => prices.state.quoting),
    outcome,
    async run() {
      outcome.value = null
      outcome.value = await fetchTodayOutcome(() => prices.fetchQuotes())
    },
  }
}
