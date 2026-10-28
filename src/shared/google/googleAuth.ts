import { shallowRef } from 'vue'

import { googleConfig } from './googleConfig'
import { REDIRECT_SIGN_IN_QUERY, authorizationUrl, redirectFragmentOf, savePendingRedirect, settleRedirect, takePendingRedirect } from './googleRedirect'
import type { GoogleToken, RedirectAsk, RedirectResume, RedirectReturn } from './googleRedirect'
import { GOOGLE_SCOPES, NOT_GRANTED, scopeRequest, scopesIn, scopesOf } from './googleScopes'
import type { GoogleScope } from './googleScopes'
import {
  forgetGoogleDevice,
  forgetSilentRefusal,
  loadAccountEmail,
  loadGrantedScopes,
  loadNeededScopes,
  loadSilentRefusal,
  saveAccountEmail,
  saveGrantedScopes,
  saveNeededScopes,
  saveSilentRefusal,
} from './googleSession'
import { loadScript } from './loadScript'

const IDENTITY_SERVICES_SRC = 'https://accounts.google.com/gsi/client'

/** The `userinfo_endpoint` of https://accounts.google.com/.well-known/openid-configuration. */
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'

/** A token this close to its expiry counts as expired, so a sync never starts on one that lapses midway. */
const EXPIRY_MARGIN_MS = 60_000

/** The mark a silent trip leaves on the device while it is away, so a tab that comes back without Google's answer does not go round again. */
const SILENT_UNDER_WAY = 'unanswered'

/** Google's answer to a silent trip that needs a person. Firefox gives it for every silent trip, so a token from a tap does not show the trip works there. */
const INTERACTION_REQUIRED = 'interaction_required'

const STAYS_ON_PAGE = 'This page holds no Google access for this, and asking for it on a phone would leave the page. Sync or Allow access first, then try again.'

/** What a tap's ask says when Google's popup never gave an answer, by the GIS error type. */
const POPUP_FAILURES: Readonly<Record<string, string>> = {
  popup_failed_to_open: "The browser blocked Google's window.",
  popup_closed: "Google's window was closed before access was allowed.",
}

/** Where this page stands with Google. */
export interface GoogleAccess {
  /** The scopes the page's token carries, or null while it holds none. */
  readonly scopes: readonly GoogleScope[] | null
  /** Google's error for this page's last ask, or for this device's silent trip, such as `login_required`. Null once a token came. */
  readonly refusal: string | null
}

/** The one token of the page. It lives in memory only, so a reload starts without it. */
let pageToken: GoogleToken | null = null
/** The scopes the books and this device's settings need, or null before the app worked them out. */
let needed: readonly GoogleScope[] | null = loadNeededScopes()
const access = shallowRef<GoogleAccess>({ scopes: null, refusal: loadSilentRefusal() })

/** Where this page stands with Google, read reactively. */
export function googleAccess(): GoogleAccess {
  return access.value
}

/** The page's token while it is still good and carries the scope, or null. */
export function currentToken(scope: GoogleScope): string | null {
  return pageToken !== null && pageToken.scopes.includes(scope) && pageToken.expiresAt - EXPIRY_MARGIN_MS > Date.now() ? pageToken.value : null
}

/** Loads the GIS library ahead of a click, so the click itself can open the popup without delay. */
export function prepareGoogleIdentity(): Promise<void> {
  return loadScript(IDENTITY_SERVICES_SRC)
}

/** Whether this device asks Google by moving the whole tab to Google and back, instead of in Google's popup. */
export function signsInByRedirect(): boolean {
  return window.matchMedia(REDIRECT_SIGN_IN_QUERY).matches
}

/** Sets the scopes the books and this device's settings need, which every ask for a token carries, so one token serves every step. */
export function needScopes(scopes: readonly GoogleScope[]): void {
  needed = scopesOf(scopes)
  saveNeededScopes(needed)
}

/** The scopes Google granted, as each one's last ask said. Before any, the books file, since a Drive file chosen means a sign-in, and every scope in the fake build. */
function grantedScopes(): readonly GoogleScope[] {
  return loadGrantedScopes() ?? (import.meta.env.VITE_FAKE_WORKBOOK === 'true' ? GOOGLE_SCOPES : ['drive.file'])
}

/** Holds the token, notes which of the scopes asked Google granted, and reads the account email for the login hint when this device has none yet. */
function keepToken(token: GoogleToken, asked: readonly GoogleScope[], ask: RedirectAsk): void {
  pageToken = token
  access.value = { scopes: token.scopes, refusal: null }
  saveGrantedScopes([...grantedScopes().filter((scope) => !asked.includes(scope)), ...token.scopes])
  if (ask === 'silent' || loadSilentRefusal() !== INTERACTION_REQUIRED) {
    forgetSilentRefusal()
  }
  // Inline, as below. The fake build never talks to Google.
  if (import.meta.env.VITE_FAKE_WORKBOOK !== 'true' && loadAccountEmail() === null) {
    void rememberAccountEmail(token.value)
  }
}

/**
 * Moves the tab to Google, remembering a one-time `state`, the scopes, what to do once back and the
 * hash route to return to. The promise never settles, since the page goes away. Throws before the
 * tab moves when the Google variables are missing or the browser keeps no site storage.
 */
function redirectToGoogle(scopes: readonly GoogleScope[], then: RedirectResume, ask: RedirectAsk): Promise<never> {
  const { clientId } = googleConfig()
  const state = crypto.randomUUID()
  savePendingRedirect({ ...then, state, scopes, route: window.location.hash.startsWith('#/') ? window.location.hash : '#/', ask })
  const url = authorizationUrl({
    clientId,
    redirectUri: `${window.location.origin}${import.meta.env.BASE_URL}`,
    scopes,
    state,
    loginHint: loadAccountEmail(),
    silent: ask === 'silent',
  })
  // The silent trip replaces the page it leaves, so Back from the app goes where the person came from instead of to a page that asks again.
  if (ask === 'silent') {
    window.location.replace(url)
  } else {
    window.location.assign(url)
  }
  return new Promise<never>(() => {})
}

/**
 * Takes Google's answer from the address the tab came back to, before the router reads it: holds
 * the token, notes a refused silent trip on this device, and puts the route the person left back in
 * the address. Null when the address holds no answer.
 */
export function takeGoogleRedirect(): RedirectReturn | null {
  const fragment = redirectFragmentOf(window.location.hash)
  if (fragment === null) {
    return null
  }
  const answer = settleRedirect(fragment, takePendingRedirect(), Date.now())
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${answer.route}`)
  if (answer.kind === 'granted') {
    keepToken(answer.token, answer.asked, answer.ask)
  } else {
    if (answer.ask === 'silent') {
      saveSilentRefusal(answer.error)
    }
    access.value = { scopes: null, refusal: answer.error }
  }
  return answer
}

/**
 * Moves the tab to Google with `prompt=none` for the books file and every other scope Google granted
 * that the books need, so Google shows no screen and sends the tab straight back with one token. A
 * scope never granted would fail the whole trip, so a scope switched on since goes through a tap.
 * Stays, and returns false, on a device whose silent trip Google refused, so it stops going round
 * there, when Google never granted the books file, or when the trip could not be noted or made. The
 * fake build holds a made-up token for those scopes instead.
 */
export function askSilentlyOnOpen(): boolean {
  if (loadSilentRefusal() !== null) {
    return false
  }
  const scopes = scopesOf(grantedScopes().filter((scope) => scope === 'drive.file' || needed === null || needed.includes(scope)))
  if (!scopes.includes('drive.file')) {
    return false
  }
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    keepToken({ value: 'fake-token', scopes, expiresAt: Date.now() + 3_600_000 }, scopes, 'silent')
    return false
  }
  if (!saveSilentRefusal(SILENT_UNDER_WAY)) {
    return false
  }
  try {
    void redirectToGoogle(scopes, { resume: 'none' }, 'silent')
    return true
  } catch {
    forgetSilentRefusal()
    return false
  }
}

/**
 * Asks Google for one token carrying the books file, every scope the settings need and these. Call
 * it from a click handler: Firefox opens Google's popup only during a user gesture. `prompt: ''`
 * shows a screen only when Google needs one, and the remembered email as the login hint skips the
 * account chooser. On a phone the tab goes to Google instead, and `then` says what the page does
 * once back. With no `then`, a phone throws instead of leaving, since what asked could not run
 * again. Resolves once the page holds the token, which lacks any scope the person unticked.
 */
export async function requestAccess(scopes: readonly GoogleScope[], then: RedirectResume | null): Promise<void> {
  const asked = scopesOf(['drive.file', ...(needed ?? []), ...scopes])
  // Inline, not hoisted, so a production build folds the fake away. The fake build's Google grants everything asked, unless `?fake=google-closed` closes its window.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    if (new URLSearchParams(window.location.search).get('fake') === 'google-closed') {
      throw new Error(POPUP_FAILURES.popup_closed)
    }
    keepToken({ value: 'fake-token', scopes: asked, expiresAt: Date.now() + 3_600_000 }, asked, 'tap')
    return
  }
  if (signsInByRedirect()) {
    if (then === null) {
      throw new Error(STAYS_ON_PAGE)
    }
    return redirectToGoogle(asked, then, 'tap')
  }
  const { clientId } = googleConfig()
  await prepareGoogleIdentity()
  const requestedAt = Date.now()
  const loginHint = loadAccountEmail()
  const token = await new Promise<GoogleToken>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: scopeRequest(asked),
      prompt: '',
      include_granted_scopes: false,
      ...(loginHint === null ? {} : { login_hint: loginHint }),
      callback: (response) => {
        if (response.error) {
          reject(new Error(`Google refused access: ${response.error} ${response.error_description ?? ''}`.trim()))
          return
        }
        resolve({ value: response.access_token, scopes: scopesIn(response.scope), expiresAt: requestedAt + Number(response.expires_in) * 1000 })
      },
      error_callback: (failure) => {
        reject(new Error(POPUP_FAILURES[failure.type] ?? `Google's window did not finish: ${failure.type} ${failure.message}`.trim()))
      },
    })
    client.requestAccessToken()
  })
  keepToken(token, asked, 'tap')
}

/** The page's token for the scope, or a new one asked for in this click as `requestAccess` does. Throws when Google's token lacks the scope. */
export async function tokenFor(scope: GoogleScope, then: RedirectResume | null): Promise<string> {
  const held = currentToken(scope)
  if (held !== null) {
    return held
  }
  await requestAccess([scope], then)
  const token = currentToken(scope)
  if (token === null) {
    throw new Error(NOT_GRANTED[scope])
  }
  return token
}

/** Forgets the token, the account and its grants on this device, as moving the last file on Drive into this browser does. What the books need stays. */
export function forgetGoogleSignIn(): void {
  pageToken = null
  access.value = { scopes: null, refusal: null }
  forgetGoogleDevice()
}

/** Revokes the app's access with Google when the page holds a token, then forgets the sign-in here. */
export async function signOutOfGoogle(): Promise<void> {
  const token = pageToken !== null && pageToken.expiresAt > Date.now() ? pageToken.value : null
  forgetGoogleSignIn()
  if (token === null) {
    return
  }
  try {
    await prepareGoogleIdentity()
    google.accounts.oauth2.revoke(token, () => {})
  } catch {
    // Offline or blocked: the token is forgotten here and expires at Google within the hour.
  }
}

/**
 * The token model returns no ID token, so the email comes from the OpenID Connect userinfo
 * endpoint, read once and kept. Without it the next ask shows the account chooser again.
 */
async function rememberAccountEmail(token: string): Promise<void> {
  try {
    const response = await fetch(USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } })
    const claims: unknown = response.ok ? await response.json() : null
    const email = (claims as { email?: unknown } | null)?.email
    if (typeof email === 'string' && email !== '') {
      saveAccountEmail(email)
    }
  } catch {
    // The hint is a convenience. A failed read only means the chooser shows next time.
  }
}
