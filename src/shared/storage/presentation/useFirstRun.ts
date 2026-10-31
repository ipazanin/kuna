import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { FileFirstRun } from './fileFirstRun'

export type FirstRunStep = 'home' | 'folder' | 'find'

const STEPS: readonly FirstRunStep[] = ['home', 'folder', 'find']

/** The moves the steps of a first run make, which their screen hands them. */
export interface FirstRunMoves {
  /** Moves to the step, a new entry in the history, so Back goes to the step before. */
  go(step: FirstRunStep): Promise<void>
  /** The step's file is on screen: the app's overview, or the next step of a first run with more steps. */
  finish(): Promise<void>
}

/** The steps of one app's first run and the moves between them. */
export interface FirstRunSteps extends FirstRunMoves {
  /** The step the route names, the first one for any other word, so a trip to Google comes back to the same step. */
  readonly step: ComputedRef<FirstRunStep>
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
