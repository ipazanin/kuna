import { scopesOf } from '../../../../shared/google/googleScopes'
import type { GoogleScope } from '../../../../shared/google/googleScopes'
import type { OnboardingPlace } from '../domain/onboardingSteps'

/**
 * The Google permissions onboarding asks for in its one consent: the books file always, and Gmail
 * drafts for invoice drafts on the paths that make books. Opening books asks for the books file alone,
 * since only the file says what else they need. How statements arrive is asked after the first one.
 */
export function scopesOfChoices(place: Pick<OnboardingPlace, 'path'>, mailDrafts: boolean): GoogleScope[] {
  return scopesOf(['drive.file', ...((place.path === 'new' || place.path === 'bring') && mailDrafts ? (['gmail.compose'] as const) : [])])
}
