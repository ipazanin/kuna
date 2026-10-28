import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** The route the Loans first run lives on, with its step in the query. */
export const LOANS_START_ROUTE = '/loans/start'

/** Where the file lives, on its own step, then a second step for a file on Drive: the folder for a new one, or the find of one another device made. */
export type LoansStartStep = 'home' | 'folder' | 'find'

const STEPS: readonly LoansStartStep[] = ['home', 'folder', 'find']

export interface LoansStart {
  /** The step the route names, the first one for any other word, so a trip to Google comes back to the same step. */
  readonly step: ComputedRef<LoansStartStep>
  /** Moves to the step, a new entry in the history, so Back goes to the step before. */
  go(step: LoansStartStep): Promise<void>
  /** The first run is over: the Loans Overview. */
  finish(): Promise<void>
}

export function useLoansStart(): LoansStart {
  const route = useRoute()
  const router = useRouter()
  return {
    step: computed(() => STEPS.find((step) => step === route.query.step) ?? 'home'),
    async go(step) {
      await router.push(step === 'home' ? LOANS_START_ROUTE : { path: LOANS_START_ROUTE, query: { step } })
    },
    async finish() {
      await router.push('/loans')
    },
  }
}
