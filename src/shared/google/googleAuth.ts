import { googleConfig } from './googleConfig'
import {
  EXPIRY_MARGIN_MS,
  forgetAccessToken,
  forgetAccountEmail,
  loadAccessToken,
  loadAccountEmail,
  saveAccessToken,
  saveAccountEmail,
} from './googleSession'
import type { StoredAccessToken } from './googleSession'
import {
  GMAIL_COMPOSE,
  GMAIL_NOT_GRANTED,
  REDIRECT_SIGN_IN_QUERY,
  authorizationUrl,
  redirectFragmentOf,
  savePendingRedirect,
  settleRedirect,
  takePendingRedirect,
} from './googleRedirect'
import type { RedirectGrant, RedirectResume, RedirectReturn } from './googleRedirect'
import { loadScript } from './loadScript'

const IDENTITY_SERVICES_SRC = 'https://accounts.google.com/gsi/client'

/**
 * Drive access stays `drive.file`: files the user picked or the app created, nothing else.
 * `openid email` only lets the app read which account signed in, for the login hint.
 */
const SCOPES = 'https://www.googleapis.com/auth/drive.file openid email'

/** The `userinfo_endpoint` of https://accounts.google.com/.well-known/openid-configuration. */
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'

/** The kept token while it is still good, so a reload or a new tab syncs without a click. */
export function currentAccessToken(): StoredAccessToken | null {
  return loadAccessToken(Date.now())
}

/** Loads the GIS library ahead of a click, so the click itself can open the popup without delay. */
export function prepareGoogleIdentity(): Promise<void> {
  return loadScript(IDENTITY_SERVICES_SRC)
}

/** Whether this device signs in by moving the whole tab to Google and back, instead of in Google's popup. */
export function signsInByRedirect(): boolean {
  return window.matchMedia(REDIRECT_SIGN_IN_QUERY).matches
}

/**
 * Moves the tab to Google, remembering a one-time `state`, the grant, what to do once back and the
 * hash route to return to. The promise never settles, since the page goes away.
 */
function redirectToGoogle(grant: RedirectGrant, scope: string, resume: RedirectResume): Promise<never> {
  const state = crypto.randomUUID()
  savePendingRedirect({ state, grant, resume, route: window.location.hash.startsWith('#/') ? window.location.hash : '#/' })
  window.location.assign(
    authorizationUrl({
      clientId: googleConfig().clientId,
      redirectUri: `${window.location.origin}${import.meta.env.BASE_URL}`,
      scope,
      state,
      includeGrantedScopes: grant === 'gmail',
      loginHint: loadAccountEmail(),
    }),
  )
  return new Promise<never>(() => {})
}

/**
 * Takes Google's answer from the address the tab came back to, before the router reads it: keeps
 * the token as the popup's would be kept, and puts the route the person left back in the address.
 * Null when the address holds no answer.
 */
export function takeGoogleRedirect(): RedirectReturn | null {
  const fragment = redirectFragmentOf(window.location.hash)
  if (fragment === null) {
    return null
  }
  const answer = settleRedirect(fragment, takePendingRedirect(), Date.now())
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${answer.route}`)
  if (answer.kind === 'granted' && answer.grant === 'gmail') {
    gmailToken = { value: answer.token.value, expiresAt: answer.token.expiresAt }
  } else if (answer.kind === 'granted') {
    keepSignIn(answer.token)
  }
  return answer
}

/**
 * Asks Google for an access token. Call it from a click handler: Firefox blocks the consent popup
 * unless it opens during a user gesture. `prompt: ''` shows a popup only when Google needs one, and
 * the remembered email as the login hint skips the account chooser. The token carries only these
 * scopes, never a Gmail grant given since, because this one is kept in `localStorage`. On a phone
 * the tab goes to Google instead, and `resume` says what the app does once back.
 */
export async function requestToken(resume: RedirectResume): Promise<StoredAccessToken> {
  if (signsInByRedirect()) {
    return redirectToGoogle('sign-in', SCOPES, resume)
  }
  const { clientId } = googleConfig()
  await prepareGoogleIdentity()
  const requestedAt = Date.now()
  const loginHint = loadAccountEmail()

  const token = await new Promise<StoredAccessToken>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      prompt: '',
      include_granted_scopes: false,
      ...(loginHint === null ? {} : { login_hint: loginHint }),
      callback: (response) => {
        if (response.error) {
          reject(new Error(`Google refused the token: ${response.error} ${response.error_description ?? ''}`.trim()))
          return
        }
        resolve({ value: response.access_token, grantedScope: response.scope, expiresAt: requestedAt + Number(response.expires_in) * 1000 })
      },
      error_callback: (failure) => {
        reject(new Error(`The Google sign-in popup did not complete: ${failure.type} ${failure.message}`.trim()))
      },
    })
    client.requestAccessToken()
  })
  keepSignIn(token)
  return token
}

function keepSignIn(token: StoredAccessToken): void {
  const hadHint = loadAccountEmail() !== null
  saveAccessToken(token)
  if (!hadHint) {
    void rememberAccountEmail(token)
  }
}

let gmailToken: { readonly value: string; readonly expiresAt: number } | null = null

/** The Gmail token of this page while it is still good. It is never stored, so a reload asks again. */
export function currentGmailToken(): string | null {
  return gmailToken !== null && gmailToken.expiresAt - EXPIRY_MARGIN_MS > Date.now() ? gmailToken.value : null
}

/**
 * Asks Google for `gmail.compose` on top of what was granted, the first time with a consent popup.
 * Call it from a click handler, as `requestToken`. The token stays in this page's memory only,
 * since it can send mail as well as save drafts. On a phone the tab goes to Google, and the action
 * that asked starts again once back, with the token this new page holds.
 */
export async function requestGmailToken(): Promise<string> {
  if (signsInByRedirect()) {
    return redirectToGoogle('gmail', GMAIL_COMPOSE, 'none')
  }
  const { clientId } = googleConfig()
  await prepareGoogleIdentity()
  const requestedAt = Date.now()
  const loginHint = loadAccountEmail()
  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_COMPOSE,
      prompt: '',
      include_granted_scopes: true,
      ...(loginHint === null ? {} : { login_hint: loginHint }),
      callback: (response) => {
        if (response.error) {
          reject(new Error(`Google refused Gmail access: ${response.error} ${response.error_description ?? ''}`.trim()))
          return
        }
        if (!google.accounts.oauth2.hasGrantedAllScopes(response, GMAIL_COMPOSE)) {
          reject(new Error(GMAIL_NOT_GRANTED))
          return
        }
        gmailToken = { value: response.access_token, expiresAt: requestedAt + Number(response.expires_in) * 1000 }
        resolve(response.access_token)
      },
      error_callback: (failure) => {
        reject(new Error(`The Google popup did not complete: ${failure.type} ${failure.message}`.trim()))
      },
    })
    client.requestAccessToken()
  })
}

/** Forgets the token and the account on this device, as switching to a workbook kept here does. */
export function forgetGoogleSignIn(): void {
  forgetAccessToken()
  forgetAccountEmail()
  gmailToken = null
}

/** Revokes the app's access with Google when a token is still good, then forgets the sign-in here. */
export async function signOutOfGoogle(): Promise<void> {
  const token = currentAccessToken()
  forgetGoogleSignIn()
  if (token === null) {
    return
  }
  try {
    await prepareGoogleIdentity()
    google.accounts.oauth2.revoke(token.value, () => {})
  } catch {
    // Offline or blocked: the token is forgotten here and expires at Google within the hour.
  }
}

/**
 * The token model returns no ID token, so the email comes from the OpenID Connect userinfo
 * endpoint, read once and kept. Without it the next renewal shows the account chooser again.
 */
async function rememberAccountEmail(token: StoredAccessToken): Promise<void> {
  if (!token.grantedScope.includes('email')) {
    return
  }
  try {
    const response = await fetch(USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${token.value}` } })
    const claims: unknown = response.ok ? await response.json() : null
    const email = (claims as { email?: unknown } | null)?.email
    if (typeof email === 'string' && email !== '') {
      saveAccountEmail(email)
    }
  } catch {
    // The hint is a convenience. A failed read only means the chooser shows next time.
  }
}
