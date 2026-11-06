/**
 * Why the person came: to start new books, to bring books from a file, to open books another device
 * keeps on Drive, or to move the books kept in this browser to Drive.
 */
export type OnboardingPath = 'new' | 'bring' | 'open' | 'move'

/** Where the books live. */
export type BooksHome = 'drive' | 'browser'

export type OnboardingStep = 'welcome' | 'home' | 'access' | 'file' | 'folder' | 'find' | 'company' | 'statement'

/** Where the person is in onboarding, as the route's query holds it, so a trip to Google comes back to the same step. */
export interface OnboardingPlace {
  readonly path: OnboardingPath
  readonly home: BooksHome
  /** Whether the person still has to say where files live, which the one question at the Kuna home answers for every app. */
  readonly asksHome: boolean
  readonly step: OnboardingStep
  /**
   * The id of the books this run made, so going back to the step that made them shows them made
   * instead of making a second set. Null before they are made, and always on the open and move paths.
   */
  readonly made: string | null
}

const ONBOARDING_PATHS: readonly OnboardingPath[] = ['new', 'bring', 'open', 'move']

/**
 * The steps of a path in order. Google access comes before any file is opened, so a phone that
 * leaves for Google holds nothing it could lose. Books kept in this browser never ask Google. Once
 * the person has said the files live on Drive the home step has nothing to ask, and goes. Said this
 * browser, it stays as the step that makes new books, with no question on it.
 */
export function stepsOf(path: OnboardingPath, home: BooksHome, asksHome = true): readonly OnboardingStep[] {
  const homeStep: readonly OnboardingStep[] = home === 'drive' && !asksHome ? [] : ['home']
  switch (path) {
    case 'new':
      return home === 'drive' ? ['welcome', ...homeStep, 'access', 'folder', 'company', 'statement'] : ['welcome', ...homeStep, 'company', 'statement']
    case 'bring':
      return home === 'drive' ? ['welcome', ...homeStep, 'access', 'file', 'folder', 'company'] : ['welcome', ...homeStep, 'file', 'company']
    case 'open':
      return ['welcome', 'access', 'find']
    case 'move':
      return ['access', 'folder']
  }
}

/** The books of these paths live on Drive whatever else is said, and the person's answer outweighs the query. */
function homeOf(path: OnboardingPath, home: string | null, answered: BooksHome | null): BooksHome {
  if (path === 'open' || path === 'move') return 'drive'
  return (answered ?? home) === 'browser' ? 'browser' : 'drive'
}

/**
 * The person's answer as onboarding reads it: it speaks for a run with no file open, or one on the books it made. Someone with other books open
 * came to change them, so the choice stays theirs.
 */
export function answerForRun(answer: BooksHome | null, openFile: string | null, made: unknown): BooksHome | null {
  return openFile === null || openFile === made ? answer : null
}

/** The place a route query names under the person's answer, if any, each unknown or missing word read as the first choice, and a step the path lacks as its first step. */
export function onboardingPlaceOf(query: Readonly<Record<string, unknown>>, answered: BooksHome | null = null): OnboardingPlace {
  const word = (name: string): string | null => (typeof query[name] === 'string' ? (query[name] as string) : null)
  const path = ONBOARDING_PATHS.find((candidate) => candidate === word('path')) ?? 'new'
  const home = homeOf(path, word('home'), answered)
  const asksHome = answered === null
  const steps = stepsOf(path, home, asksHome)
  const step = steps.find((candidate) => candidate === word('step')) ?? steps[0]!
  // Starting over would lose books that moved here, since this browser no longer holds them, and the open path makes none.
  const made = path === 'new' || path === 'bring' ? word('made') : null
  return { path, home, asksHome, step, made }
}

/** The route query of a place, leaving out what is the first choice anyway. */
export function onboardingQueryOf(place: OnboardingPlace): Record<string, string> {
  return {
    step: place.step,
    ...(place.path === 'new' ? {} : { path: place.path }),
    ...(place.home === 'browser' ? { home: 'browser' } : {}),
    ...(place.made === null ? {} : { made: place.made }),
  }
}

/** The step after this one on its path, or null after the last, which ends on Overview. */
export function nextStep(place: OnboardingPlace): OnboardingStep | null {
  const steps = stepsOf(place.path, place.home, place.asksHome)
  return steps[steps.indexOf(place.step) + 1] ?? null
}

/** The step whose Continue makes the books: the folder step on Drive, and in this browser the step that holds what they start from. */
export function makingStep(place: Pick<OnboardingPlace, 'path' | 'home'>): OnboardingStep {
  if (place.home === 'drive') return 'folder'
  return place.path === 'new' ? 'home' : 'file'
}

/** The step before this one on its path, or null on the first. */
export function previousStep(place: OnboardingPlace): OnboardingStep | null {
  const steps = stepsOf(place.path, place.home, place.asksHome)
  return steps[steps.indexOf(place.step) - 1] ?? null
}
