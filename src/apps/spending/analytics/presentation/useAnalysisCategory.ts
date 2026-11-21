import { computed } from 'vue'
import type { WritableComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { categoryIdNamed } from '../../overview/presentation/spendingLinks'
import type { Category } from '../../workbook/domain/category'
import { CATEGORY_RECORDS } from '../../workbook/domain/spendingKinds'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'

/** The category Over time and Year against year read, kept in `?category=` by its bare UUID. Null is all spending, which stays out of the address. */
export function useAnalysisCategory(categories: () => readonly Category[]): WritableComputedRef<Category | null> {
  const route = useRoute()
  const router = useRouter()
  return computed({
    get: () => {
      const id = categoryIdNamed(route.query.category)
      return categories().find((category) => category.id === id) ?? null
    },
    set: (picked) => {
      const { category: _left, ...others } = route.query
      void router.replace({ query: picked === null ? others : { ...others, category: keyOfRecordId(CATEGORY_RECORDS, picked.id) } })
    },
  })
}
