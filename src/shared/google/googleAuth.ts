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
  DRIVE_READONLY,
  DRIVE_READ_NOT_GRANTED,
  GMAIL_COMPOSE,
  GMAIL_NOT_GRANTED,
  REDIRECT_SIGN_IN_QUERY,
  authorizationUrl,
  driveReadRefusedInThisTab,
  noteDriveReadRefused,
  redirectFragmentOf,
  savePendingRedirect,
  settleRedirect,
  takePendingRedirect,
} from './googleRedirect'
import type { RedirectAsk, RedirectGrant, RedirectResume, RedirectReturn } from './googleRedirect'
import { loadScript } from './loadScript'

const IDENTITY_SERVICES_SRC = 'https://accounts.google.com/gsi/client'

/**
 * Drive access stays `drive.file`: files the user picked or the app created, nothing else.
 * `openid email` only lets the app read which account signed in, for the login hint.
 */
const SCOPES = 'https://www.googleapis.com/auth/drive.file openid email'

/** The `userinfo_endpoint` of https://accounts.google.com/.well-known/openid-configuration. */
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'

/** How long a return from a sign-in waits for the email before it goes on without it, since the page waits on it. */
const USERINFO_TIMEOUT_MS = 5_000

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
 * hash route to return to. The promise never settles, since the page goes away. Throws before the
 * tab moves when the Google variables are missing or the browser keeps no site storage.
 */
function redirectToGoogle(grant: RedirectGrant, scope: string, resume: RedirectResume, ask: RedirectAsk): Promise<never> {
  const { clientId } = googleConfig()
  const state = crypto.randomUUID()
  const silent = ask !== 'tap'
  savePendingRedirect({ state, grant, resume, route: window.location.hash.startsWith('#/') ? window.location.hash : '#/', ask })
  const url = authorizationUrl({
    clientId,
    redirectUri: `${window.location.origin}${import.meta.env.BASE_URL}`,
    scope,
    state,
    includeGrantedScopes: grant === 'gmail',
    loginHint: loadAccountEmail(),
    silent,
  })
  // The silent ask replaces the page it leaves, so Back from the app goes where the person came from instead of to a page that asks again.
  if (silent) {
    window.location.replace(url)
  } else {
    window.location.assign(url)
  }
  return new Promise<never>(() => {})
}

/**
 * Takes Google's answer from the address the tab came back to, before the router reads it: keeps
 * the token as the popup's would be kept, and puts the route the person left back in the address.
 * A first sign-in also reads the account email before it settles, so a silent ask that leaves the
 * page next carries it as the login hint. Null when the address holds no answer.
 */
export async function takeGoogleRedirect(): Promise<RedirectReturn | null> {
  const fragment = redirectFragmentOf(window.location.hash)
  if (fragment === null) {
    return null
  }
  const answer = settleRedirect(fragment, takePendingRedirect(), Date.now())
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${answer.route}`)
  if (answer.grant === 'drive-read') {
    noteDriveReadRefused(answer.kind === 'refused')
  }
  if (answer.kind === 'granted') {
    const pageToken = { value: answer.token.value, expiresAt: answer.token.expiresAt }
    switch (answer.grant) {
      case 'gmail':
        gmailToken = pageToken
        break
      case 'drive-read':
        driveReadToken = pageToken
        break
      case 'sign-in':
        await keepSignIn(answer.token)
    }
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
    return redirectToGoogle('sign-in', SCOPES, resume, 'tap')
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
  void keepSignIn(token)
  return token
}

/** Keeps the token, and reads the account email for the login hint when this device has none yet. */
function keepSignIn(token: StoredAccessToken): Promise<void> {
  const hadHint = loadAccountEmail() !== null
  saveAccessToken(token)
  return hadHint ? Promise.resolve() : rememberAccountEmail(token)
}

/** A token held in this page's memory only, never stored, so a reload starts without it. */
interface PageToken {
  readonly value: string
  /** Epoch milliseconds. */
  readonly expiresAt: number
}

let gmailToken: PageToken | null = null
let driveReadToken: PageToken | null = null

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
    return redirectToGoogle('gmail', GMAIL_COMPOSE, 'none', 'tap')
  }
  gmailToken = await tokenFromPopup(GMAIL_COMPOSE, true, 'Gmail access', GMAIL_NOT_GRANTED)
  return gmailToken.value
}

/**
 * The Drive read token of this page while it is still good. It is never stored, since it reads every
 * file in Drive, so each open of the app asks Google for it again.
 */
export function currentDriveReadToken(): string | null {
  return driveReadToken !== null && driveReadToken.expiresAt - EXPIRY_MARGIN_MS > Date.now() ? driveReadToken.value : null
}

/**
 * Whether this page can read Drive: it holds the token, it has not asked Google for one or the one it
 * had ran out, or Google gave none on this tab's last ask, so only an ask that can show Google's
 * consent screen gets one.
 */
export type DriveReadAccess = 'held' | 'not-asked' | 'needs-consent'

export function driveReadAccess(): DriveReadAccess {
  if (currentDriveReadToken() !== null) {
    return 'held'
  }
  return driveReadRefusedInThisTab() ? 'needs-consent' : 'not-asked'
}

/**
 * Moves the tab to Google for the Drive read token with `prompt=none`, so Google shows no screen and
 * sends the tab straight back: on an ordinary load, or on the load that brought a sign-in back, whose
 * resume the ask carries so it runs once the tab is back again. Returns false and stays on a load
 * that brought any other answer, when this tab's last ask brought no token, so a refusal never sends
 * it round again, or when the ask could not be noted or made.
 */
export function askForDriveReadSilently(answer: RedirectReturn | null): boolean {
  const signedIn = answer?.kind === 'granted' && answer.grant === 'sign-in' && answer.ask === 'tap'
  const ask = answer === null ? 'silent-on-open' : signedIn ? 'silent-after-sign-in' : null
  if (ask === null || driveReadRefusedInThisTab() || !noteDriveReadRefused(true)) {
    return false
  }
  try {
    void redirectToGoogle('drive-read', DRIVE_READONLY, answer?.resume ?? 'none', ask)
    return true
  } catch {
    return false
  }
}

/**
 * Asks Google for `drive.readonly` alone, with the consent screen when Google needs one. Call it from
 * a click handler, as `requestToken`. The token covers no other scope, so it can neither write the
 * Sheet nor send mail, and it stays in this page's memory only. On a phone the tab goes to Google,
 * and the sync starts by itself once back.
 */
export async function requestDriveReadToken(): Promise<string> {
  if (signsInByRedirect()) {
    return redirectToGoogle('drive-read', DRIVE_READONLY, 'sync', 'tap')
  }
  try {
    driveReadToken = await tokenFromPopup(DRIVE_READONLY, false, 'Drive read access', DRIVE_READ_NOT_GRANTED)
  } catch (failure) {
    noteDriveReadRefused(true)
    throw failure
  }
  noteDriveReadRefused(false)
  return driveReadToken.value
}

/** Asks for one scope in Google's popup, with `prompt: ''` so the consent screen shows only the first time, and checks the scope came back. */
async function tokenFromPopup(scope: string, includeGrantedScopes: boolean, access: string, notGranted: string): Promise<PageToken> {
  const { clientId } = googleConfig()
  await prepareGoogleIdentity()
  const requestedAt = Date.now()
  const loginHint = loadAccountEmail()
  return new Promise<PageToken>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      prompt: '',
      include_granted_scopes: includeGrantedScopes,
      ...(loginHint === null ? {} : { login_hint: loginHint }),
      callback: (response) => {
        if (response.error) {
          reject(new Error(`Google refused ${access}: ${response.error} ${response.error_description ?? ''}`.trim()))
          return
        }
        if (!google.accounts.oauth2.hasGrantedAllScopes(response, scope)) {
          reject(new Error(notGranted))
          return
        }
        resolve({ value: response.access_token, expiresAt: requestedAt + Number(response.expires_in) * 1000 })
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
  driveReadToken = null
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
    const response = await fetch(USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${token.value}` }, signal: AbortSignal.timeout(USERINFO_TIMEOUT_MS) })
    const claims: unknown = response.ok ? await response.json() : null
    const email = (claims as { email?: unknown } | null)?.email
    if (typeof email === 'string' && email !== '') {
      saveAccountEmail(email)
    }
  } catch {
    // The hint is a convenience. A failed read only means the chooser shows next time.
  }
}
