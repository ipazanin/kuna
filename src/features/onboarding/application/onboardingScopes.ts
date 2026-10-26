import type { GoogleScope } from '../../../shared/google/googleScopes'
import type { OnboardingPlace } from '../domain/onboardingSteps'

/**
 * The Google permissions onboarding asks for in its one consent: the books file always, Drive read
 * for statements from a folder, and Gmail for invoice drafts. Opening or moving books asks for the
 * books file alone, since the books say what else they need once open.
 */
export function scopesOfChoices(place: Pick<OnboardingPlace, 'path' | 'statements'>, mailDrafts: boolean): GoogleScope[] {
  const chooses = place.path === 'new' || place.path === 'bring'
  return ['drive.file', ...(chooses && place.statements === 'folder' ? (['drive.readonly'] as const) : []), ...(chooses && mailDrafts ? (['gmail.compose'] as const) : [])]
}
