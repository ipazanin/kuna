import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { BANK_PRESETS } from '../../mail/domain/bankPresets'

/**
 * Why the person came: to start new books, to bring books from a file, to open books another device
 * keeps on Drive, or to move the books kept in this browser to Drive.
 */
export type OnboardingPath = 'new' | 'bring' | 'open' | 'move'

/** Where the books live. */
export type BooksHome = 'drive' | 'browser'

/** How the bank's statements reach the app: through Import, from the bank's mail each sync files, or from a Drive folder each sync reads. */
export type StatementsSource = 'hand' | 'mail' | 'folder'

/** The bank named for any bank without a preset, whose sender and subject words are typed in. */
export const OTHER_BANK = 'other'

/**
 * The bank's mail statements come from: a preset by its id, or another bank with its sender and
 * subject words as typed, and the earliest day a sync reads, null for the first day of this year.
 */
export interface StatementMail {
  readonly bank: string
  readonly from: string
  readonly subject: string
  readonly since: CivilDate | null
}

export type OnboardingStep = 'welcome' | 'home' | 'access' | 'file' | 'folder' | 'find' | 'company' | 'statement'

/** Where the person is in onboarding, as the route's query holds it, so a trip to Google comes back to the same step. */
export interface OnboardingPlace {
  readonly path: OnboardingPath
  readonly home: BooksHome
  readonly statements: StatementsSource
  /** Read only while statements come from mail. */
  readonly mail: StatementMail
  readonly step: OnboardingStep
}

const FIRST_BANK = BANK_PRESETS[0]!.id

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

/** Whether statements can come from mail on this path: only for new books on Drive, since books brought along carry their own mail settings. */
export function offersMail(place: Pick<OnboardingPlace, 'path' | 'home'>): boolean {
  return place.path === 'new' && place.home === 'drive'
}

/** How statements come on the path, as the query names it. Mail where the path does not offer it comes by hand. */
function statementsOf(place: Pick<OnboardingPlace, 'path' | 'home'>, word: string | null): StatementsSource {
  if (word === 'folder') return 'folder'
  return word === 'mail' && offersMail(place) ? 'mail' : 'hand'
}

/** The place a route query names, each unknown or missing word read as the first choice, and a step the path lacks as its first step. */
export function onboardingPlaceOf(query: Readonly<Record<string, unknown>>): OnboardingPlace {
  const word = (name: string): string | null => (typeof query[name] === 'string' ? (query[name] as string) : null)
  const path = ONBOARDING_PATHS.find((candidate) => candidate === word('path')) ?? 'new'
  const home = homeOf(path, word('home'))
  const steps = stepsOf(path, home)
  const step = steps.find((candidate) => candidate === word('step')) ?? steps[0]!
  const bank = word('bank') === OTHER_BANK ? OTHER_BANK : (BANK_PRESETS.find((preset) => preset.id === word('bank'))?.id ?? FIRST_BANK)
  const mail: StatementMail = {
    bank,
    from: word('from') ?? '',
    subject: word('subject') ?? '',
    since: parseCivilDate(word('since') ?? ''),
  }
  return { path, home, statements: statementsOf({ path, home }, word('statements')), mail, step }
}

/** The route query of a place, leaving out what is the first choice anyway. The mail stays while another choice is made, so a switch back finds what was typed. */
export function onboardingQueryOf(place: OnboardingPlace): Record<string, string> {
  const { bank, from, subject, since } = place.mail
  return {
    step: place.step,
    ...(place.path === 'new' ? {} : { path: place.path }),
    ...(place.home === 'browser' ? { home: 'browser' } : {}),
    ...(place.statements === 'hand' ? {} : { statements: place.statements }),
    ...(bank === FIRST_BANK ? {} : { bank }),
    ...(from === '' ? {} : { from }),
    ...(subject === '' ? {} : { subject }),
    ...(since === null ? {} : { since }),
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
