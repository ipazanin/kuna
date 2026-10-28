import { currentToken, requestAccess } from './googleAuth'
import type { GoogleScope } from './googleScopes'

/**
 * Runs the action once the page's token carries these scopes, asking Google first in the same tap
 * when it lacks one, as after a reload. On a phone the tab leaves for Google, and the route brings
 * the person back to the same screen to tap the action again.
 */
export async function withGoogleAccess<Result>(scopes: readonly GoogleScope[], action: () => Promise<Result>): Promise<Result> {
  if (scopes.some((scope) => currentToken(scope) === null)) {
    await requestAccess(scopes, { resume: 'none' })
  }
  return action()
}
