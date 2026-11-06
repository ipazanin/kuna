import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { withGoogleAccess } from '../../../../shared/google/withGoogleAccess'
import { hasSetUpAnswer, keepSetUpAnswer } from '../../../../shared/app/setUpAnswer'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { DELIVERY_BY_HAND } from './gettingSetUp'

/** Whether the books on screen are on Drive and nobody said on this device that statements stay by hand, and how they say it. */
export function useDeliveryOffer(): { readonly offered: ComputedRef<boolean>; readonly opened: Ref<boolean>; open(): Promise<void>; byHand(): void } {
  const { state } = useWorkbook()
  const opened = ref(false)
  return {
    opened,
    // Google is asked before the dialog opens, so a phone that leaves for Google has nothing typed to lose. It comes back here, and a second tap opens it.
    open: () =>
      withGoogleAccess(['drive.file'], async () => {
        opened.value = true
      }),
    offered: computed(() => state.choice?.source === 'drive' && !hasSetUpAnswer(state.choice.id, DELIVERY_BY_HAND)),
    byHand: () => {
      if (state.choice !== null) keepSetUpAnswer(state.choice.id, DELIVERY_BY_HAND)
    },
  }
}
