import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { hasSetUpAnswer, keepSetUpAnswer } from '../../../../shared/app/setUpAnswer'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { CATEGORIES_LOOK_RIGHT } from './gettingSetUp'

/** Whether someone said on this device that the categories of the books on screen look right, and how they say it. */
export function useCategoriesLookRight(): { readonly lookRight: ComputedRef<boolean>; agree(): void } {
  const { state } = useWorkbook()
  return {
    lookRight: computed(() => state.choice !== null && hasSetUpAnswer(state.choice.id, CATEGORIES_LOOK_RIGHT)),
    agree: () => {
      if (state.choice !== null) keepSetUpAnswer(state.choice.id, CATEGORIES_LOOK_RIGHT)
    },
  }
}
