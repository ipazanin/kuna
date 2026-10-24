// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  askForDriveReadSilently,
  currentAccessToken,
  currentDriveReadToken,
  currentGmailToken,
  driveReadAccess,
  forgetGoogleSignIn,
  signsInByRedirect,
  takeGoogleRedirect,
} from '../src/shared/google/googleAuth'
import {
  DRIVE_READONLY,
  DRIVE_READ_NOT_GRANTED,
  GMAIL_COMPOSE,
  GMAIL_NOT_GRANTED,
  REDIRECT_SIGN_IN_QUERY,
  authorizationUrl,
  redirectFragmentOf,
  savePendingRedirect,
  settleRedirect,
  takePendingRedirect,
} from '../src/shared/google/googleRedirect'
import type { PendingRedirect, RedirectReturn } from '../src/shared/google/googleRedirect'
import { loadAccessToken, loadAccountEmail } from '../src/shared/google/googleSession'

const SIGN_IN_SCOPE = 'https://www.googleapis.com/auth/drive.file openid email'
const PENDING: PendingRedirect = { state: 'one-time-state', grant: 'sign-in', resume: 'sync', route: '#/review?tab=rules', ask: 'tap' }
const SILENT_DRIVE_READ: PendingRedirect = { ...PENDING, grant: 'drive-read', resume: 'none', route: '#/', ask: 'silent-on-open' }
const BACK_AT = Date.parse('2026-10-21T09:00:00.000Z')

afterEach(() => {
  forgetGoogleSignIn()
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState(null, '', '/ledgerboard/')
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/** Loads the app as Google sends the tab back to it with this fragment. */
function comeBackWith(fragment: string): void {
  window.history.replaceState(null, '', `/ledgerboard/#${fragment}`)
}

describe('the address the tab goes to', () => {
  it('asks Google for a token in the fragment of the app address, with the state and the login hint', () => {
    const url = new URL(
      authorizationUrl({
        clientId: 'client.apps.googleusercontent.com',
        redirectUri: 'https://ipazanin.github.io/ledgerboard/',
        scope: SIGN_IN_SCOPE,
        state: 'one-time-state',
        includeGrantedScopes: false,
        loginHint: 'owner@example.com',
        silent: false,
      }),
    )

    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client.apps.googleusercontent.com',
      redirect_uri: 'https://ipazanin.github.io/ledgerboard/',
      response_type: 'token',
      scope: SIGN_IN_SCOPE,
      state: 'one-time-state',
      include_granted_scopes: 'false',
      login_hint: 'owner@example.com',
    })
  })

  it('leaves the login hint out when no account is remembered, and adds Gmail on top of what was granted', () => {
    const url = new URL(
      authorizationUrl({
        clientId: 'client',
        redirectUri: 'http://localhost:5173/ledgerboard/',
        scope: GMAIL_COMPOSE,
        state: 's',
        includeGrantedScopes: true,
        loginHint: null,
        silent: false,
      }),
    )

    expect(url.searchParams.has('login_hint')).toBe(false)
    expect(url.searchParams.get('include_granted_scopes')).toBe('true')
    expect(url.searchParams.has('prompt')).toBe(false)
  })

  it('asks for Drive read alone with no screen at Google when the ask is silent', () => {
    const url = new URL(
      authorizationUrl({
        clientId: 'client',
        redirectUri: 'https://ipazanin.github.io/ledgerboard/',
        scope: DRIVE_READONLY,
        state: 's',
        includeGrantedScopes: false,
        loginHint: 'owner@example.com',
        silent: true,
      }),
    )

    expect(url.searchParams.get('scope')).toBe(DRIVE_READONLY)
    expect(url.searchParams.get('include_granted_scopes')).toBe('false')
    expect(url.searchParams.get('prompt')).toBe('none')
  })
})

describe('which devices sign in by redirect', () => {
  it('asks the browser about a coarse pointer or the installed app', () => {
    const asked: string[] = []
    vi.stubGlobal('matchMedia', (query: string) => {
      asked.push(query)
      return { matches: true }
    })

    expect(signsInByRedirect()).toBe(true)
    expect(asked).toEqual([REDIRECT_SIGN_IN_QUERY])
    expect(REDIRECT_SIGN_IN_QUERY).toBe('(pointer: coarse), (display-mode: standalone)')
  })

  it('keeps the popup on a desktop with a mouse in a browser tab', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))

    expect(signsInByRedirect()).toBe(false)
  })
})

describe('reading the fragment', () => {
  it('reads a token, its lifetime, its scopes and the state', () => {
    const fragment = redirectFragmentOf(`#access_token=ya29.a0&token_type=Bearer&expires_in=3599&scope=${encodeURIComponent(SIGN_IN_SCOPE)}&state=one-time-state`)

    expect(fragment).toEqual({ kind: 'token', accessToken: 'ya29.a0', expiresIn: 3599, scope: SIGN_IN_SCOPE, state: 'one-time-state' })
  })

  it('reads an error with its description', () => {
    expect(redirectFragmentOf('#error=access_denied&state=one-time-state')).toEqual({ kind: 'error', error: 'access_denied', description: null, state: 'one-time-state' })
    expect(redirectFragmentOf('#error=invalid_request&error_description=Missing+scope')).toEqual({
      kind: 'error',
      error: 'invalid_request',
      description: 'Missing scope',
      state: null,
    })
  })

  it('leaves an ordinary hash route, an empty hash and an unrelated anchor alone', () => {
    expect(redirectFragmentOf('#/review?tab=rules')).toBeNull()
    expect(redirectFragmentOf('')).toBeNull()
    expect(redirectFragmentOf('#billing-month-2026-10')).toBeNull()
  })
})

describe('checking the answer against the request', () => {
  const token = { kind: 'token', accessToken: 'ya29.a0', expiresIn: 3599, scope: SIGN_IN_SCOPE, state: 'one-time-state' } as const

  it('keeps a token whose state matches, counting its lifetime from the return, and goes back to the route left', () => {
    expect(settleRedirect(token, PENDING, BACK_AT)).toEqual({
      kind: 'granted',
      grant: 'sign-in',
      token: { value: 'ya29.a0', grantedScope: SIGN_IN_SCOPE, expiresAt: BACK_AT + 3_599_000 },
      resume: 'sync',
      route: '#/review?tab=rules',
      ask: 'tap',
    })
  })

  it('refuses a token with another state, with no state, or that this tab never asked for', () => {
    for (const [fragment, pending] of [
      [{ ...token, state: 'forged' }, PENDING],
      [{ ...token, state: null }, PENDING],
      [token, null],
    ] as const) {
      const answer = settleRedirect(fragment, pending, BACK_AT)
      expect(answer.kind).toBe('refused')
      expect(answer).not.toHaveProperty('token')
      expect(answer.kind === 'refused' && answer.message).toContain('did not ask for')
    }
  })

  it('goes to the start when the tab never asked, and to the route left otherwise', () => {
    expect(settleRedirect({ ...token, state: 'forged' }, PENDING, BACK_AT).route).toBe('#/review?tab=rules')
    expect(settleRedirect(token, null, BACK_AT).route).toBe('#/')
  })

  it('says why on an error from Google', () => {
    const denied = settleRedirect({ kind: 'error', error: 'access_denied', description: null, state: 'one-time-state' }, PENDING, BACK_AT)
    const other = settleRedirect({ kind: 'error', error: 'invalid_scope', description: 'Bad scope', state: 'one-time-state' }, PENDING, BACK_AT)

    expect(denied).toMatchObject({ kind: 'refused', grant: 'sign-in', message: 'Google access was not allowed, so nothing was read from Google.' })
    expect(other).toMatchObject({ kind: 'refused', message: 'Google refused the token: invalid_scope Bad scope' })
  })

  it('refuses a Gmail grant when the person unticked Gmail or denied it', () => {
    const gmail: PendingRedirect = { ...PENDING, grant: 'gmail', resume: 'none' }

    expect(settleRedirect(token, gmail, BACK_AT)).toMatchObject({ kind: 'refused', grant: 'gmail', message: GMAIL_NOT_GRANTED })
    expect(settleRedirect({ kind: 'error', error: 'access_denied', description: null, state: 'one-time-state' }, gmail, BACK_AT)).toMatchObject({ message: GMAIL_NOT_GRANTED })
    expect(settleRedirect({ ...token, scope: `${SIGN_IN_SCOPE} ${GMAIL_COMPOSE}` }, gmail, BACK_AT)).toMatchObject({ kind: 'granted', grant: 'gmail' })
  })

  it('refuses a Drive read token that does not carry drive.readonly, and keeps one that does', () => {
    const driveRead: PendingRedirect = { ...PENDING, grant: 'drive-read' }

    expect(settleRedirect(token, driveRead, BACK_AT)).toMatchObject({ kind: 'refused', grant: 'drive-read', message: DRIVE_READ_NOT_GRANTED })
    expect(settleRedirect({ ...token, scope: DRIVE_READONLY }, driveRead, BACK_AT)).toMatchObject({ kind: 'granted', grant: 'drive-read' })
  })

  it('tells a silent ask from one the person made, whatever Google answers', () => {
    const consentRequired = { kind: 'error', error: 'consent_required', description: null, state: 'one-time-state' } as const

    expect(settleRedirect(consentRequired, SILENT_DRIVE_READ, BACK_AT)).toMatchObject({ kind: 'refused', grant: 'drive-read', ask: 'silent-on-open' })
    expect(settleRedirect({ ...token, scope: DRIVE_READONLY }, SILENT_DRIVE_READ, BACK_AT)).toMatchObject({ kind: 'granted', ask: 'silent-on-open' })
    expect(settleRedirect(consentRequired, { ...SILENT_DRIVE_READ, ask: 'tap' }, BACK_AT)).toMatchObject({ ask: 'tap' })
  })

  it('carries what a sign-in resumes through the silent ask after it, whatever Google answers', () => {
    const afterSignIn: PendingRedirect = { ...PENDING, grant: 'drive-read', ask: 'silent-after-sign-in' }
    const consentRequired = { kind: 'error', error: 'consent_required', description: null, state: 'one-time-state' } as const

    expect(settleRedirect(consentRequired, afterSignIn, BACK_AT)).toMatchObject({ kind: 'refused', resume: 'sync', route: '#/review?tab=rules', ask: 'silent-after-sign-in' })
    expect(settleRedirect({ ...token, scope: DRIVE_READONLY }, afterSignIn, BACK_AT)).toMatchObject({ kind: 'granted', resume: 'sync', ask: 'silent-after-sign-in' })
  })

  it('refuses a token with no usable lifetime', () => {
    expect(settleRedirect({ ...token, expiresIn: Number.NaN }, PENDING, BACK_AT).kind).toBe('refused')
  })
})

describe('the pending redirect', () => {
  it('is good once', () => {
    savePendingRedirect(PENDING)

    expect(takePendingRedirect()).toEqual(PENDING)
    expect(takePendingRedirect()).toBeNull()
  })

  it('remembers a silent Drive read ask', () => {
    savePendingRedirect(SILENT_DRIVE_READ)

    expect(takePendingRedirect()).toEqual(SILENT_DRIVE_READ)
  })

  it('reads one an older copy of the app saved with its silent flag, one with no flag as asked by a tap, and refuses an unknown grant', () => {
    localStorage.setItem('ledgerboard.google-redirect', JSON.stringify({ state: 's', grant: 'drive-read', resume: 'none', route: '#/', silent: true }))
    expect(takePendingRedirect()).toEqual({ state: 's', grant: 'drive-read', resume: 'none', route: '#/', ask: 'silent-on-open' })

    localStorage.setItem('ledgerboard.google-redirect', JSON.stringify({ state: 's', grant: 'drive-read', resume: 'sync', route: '#/' }))
    expect(takePendingRedirect()).toEqual({ state: 's', grant: 'drive-read', resume: 'sync', route: '#/', ask: 'tap' })

    localStorage.setItem('ledgerboard.google-redirect', JSON.stringify({ state: 's', grant: 'drive', resume: 'sync', route: '#/', ask: 'silent-on-open' }))
    expect(takePendingRedirect()).toBeNull()
  })
})

describe('coming back to the app', () => {
  it('keeps the sign-in, takes the token out of the address and puts the route back', async () => {
    savePendingRedirect(PENDING)
    localStorage.setItem('ledgerboard.google-account', 'owner@example.com')
    window.history.replaceState(null, '', `/ledgerboard/?theme=dark#access_token=ya29.a0&token_type=Bearer&expires_in=3599&scope=${encodeURIComponent(SIGN_IN_SCOPE)}&state=one-time-state`)

    const answer = await takeGoogleRedirect()

    expect(answer).toMatchObject({ kind: 'granted', resume: 'sync', route: '#/review?tab=rules' })
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/ledgerboard/?theme=dark#/review?tab=rules')
    expect(loadAccessToken(Date.now())?.value).toBe('ya29.a0')
  })

  it('keeps a Gmail token in page memory only', async () => {
    savePendingRedirect({ ...PENDING, grant: 'gmail', resume: 'none' })
    window.history.replaceState(null, '', `/ledgerboard/#access_token=ya29.gmail&expires_in=3599&scope=${encodeURIComponent(GMAIL_COMPOSE)}&state=one-time-state`)

    expect(await takeGoogleRedirect()).toMatchObject({ kind: 'granted', grant: 'gmail' })
    expect(currentGmailToken()).toBe('ya29.gmail')
    expect(loadAccessToken(Date.now())).toBeNull()
  })

  it('keeps a Drive read token in page memory only, apart from the sign-in that reads and writes the Sheet, and forgets it on sign-out', async () => {
    savePendingRedirect(SILENT_DRIVE_READ)
    comeBackWith(`access_token=ya29.drive&expires_in=3599&scope=${encodeURIComponent(DRIVE_READONLY)}&state=one-time-state`)

    expect(await takeGoogleRedirect()).toMatchObject({ kind: 'granted', grant: 'drive-read', ask: 'silent-on-open' })
    expect(currentDriveReadToken()).toBe('ya29.drive')
    expect(driveReadAccess()).toBe('held')
    expect(currentAccessToken()).toBeNull()
    expect(loadAccessToken(Date.now())).toBeNull()
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('ya29.drive')

    forgetGoogleSignIn()

    expect(currentDriveReadToken()).toBeNull()
  })

  it('lets the Drive read token run out a minute early, like the others', async () => {
    vi.useFakeTimers({ now: BACK_AT })
    savePendingRedirect(SILENT_DRIVE_READ)
    comeBackWith(`access_token=ya29.drive&expires_in=3599&scope=${encodeURIComponent(DRIVE_READONLY)}&state=one-time-state`)
    await takeGoogleRedirect()

    vi.setSystemTime(BACK_AT + 3_599_000 - 60_000)

    expect(currentDriveReadToken()).toBeNull()
    expect(driveReadAccess()).toBe('not-asked')
  })

  it('keeps nothing from a forged answer and still clears the address', async () => {
    savePendingRedirect(PENDING)
    window.history.replaceState(null, '', '/ledgerboard/#access_token=ya29.forged&expires_in=3599&scope=email&state=forged')

    expect(await takeGoogleRedirect()).toMatchObject({ kind: 'refused' })
    expect(window.location.hash).toBe('#/review?tab=rules')
    expect(loadAccessToken(Date.now())).toBeNull()
  })

  it('does nothing on an ordinary load', async () => {
    window.history.replaceState(null, '', '/ledgerboard/#/transactions')

    expect(await takeGoogleRedirect()).toBeNull()
    expect(window.location.hash).toBe('#/transactions')
  })
})

function configureGoogle(): void {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client.apps.googleusercontent.com')
  vi.stubEnv('VITE_GOOGLE_API_KEY', 'key')
  vi.stubEnv('VITE_GOOGLE_PROJECT_NUMBER', '1')
}

/** The ask the tab left with, left in place for the return to take. */
function askLeftWith(): PendingRedirect | null {
  const ask = takePendingRedirect()
  if (ask !== null) {
    savePendingRedirect(ask)
  }
  return ask
}

describe('the silent Drive read ask as the app opens', () => {
  it('starts not asked, and goes to Google with a silent Drive read ask', () => {
    configureGoogle()
    window.history.replaceState(null, '', '/ledgerboard/#/review')

    expect(driveReadAccess()).toBe('not-asked')
    expect(askForDriveReadSilently(null)).toBe(true)
    expect(askLeftWith()).toMatchObject({ grant: 'drive-read', resume: 'none', route: '#/review', ask: 'silent-on-open' })
  })

  it('never goes round again in the same tab once Google answered with no token', async () => {
    for (const error of ['consent_required', 'interaction_required', 'login_required', 'server_error']) {
      sessionStorage.clear()
      configureGoogle()
      expect(askForDriveReadSilently(null)).toBe(true)
      comeBackWith(`error=${error}&state=${askLeftWith()!.state}`)

      expect(await takeGoogleRedirect()).toMatchObject({ kind: 'refused', grant: 'drive-read', ask: 'silent-on-open' })
      expect(askForDriveReadSilently(null)).toBe(false)
      expect(takePendingRedirect()).toBeNull()
      expect(driveReadAccess()).toBe('needs-consent')
    }
  })

  it('never goes round again when the tab came back without an answer from Google', () => {
    configureGoogle()
    expect(askForDriveReadSilently(null)).toBe(true)
    takePendingRedirect()

    expect(askForDriveReadSilently(null)).toBe(false)
    expect(takePendingRedirect()).toBeNull()
    expect(driveReadAccess()).toBe('needs-consent')
  })

  it('asks again on the next open once a token came back', async () => {
    configureGoogle()
    expect(askForDriveReadSilently(null)).toBe(true)
    comeBackWith(`access_token=ya29.drive&expires_in=3599&scope=${encodeURIComponent(DRIVE_READONLY)}&state=${askLeftWith()!.state}`)
    await takeGoogleRedirect()

    expect(driveReadAccess()).toBe('held')
    expect(askForDriveReadSilently(null)).toBe(true)
  })

  it('stays when the browser keeps no session storage, since the ask could not be noted', () => {
    configureGoogle()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })

    expect(askForDriveReadSilently(null)).toBe(false)
  })

  it('stays when the Google variables are missing', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')

    expect(askForDriveReadSilently(null)).toBe(false)
    expect(takePendingRedirect()).toBeNull()
  })
})

describe('the silent Drive read ask after a sign-in came back', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('A test reached for the network')
      }),
    )
  })

  /** Comes back from a sign-in this tab asked for with `resume`, and goes on as the app's start does. */
  async function signInCameBack(resume: PendingRedirect['resume']): Promise<RedirectReturn | null> {
    savePendingRedirect({ ...PENDING, resume })
    comeBackWith(`access_token=ya29.sign-in&expires_in=3599&scope=${encodeURIComponent(SIGN_IN_SCOPE)}&state=one-time-state`)
    return takeGoogleRedirect()
  }

  it('goes once more, silently, carrying what the sign-in resumes and the route it left', async () => {
    configureGoogle()
    localStorage.setItem('ledgerboard.google-account', 'owner@example.com')

    for (const resume of ['sync', 'pick', 'none'] as const) {
      sessionStorage.clear()
      expect(askForDriveReadSilently(await signInCameBack(resume))).toBe(true)
      expect(askLeftWith()).toMatchObject({ grant: 'drive-read', resume, route: '#/review?tab=rules', ask: 'silent-after-sign-in' })
      takePendingRedirect()
    }
    expect(loadAccessToken(Date.now())?.value).toBe('ya29.sign-in')
  })

  it('hands the sign-in\'s resume back with the Drive read answer, and never goes round a third time', async () => {
    for (const [fragment, access] of [
      [`access_token=ya29.drive&expires_in=3599&scope=${encodeURIComponent(DRIVE_READONLY)}`, 'held'],
      ['error=consent_required', 'needs-consent'],
    ] as const) {
      forgetGoogleSignIn()
      sessionStorage.clear()
      configureGoogle()
      localStorage.setItem('ledgerboard.google-account', 'owner@example.com')
      expect(askForDriveReadSilently(await signInCameBack('sync'))).toBe(true)
      comeBackWith(`${fragment}&state=${askLeftWith()!.state}`)

      const answer = await takeGoogleRedirect()

      expect(answer).toMatchObject({ grant: 'drive-read', resume: 'sync', route: '#/review?tab=rules', ask: 'silent-after-sign-in' })
      expect(askForDriveReadSilently(answer)).toBe(false)
      expect(takePendingRedirect()).toBeNull()
      expect(driveReadAccess()).toBe(access)
    }
  })

  it('reads the account email before it leaves, so the silent ask carries the login hint', async () => {
    configureGoogle()
    const userinfo = vi.fn(async () => new Response(JSON.stringify({ email: 'owner@example.com' })))
    vi.stubGlobal('fetch', userinfo)

    const answer = await signInCameBack('sync')

    expect(userinfo).toHaveBeenCalledOnce()
    expect(loadAccountEmail()).toBe('owner@example.com')
    expect(askForDriveReadSilently(answer)).toBe(true)
  })

  it('goes on without the account email when the lookup does not answer in time', async () => {
    configureGoogle()
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => AbortSignal.abort(new DOMException('The operation timed out.', 'TimeoutError')))
    const stalled = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          if (init?.signal?.aborted) reject(init.signal.reason)
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))
        }),
    )
    vi.stubGlobal('fetch', stalled)

    const answer = await signInCameBack('sync')

    expect(stalled).toHaveBeenCalledOnce()
    expect(loadAccountEmail()).toBeNull()
    expect(askForDriveReadSilently(answer)).toBe(true)
  })

  it('stays after a refused sign-in, a Gmail grant, a Drive read grant the person asked for, or on a tab Google gave no Drive read token', async () => {
    configureGoogle()
    localStorage.setItem('ledgerboard.google-account', 'owner@example.com')
    savePendingRedirect(PENDING)
    comeBackWith('error=access_denied&state=one-time-state')
    expect(askForDriveReadSilently(await takeGoogleRedirect())).toBe(false)

    savePendingRedirect({ ...PENDING, grant: 'gmail', resume: 'none' })
    comeBackWith(`access_token=ya29.gmail&expires_in=3599&scope=${encodeURIComponent(GMAIL_COMPOSE)}&state=one-time-state`)
    expect(askForDriveReadSilently(await takeGoogleRedirect())).toBe(false)

    savePendingRedirect({ ...PENDING, grant: 'drive-read' })
    comeBackWith(`access_token=ya29.drive&expires_in=3599&scope=${encodeURIComponent(DRIVE_READONLY)}&state=one-time-state`)
    expect(askForDriveReadSilently(await takeGoogleRedirect())).toBe(false)
    expect(takePendingRedirect()).toBeNull()

    sessionStorage.setItem('ledgerboard.drive-read-refused', 'true')
    expect(askForDriveReadSilently(await signInCameBack('sync'))).toBe(false)
    expect(takePendingRedirect()).toBeNull()
  })
})
