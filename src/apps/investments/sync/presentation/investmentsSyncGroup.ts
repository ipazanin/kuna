import { BOOKS_STEP } from '../../../../shared/sync/application/syncRun'
import type { AppSyncGroup } from '../../../../shared/sync/presentation/pageSync'
import { INVESTMENTS_SETTINGS_ROUTE } from '../../overview/presentation/investmentLinks'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import LocalInvestmentsStatus from '../../workbook/presentation/LocalInvestmentsStatus.vue'
import { PRICES_STEP } from '../../prices/presentation/usePrices'
import { PRICE_VENDORS } from '../../prices/infrastructure/vendors/priceVendors'
import { secretsNeeds, secretsStep } from '../../../../shared/secrets/presentation/secretsStep'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'

/** Whether the records price a holding through a vendor that needs a key, which another browser may hold. */
function pricedByKey(book: InvestmentBook | null): boolean {
  return book?.instruments.some((instrument) => PRICE_VENDORS.some((vendor) => vendor.needsKey && vendor.id === instrument.prices)) ?? false
}

/** The Investments part of the page's sync: its file, then the keys in the app's hidden folder, then the prices file beside it. */
export function investmentsSyncGroup(): AppSyncGroup {
  const store = useInvestmentsBooks()
  // Before the first copy the keys count as wanted, so the day's fetch has the keys another browser saved.
  const keysStep = secretsStep(() => store.state.workbook === null || pricedByKey(store.state.workbook.book))
  return {
    store,
    steps: () => [keysStep, PRICES_STEP],
    // A file in the bin or gone has no keys to carry, so it asks for no access the keys would need.
    needs: () => [...BOOKS_STEP.scopes.map((scope) => ({ scope, label: BOOKS_STEP.label })), ...(store.state.missing ? [] : secretsNeeds(() => pricedByKey(store.state.workbook?.book ?? null)))],
    undo: (write) => store.undo(write),
    exportControl: LocalInvestmentsStatus,
    fileCard: INVESTMENTS_SETTINGS_ROUTE,
  }
}
