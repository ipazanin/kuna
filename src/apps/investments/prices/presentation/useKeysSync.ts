import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

import { syncVendorKeys } from '../application/keysSync'
import type { KeysDrive } from '../application/pricesPorts'
import type { VendorKeyChanges } from '../domain/keysFile'
import { googleKeysDrive } from '../infrastructure/googleKeysDrive'
import { keepKeyChanges, storeVendorKey, storedKeyChanges, storedVendorKey } from '../infrastructure/vendorKeys'
import { PRICE_VENDORS } from '../infrastructure/vendors/priceVendors'
import { INVESTMENTS_PRICES_ROUTE } from '../../overview/presentation/investmentLinks'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { SyncStep } from '../../../../shared/sync/application/sync'
import type { AccessNeed } from '../../../../shared/sync/application/syncRun'
import type { VendorKeyStore } from './useVendorKeys'
import { words } from './words'

const store = useInvestmentsBooks()
const VENDOR_IDS = PRICE_VENDORS.filter((vendor) => vendor.needsKey).map((vendor) => vendor.id)

/** Bumped whenever this page changes a key in this browser, by the card or by a sync, so what shows the keys reads them again. */
const changed = ref(0)

/** This browser's keys as the page changes them, reactively. */
function keysHere(): VendorKeyChanges {
  void changed.value
  return storedKeyChanges(VENDOR_IDS)
}

/** The keys the Prices card saves and removes in this browser, each with the time of the change. */
export const PAGE_KEY_STORE: VendorKeyStore = {
  read: storedVendorKey,
  write(vendorId, key) {
    storeVendorKey(vendorId, key, new Date().toISOString())
    changed.value += 1
  },
}

/** Counts each change of a key on this page, for what shows the keys to read them again. */
export function useKeysChanged(): Readonly<Ref<number>> {
  return readonly(changed)
}

/** Whether the sync has keys to carry: this browser saved or removed one, or the records price a holding through a vendor that needs a key, which another browser may hold. */
export function keysToSync(book: InvestmentBook | null): boolean {
  if (Object.keys(keysHere()).length > 0) {
    return true
  }
  return book?.instruments.some((instrument) => PRICE_VENDORS.some((vendor) => vendor.needsKey && vendor.id === instrument.prices)) ?? false
}

/** What the Investments file on Drive needs of Google for its keys, by the step that needs it. */
export function keysNeeds(book: InvestmentBook | null): AccessNeed[] {
  return keysToSync(book) ? [{ scope: 'drive.appdata', label: words.keysStep.label }] : []
}

async function keysDrive(): Promise<KeysDrive> {
  // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeKeysDrive } = await import('../infrastructure/fake/fakeKeysDrive')
    return fakeKeysDrive()
  }
  return googleKeysDrive()
}

/** The Keys step of the Investments sync, after the file and before the prices, so the day's fetch has the keys another browser saved. */
export const KEYS_STEP: SyncStep = {
  id: 'keys',
  label: words.keysStep.label,
  scopes: () => ['drive.appdata'],
  startLine: words.keysStep.reading,
  on: () => store.state.workbook === null || keysToSync(store.state.workbook.book),
  async run() {
    const choice = store.state.choice
    if (choice?.source !== 'drive') {
      return { kind: 'done', line: words.keysStep.unchanged, writeId: null, link: null }
    }
    const result = await syncVendorKeys(
      {
        drive: await keysDrive(),
        vendorIds: VENDOR_IDS,
        here: () => storedKeyChanges(VENDOR_IDS),
        keep(changes) {
          keepKeyChanges(changes)
          changed.value += 1
        },
      },
      choice.id,
    )
    if (result.kind === 'refused') {
      return { kind: 'failed', line: words.keysRefused[result.reason], link: { label: words.step.settings, to: INVESTMENTS_PRICES_ROUTE } }
    }
    return { kind: 'done', line: words.keysStep[result.kind], writeId: null, link: null }
  },
}
