import { today } from '../../../shared/calendar/civilDate'
import { folderReadScope, scopesOf } from '../../../shared/google/googleScopes'
import type { GoogleScope } from '../../../shared/google/googleScopes'
import type { OnboardingPlace } from '../domain/onboardingSteps'
import { statementSettingsOf } from '../domain/statementsChoice'

/**
 * The Google permissions onboarding asks for in its one consent: the books file always, what the
 * settings of the statements choice will need, read as the sync's steps read them, and Gmail drafts
 * for invoice drafts. A folder from My Drive needs Drive read, the folder the app makes beside the
 * books file only the books file's scope, and mail Gmail read. Opening books asks for the books file
 * alone, since only the file says what else they need. Books that move from this browser are not
 * read from choices, since they say what they need themselves.
 */
export function scopesOfChoices(place: Pick<OnboardingPlace, 'path' | 'statements' | 'mail'>, mailDrafts: boolean): GoogleScope[] {
  if (place.path !== 'new' && place.path !== 'bring') {
    return ['drive.file']
  }
  const settings = statementSettingsOf(place.statements, place.mail, today())
  return scopesOf([
    'drive.file',
    ...(settings.statementsSync ? [folderReadScope(settings.statementsFolder)] : []),
    ...(settings.statementsMailFrom.length > 0 ? (['gmail.readonly'] as const) : []),
    ...(mailDrafts ? (['gmail.compose'] as const) : []),
  ])
}
