import { GOOGLE_SCOPES, scopeRequest, scopesIn } from './googleScopes'
import type { GoogleScope } from './googleScopes'

/**
 * Google's OAuth 2.0 implicit flow for client-side web apps, as a full-page redirect: for phones and
 * the installed app, where Google's popup can open unreadable, and for the silent trip as the app
 * opens. Google answers in the fragment of the app's own address.
 * https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
 */
export const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'

/** A touch screen as the main pointer, or the app installed from the browser, signs in by redirect. */
export const REDIRECT_SIGN_IN_QUERY = '(pointer: coarse), (display-mode: standalone)'

/**
 * What the app does once back from a tap's trip: sync, find the books by the app's mark or else in
 * the Picker, open the Picker, or nothing, for a step such as onboarding's access step that the route
 * brings back. The silent trip resumes nothing, since auto-sync carries on.
 */
export type RedirectResume = 'sync' | 'find' | 'pick' | 'none'

/** How the tab went to Google: from a tap, with Google's consent screen when it needs one, or with `prompt=none` as the app opened. */
export type RedirectAsk = 'tap' | 'silent'

/** What a tab remembers while it is away at Google. `route` is the hash route to return to. */
export interface PendingRedirect {
  readonly state: string
  /** The scopes asked for, which Google's answer is checked against. */
  readonly scopes: readonly GoogleScope[]
  readonly resume: RedirectResume
  readonly route: string
  readonly ask: RedirectAsk
}

export interface AuthorizationRequest {
  readonly clientId: string
  readonly redirectUri: string
  readonly scopes: readonly GoogleScope[]
  readonly state: string
  readonly loginHint: string | null
  /** True sends `prompt=none`: Google shows no screen and answers with an error when it would need one. */
  readonly silent: boolean
}

/**
 * The address the tab moves to. It asks for exactly these scopes, never for one granted before and
 * not asked for now. Without `silent` there is no `prompt`, so Google asks for consent only for a
 * scope not granted yet, and the person can untick any, so the scopes granted have to be read back.
 */
export function authorizationUrl(request: AuthorizationRequest): string {
  const query = new URLSearchParams({
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    response_type: 'token',
    scope: scopeRequest(request.scopes),
    state: request.state,
    include_granted_scopes: 'false',
  })
  if (request.loginHint !== null) {
    query.set('login_hint', request.loginHint)
  }
  if (request.silent) {
    query.set('prompt', 'none')
  }
  return `${AUTHORIZATION_ENDPOINT}?${query.toString()}`
}

/** Google's answer in the fragment of the address the tab came back to. */
export type RedirectFragment =
  | { readonly kind: 'token'; readonly accessToken: string; readonly expiresIn: number; readonly scope: string; readonly state: string | null }
  | { readonly kind: 'error'; readonly error: string; readonly description: string | null; readonly state: string | null }

/** Google's answer in a location hash, or null for an ordinary hash route such as `#/review`. */
export function redirectFragmentOf(hash: string): RedirectFragment | null {
  if (hash.startsWith('#/')) {
    return null
  }
  const fields = new URLSearchParams(hash.replace(/^#/, ''))
  const state = fields.get('state')
  const error = fields.get('error')
  if (error !== null) {
    return { kind: 'error', error, description: fields.get('error_description'), state }
  }
  const accessToken = fields.get('access_token')
  if (accessToken === null) {
    return null
  }
  return { kind: 'token', accessToken, expiresIn: Number(fields.get('expires_in')), scope: fields.get('scope') ?? '', state }
}

/** The one token of a page, held in memory only, with the app's scopes Google granted for it. */
export interface GoogleToken {
  readonly value: string
  readonly scopes: readonly GoogleScope[]
  /** Epoch milliseconds. */
  readonly expiresAt: number
}

/**
 * What coming back from Google amounts to. A token may carry fewer scopes than were asked for, when
 * the person unticked some. A refusal keeps no token, and `error` is Google's, such as
 * `interaction_required`, or `forged` for an answer this tab never asked for.
 */
export type RedirectReturn =
  | { readonly kind: 'granted'; readonly token: GoogleToken; readonly asked: readonly GoogleScope[]; readonly resume: RedirectResume; readonly route: string; readonly ask: RedirectAsk }
  | { readonly kind: 'refused'; readonly error: string; readonly resume: RedirectResume; readonly route: string; readonly ask: RedirectAsk }

/**
 * Checks Google's answer against what this tab asked for: the same one-time `state` and a token
 * that lasts. `now` is when the tab came back, from which `expires_in` counts.
 */
export function settleRedirect(fragment: RedirectFragment, pending: PendingRedirect | null, now: number): RedirectReturn {
  const route = pending !== null && pending.route.startsWith('#/') ? pending.route : '#/'
  if (pending === null || fragment.state === null || fragment.state !== pending.state) {
    return { kind: 'refused', error: 'forged', resume: 'none', route, ask: 'tap' }
  }
  const { scopes, resume, ask } = pending
  if (fragment.kind === 'error') {
    return { kind: 'refused', error: fragment.error, resume, route, ask }
  }
  if (!Number.isFinite(fragment.expiresIn) || fragment.expiresIn <= 0 || fragment.accessToken === '') {
    return { kind: 'refused', error: 'no-token', resume, route, ask }
  }
  const token = { value: fragment.accessToken, scopes: scopesIn(fragment.scope), expiresAt: now + fragment.expiresIn * 1000 }
  return { kind: 'granted', token, asked: scopes, resume, route, ask }
}

const PENDING_KEY = 'ledgerboard.google-redirect'

export function savePendingRedirect(pending: PendingRedirect): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  } catch {
    throw new Error('This browser keeps no site storage, so the app could not check Google\'s answer. Sign in from an ordinary window.')
  }
}

/**
 * The pending redirect, removed as it is read, so a `state` is good once. It is kept in localStorage
 * because an installed app may hand Google's page to a browser tab, which has its own session storage.
 */
export function takePendingRedirect(): PendingRedirect | null {
  let text: string | null = null
  try {
    text = localStorage.getItem(PENDING_KEY)
    localStorage.removeItem(PENDING_KEY)
  } catch {
    return null
  }
  return pendingOf(text)
}

function pendingOf(text: string | null): PendingRedirect | null {
  let candidate: unknown = null
  try {
    candidate = JSON.parse(text ?? 'null')
  } catch {
    return null
  }
  if (typeof candidate !== 'object' || candidate === null) {
    return null
  }
  const { state, scopes, resume, route, ask } = candidate as Record<string, unknown>
  if (typeof state !== 'string' || state === '' || typeof route !== 'string' || !Array.isArray(scopes)) return null
  if (resume !== 'sync' && resume !== 'find' && resume !== 'pick' && resume !== 'none') return null
  if (ask !== 'tap' && ask !== 'silent') return null
  return { state, scopes: GOOGLE_SCOPES.filter((scope) => scopes.includes(scope)), resume, route, ask }
}
