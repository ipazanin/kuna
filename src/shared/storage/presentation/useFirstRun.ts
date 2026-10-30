import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { FileFirstRun } from './fileFirstRun'

export type FirstRunStep = 'home' | 'folder' | 'find'

const STEPS: readonly FirstRunStep[] = ['home', 'folder', 'find']

/** The steps of one app's first run and the moves between them. */
export interface FirstRunSteps {
  /** The step the route names, the first one for any other word, so a trip to Google comes back to the same step. */
  readonly step: ComputedRef<FirstRunStep>
  /** Moves to the step, a new entry in the history, so Back goes to the step before. */
  go(step: FirstRunStep): Promise<void>
  /** The first run is over: the app's overview. */
  finish(): Promise<void>
}

/** The first run of an app's file, on its start route with the step in the query. */
export function useFirstRun({ startRoute, overviewRoute }: Pick<FileFirstRun, 'startRoute' | 'overviewRoute'>): FirstRunSteps {
  const route = useRoute()
  const router = useRouter()
  return {
    step: computed(() => STEPS.find((step) => step === route.query.step) ?? 'home'),
    async go(step) {
      await router.push(step === 'home' ? startRoute : { path: startRoute, query: { step } })
    },
    async finish() {
      await router.push(overviewRoute)
    },
  }
}
