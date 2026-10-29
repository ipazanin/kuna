import { computed, shallowRef } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { WorkbookChoice } from '../../../../shared/storage/application/workbookPorts'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { ImportPreview } from '../../workbook/presentation/workbookFiles'
import { nextStep, onboardingPlaceOf, onboardingQueryOf, previousStep, stepsOf } from '../domain/onboardingSteps'
import type { OnboardingPath, OnboardingPlace, OnboardingStep } from '../domain/onboardingSteps'

/** The route onboarding lives on, with its place in the query. */
export const ONBOARDING_ROUTE = '/company/start'

/** The file brought along as books, held in page memory until the folder step keeps it, so a reload or a trip to Google drops it. */
const heldFile = shallowRef<ImportPreview | null>(null)

export interface Onboarding {
  readonly place: ComputedRef<OnboardingPlace>
  readonly steps: ComputedRef<readonly OnboardingStep[]>
  /** The books this run made, while they are the ones on screen, or null. */
  readonly madeBooks: ComputedRef<WorkbookChoice | null>
  /** The file of the bring path, once opened. */
  readonly heldFile: Readonly<Ref<ImportPreview | null>>
  hold(file: ImportPreview | null): void
  /** Moves to this place, a new entry in the history, so Back goes to the step before. */
  go(changes: Partial<OnboardingPlace>): Promise<void>
  /** Changes a choice of this step in place, without a new history entry. */
  choose(changes: Partial<OnboardingPlace>): Promise<void>
  /** The next step of the path, or Overview after the last. */
  next(): Promise<void>
  /**
   * This step made the books now on screen: its place, with these changes, and every later one name
   * them, so going back finds them made. Then the next step.
   */
  made(changes?: Partial<OnboardingPlace>): Promise<void>
  back(): Promise<void>
  /** Onboarding is over: Overview. */
  finish(): Promise<void>
}

export function useOnboarding(): Onboarding {
  const route = useRoute()
  const router = useRouter()
  const store = useWorkbook()
  const place = computed(() => onboardingPlaceOf(route.query))
  const at = (changes: Partial<OnboardingPlace>) => ({ path: ONBOARDING_ROUTE, query: onboardingQueryOf({ ...place.value, ...changes }) })

  async function go(changes: Partial<OnboardingPlace>): Promise<void> {
    await router.push(at(changes))
  }

  async function finish(): Promise<void> {
    heldFile.value = null
    await router.push('/company')
  }

  async function next(): Promise<void> {
    const step = nextStep(place.value)
    await (step === null ? finish() : go({ step }))
  }

  return {
    place,
    steps: computed(() => stepsOf(place.value.path, place.value.home)),
    madeBooks: computed(() => (store.state.choice?.id === place.value.made ? store.state.choice : null)),
    heldFile,
    hold(file) {
      heldFile.value = file
    },
    go,
    async choose(changes) {
      await router.replace(at(changes))
    },
    next,
    async made(changes = {}) {
      const books = store.state.choice
      if (books === null) return
      await router.replace(at({ ...changes, made: books.id }))
      await next()
    },
    async back() {
      const step = previousStep(place.value)
      if (step !== null) await go({ step })
    },
    finish,
  }
}

/** Where onboarding starts for a path, as a route a link or a push takes. */
export function onboardingStart(path: OnboardingPath, step?: OnboardingStep): { readonly path: string; readonly query: Record<string, string> } {
  const first = onboardingPlaceOf({ path })
  return { path: ONBOARDING_ROUTE, query: onboardingQueryOf({ ...first, step: step ?? first.step }) }
}
