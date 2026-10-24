import type { StoredAccessToken } from './googleSession'

/**
 * Google's OAuth 2.0 implicit flow for client-side web apps, as a full-page redirect, for phones and
 * the installed app, where Google's popup can open unreadable. Google answers in the fragment of
 * the app's own address. https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
 */
export const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'

/** A touch screen as the main pointer, or the app installed from the browser, signs in by redirect. */
export const REDIRECT_SIGN_IN_QUERY = '(pointer: coarse), (display-mode: standalone)'

/** The sign-in kept on this device, or the Gmail or Drive read grant kept in page memory. */
export type RedirectGrant = 'sign-in' | 'gmail' | 'drive-read'

/** What the app does once back: read the chosen file again, find or pick it, or nothing, since the action that asked has to start again. */
export type RedirectResume = 'sync' | 'pick' | 'none'

/**
 * How the tab went to Google: from a tap, or with `prompt=none` for the Drive read token as the app
 * opened or as a sign-in came back. A silent answer shows no message of its own either way.
 */
export type RedirectAsk = 'tap' | 'silent-on-open' | 'silent-after-sign-in'

/** What a tab remembers while it is away at Google. `route` is the hash route to return to. */
export interface PendingRedirect {
  readonly state: string
  readonly grant: RedirectGrant
  /** On the silent Drive read ask that follows a sign-in, what the sign-in resumes once that ask is back too. */
  readonly resume: RedirectResume
  readonly route: string
  readonly ask: RedirectAsk
}

export interface AuthorizationRequest {
  readonly clientId: string
  readonly redirectUri: string
  readonly scope: string
  readonly state: string
  /** True asks for the new scope on top of those granted before, as the Gmail grant does. */
  readonly includeGrantedScopes: boolean
  readonly loginHint: string | null
  /** True sends `prompt=none`: Google shows no screen and answers with an error when it would need one. */
  readonly silent: boolean
}

/**
 * The address the tab moves to. Without `silent` there is no `prompt`, so Google asks for consent
 * only the first time. `enable_granular_consent` is left at its default, so the scopes granted have
 * to be checked.
 */
export function authorizationUrl(request: AuthorizationRequest): string {
  const query = new URLSearchParams({
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    response_type: 'token',
    scope: request.scope,
    state: request.state,
    include_granted_scopes: String(request.includeGrantedScopes),
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

/** What coming back from Google amounts to. A refusal keeps no token. */
export type RedirectReturn =
  | {
      readonly kind: 'granted'
      readonly grant: RedirectGrant
      readonly token: StoredAccessToken
      readonly resume: RedirectResume
      readonly route: string
      readonly ask: RedirectAsk
    }
  | {
      readonly kind: 'refused'
      readonly grant: RedirectGrant | null
      readonly message: string
      readonly resume: RedirectResume
      readonly route: string
      readonly ask: RedirectAsk
    }

export const GMAIL_COMPOSE = 'https://www.googleapis.com/auth/gmail.compose'

export const GMAIL_NOT_GRANTED = 'Gmail access was not granted, so no draft can be saved. Leave "Create the mail draft" off to write the mail yourself.'

/** Reads every file in Drive and changes none. The token that carries it carries nothing else. */
export const DRIVE_READONLY = 'https://www.googleapis.com/auth/drive.readonly'

export const DRIVE_READ_NOT_GRANTED = 'Drive read access was not granted, so the app cannot look for new statements in Drive.'

/** The scope a grant has to come back with, which the person can untick on the consent page, and what to say when it does not. */
const CHECKED_GRANTS: Readonly<Partial<Record<RedirectGrant, { readonly scope: string; readonly notGranted: string }>>> = {
  gmail: { scope: GMAIL_COMPOSE, notGranted: GMAIL_NOT_GRANTED },
  'drive-read': { scope: DRIVE_READONLY, notGranted: DRIVE_READ_NOT_GRANTED },
}

/**
 * Checks Google's answer against what this tab asked for: the same one-time `state`, a token that
 * lasts, and for Gmail and Drive read the scope asked for. `now` is when the tab came back, from
 * which `expires_in` counts.
 */
export function settleRedirect(fragment: RedirectFragment, pending: PendingRedirect | null, now: number): RedirectReturn {
  const route = pending !== null && pending.route.startsWith('#/') ? pending.route : '#/'
  if (pending === null || fragment.state === null || fragment.state !== pending.state) {
    return {
      kind: 'refused',
      grant: null,
      message: 'Google sent back a sign-in this tab did not ask for, so the app did not keep it. Sign in again from here.',
      resume: 'none',
      route,
      ask: 'tap',
    }
  }
  const { grant, resume, ask } = pending
  const checked = CHECKED_GRANTS[grant]
  if (fragment.kind === 'error') {
    if (checked !== undefined) {
      return { kind: 'refused', grant, message: checked.notGranted, resume, route, ask }
    }
    const message =
      fragment.error === 'access_denied'
        ? 'Google access was not allowed, so nothing was read from Google.'
        : `Google refused the token: ${fragment.error} ${fragment.description ?? ''}`.trim()
    return { kind: 'refused', grant, message, resume, route, ask }
  }
  if (!Number.isFinite(fragment.expiresIn) || fragment.expiresIn <= 0 || fragment.accessToken === '') {
    return { kind: 'refused', grant, message: 'Google sent back no usable token. Sign in again.', resume, route, ask }
  }
  if (checked !== undefined && !fragment.scope.split(' ').includes(checked.scope)) {
    return { kind: 'refused', grant, message: checked.notGranted, resume, route, ask }
  }
  const token = { value: fragment.accessToken, grantedScope: fragment.scope, expiresAt: now + fragment.expiresIn * 1000 }
  return { kind: 'granted', grant, token, resume, route, ask }
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
  const { state, grant, resume, route, ask, silent } = candidate as Record<string, unknown>
  if (typeof state !== 'string' || state === '' || typeof route !== 'string') return null
  if (grant !== 'sign-in' && grant !== 'gmail' && grant !== 'drive-read') return null
  if (resume !== 'sync' && resume !== 'pick' && resume !== 'none') return null
  if (ask === 'tap' || ask === 'silent-on-open' || ask === 'silent-after-sign-in') return { state, grant, resume, route, ask }
  // A pending redirect saved by an older copy of the app carries `silent` in place of `ask`.
  return { state, grant, resume, route, ask: silent === true ? 'silent-on-open' : 'tap' }
}

const DRIVE_READ_REFUSED_KEY = 'ledgerboard.drive-read-refused'

/**
 * Notes for this tab whether Google's last answer to a Drive read ask brought no token. It is kept
 * in session storage, so it lasts through reloads of the tab and ends with it. False when the
 * browser keeps no session storage.
 */
export function noteDriveReadRefused(refused: boolean): boolean {
  try {
    if (refused) {
      sessionStorage.setItem(DRIVE_READ_REFUSED_KEY, 'true')
    } else {
      sessionStorage.removeItem(DRIVE_READ_REFUSED_KEY)
    }
    return true
  } catch {
    return false
  }
}

/** Whether Google gave this tab no Drive read token on its last ask. True when the browser keeps no session storage, since the ask cannot be noted there. */
export function driveReadRefusedInThisTab(): boolean {
  try {
    return sessionStorage.getItem(DRIVE_READ_REFUSED_KEY) !== null
  } catch {
    return true
  }
}
