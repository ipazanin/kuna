import { ratesNeeded } from '../domain/ratesNeeded'
import { refreshRates, useRates } from './useRates'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { SyncStep } from '../../../../shared/sync/application/sync'
import { listInWords } from '../../../../shared/text/listInWords'
import { words } from './words'

const store = useSpendingBooks()
const rates = useRates()

function currencies(): string[] {
  return store.state.workbook === null ? [] : [...ratesNeeded(store.state.workbook).keys()]
}

/** The ECB rates step of the Spending sync, which asks for the rates of the foreign accounts again. It runs for a file with one, and before the file is first read. */
export const RATES_STEP: SyncStep = {
  id: 'rates',
  label: words.step.label,
  scopes: () => [],
  startLine: words.step.start,
  on: () => store.state.workbook === null || currencies().length > 0,
  async run() {
    await refreshRates()
    const state = rates.value
    return state !== 'loading' && state.failed ? { kind: 'failed', line: words.step.failed, link: null } : { kind: 'done', line: words.step.done(listInWords(currencies())), writeId: null, link: null }
  },
}
