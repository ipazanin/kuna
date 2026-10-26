/**
 * Why the person came: to start new books, to bring books from a file, to open books another device
 * keeps on Drive, or to move the books kept in this browser to Drive.
 */
export type OnboardingPath = 'new' | 'bring' | 'open' | 'move'

/** Where the books live. */
export type BooksHome = 'drive' | 'browser'

/** How the bank's statements reach the app: through Import, or from a Drive folder each sync reads. */
export type StatementsSource = 'hand' | 'folder'

export type OnboardingStep = 'welcome' | 'home' | 'access' | 'file' | 'folder' | 'find' | 'company' | 'statement'

/** Where the person is in onboarding, as the route's query holds it, so a trip to Google comes back to the same step. */
export interface OnboardingPlace {
  readonly path: OnboardingPath
  readonly home: BooksHome
  readonly statements: StatementsSource
  readonly step: OnboardingStep
}

const ONBOARDING_PATHS: readonly OnboardingPath[] = ['new', 'bring', 'open', 'move']

/**
 * The steps of a path in order. Google access comes before any file is opened, so a phone that
 * leaves for Google holds nothing it could lose. Books kept in this browser never ask Google.
 */
export function stepsOf(path: OnboardingPath, home: BooksHome): readonly OnboardingStep[] {
  switch (path) {
    case 'new':
      return home === 'drive' ? ['welcome', 'home', 'access', 'folder', 'company', 'statement'] : ['welcome', 'home', 'company', 'statement']
    case 'bring':
      return home === 'drive' ? ['welcome', 'home', 'access', 'file', 'folder', 'company'] : ['welcome', 'home', 'file', 'company']
    case 'open':
      return ['welcome', 'access', 'find']
    case 'move':
      return ['access', 'folder']
  }
}

/** The books of these paths live on Drive whatever the query says. */
function homeOf(path: OnboardingPath, home: string | null): BooksHome {
  return path === 'open' || path === 'move' || home !== 'browser' ? 'drive' : 'browser'
}

/** The place a route query names, each unknown or missing word read as the first choice, and a step the path lacks as its first step. */
export function onboardingPlaceOf(query: Readonly<Record<string, unknown>>): OnboardingPlace {
  const word = (name: string): string | null => (typeof query[name] === 'string' ? (query[name] as string) : null)
  const path = ONBOARDING_PATHS.find((candidate) => candidate === word('path')) ?? 'new'
  const home = homeOf(path, word('home'))
  const steps = stepsOf(path, home)
  const step = steps.find((candidate) => candidate === word('step')) ?? steps[0]!
  return { path, home, statements: word('statements') === 'folder' ? 'folder' : 'hand', step }
}

/** The route query of a place, leaving out what is the first choice anyway. */
export function onboardingQueryOf(place: OnboardingPlace): Record<string, string> {
  return {
    step: place.step,
    ...(place.path === 'new' ? {} : { path: place.path }),
    ...(place.home === 'browser' ? { home: 'browser' } : {}),
    ...(place.statements === 'folder' ? { statements: 'folder' } : {}),
  }
}

/** The step after this one on its path, or null after the last, which ends on Overview. */
export function nextStep(place: OnboardingPlace): OnboardingStep | null {
  const steps = stepsOf(place.path, place.home)
  return steps[steps.indexOf(place.step) + 1] ?? null
}

/** The step whose Continue makes the books: the folder step on Drive, and in this browser the step that holds what they start from. */
function makingStep(place: Pick<OnboardingPlace, 'path' | 'home'>): OnboardingStep {
  if (place.home === 'drive') return 'folder'
  return place.path === 'new' ? 'home' : 'file'
}

/** The step before this one on its path, or null on the first and after the books are made, since that step would make them again. */
export function previousStep(place: OnboardingPlace): OnboardingStep | null {
  const steps = stepsOf(place.path, place.home)
  const at = steps.indexOf(place.step)
  const making = steps.indexOf(makingStep(place))
  return making !== -1 && at > making ? null : (steps[at - 1] ?? null)
}
