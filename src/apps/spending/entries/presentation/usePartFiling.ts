import { computed } from 'vue'

import { pickedFilingOf } from './categoryChoices'
import { sharedCostFiling } from '../../sharedCosts/application/sharedCostWrites'
import type { FilingFields } from '../../sharedCosts/application/sharedCostWrites'
import { sharedCostOffers } from '../../sharedCosts/presentation/sharedCostNames'
import type { LineJoining } from '../../receipts/domain/receiptLines'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { language } from '../../../../shared/text/language'

/**
 * What a dialog's category pickers file a part under: the shared costs they offer beside the categories, those not settled and
 * the ones its parts are in, and each picked value read back as the category and shared cost the part takes. A Save reads
 * `filing` once, so the category In a shared cost a file lacks is the one it adds.
 */
export function usePartFiling(own: () => readonly (RecordId | null)[]) {
  const store = useSpendingBooks()
  const offers = computed(() => sharedCostOffers(store.state.workbook, own()))
  const filing = computed(() => sharedCostFiling(store.state.workbook?.categories ?? [], language))
  const joining = computed((): LineJoining => ({ sharedCosts: offers.value.map(({ sharedCost }) => sharedCost), filedIn: filing.value.filedIn }))

  /** The category and shared cost a picked value gives a part, or null when it names neither. */
  function fieldsOf(value: string): FilingFields | null {
    const picked = pickedFilingOf(value, store.state.workbook?.categories ?? [], joining.value.sharedCosts)
    return picked === null ? null : filing.value.fields(picked)
  }

  /** Whether a picked value is a shared cost. */
  function joins(value: string): boolean {
    return joining.value.sharedCosts.some((sharedCost) => sharedCost.id === value)
  }

  return { offers, filing, joining, fieldsOf, joins }
}

export type PartFiling = ReturnType<typeof usePartFiling>
