// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/shared/google/loadScript', () => ({ loadScript: async () => {} }))

import {
  askSilentlyOnOpen,
  currentToken,
  forgetGoogleSignIn,
  googleAccess,
  needScopes,
  requestAccess,
  signsInByRedirect,
  takeGoogleRedirect,
  tokenFor,
} from '../src/shared/google/googleAuth'
import { REDIRECT_SIGN_IN_QUERY, authorizationUrl, redirectFragmentOf, savePendingRedirect, settleRedirect, takePendingRedirect } from '../src/shared/google/googleRedirect'
import type { PendingRedirect } from '../src/shared/google/googleRedirect'
import { scopeRequest } from '../src/shared/google/googleScopes'
import { loadGrantedScopes, loadNeededScopes, loadSilentRefusal } from '../src/shared/google/googleSession'

const DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file'
const DRIVE_READONLY = 'https://www.googleapis.com/auth/drive.readonly'
const GMAIL_COMPOSE = 'https://www.googleapis.com/auth/gmail.compose'
/** The `scope` Google sends back for a grant of every scope the app asks for. */
const EVERY_SCOPE = `${DRIVE_FILE} ${DRIVE_READONLY} ${GMAIL_COMPOSE} openid https://www.googleapis.com/auth/userinfo.email`
const PENDING: PendingRedirect = { state: 'one-time-state', scopes: ['drive.file', 'drive.readonly', 'gmail.compose'], resume: 'sync', route: '#/company/review?tab=rules', ask: 'tap' }
const BACK_AT = Date.parse('2026-10-21T09:00:00.000Z')

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('A test reached for the network')
    }),
  )
  localStorage.setItem('ledgerboard.google-account', 'owner@example.com')
})

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

function tokenFragment(scope: string, state = 'one-time-state', token = 'ya29.one'): string {
  return `access_token=${token}&token_type=Bearer&expires_in=3599&scope=${encodeURIComponent(scope)}&state=${state}`
}

function configureGoogle(): void {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client.apps.googleusercontent.com')
  vi.stubEnv('VITE_GOOGLE_API_KEY', 'key')
  vi.stubEnv('VITE_GOOGLE_PROJECT_NUMBER', '1')
}

/** Makes the device sign in by redirect, as a phone or the installed app does, or in the popup, as a desktop does. */
function onPhone(phone: boolean): void {
  vi.stubGlobal('matchMedia', () => ({ matches: phone }))
}

/** The ask the tab left with, left in place for the return to take. */
function askLeftWith(): PendingRedirect | null {
  const ask = takePendingRedirect()
  if (ask !== null) {
    savePendingRedirect(ask)
  }
  return ask
}

describe('the address the tab goes to', () => {
  it('asks for exactly the scopes given with the sign-in scopes, never the ones granted before, with the state and the login hint', () => {
    const url = new URL(
      authorizationUrl({
        clientId: 'client.apps.googleusercontent.com',
        redirectUri: 'https://ipazanin.github.io/ledgerboard/',
        scopes: ['gmail.compose', 'drive.file', 'drive.readonly'],
        state: 'one-time-state',
        loginHint: 'owner@example.com',
        silent: false,
      }),
    )

    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client.apps.googleusercontent.com',
      redirect_uri: 'https://ipazanin.github.io/ledgerboard/',
      response_type: 'token',
      scope: `openid email ${DRIVE_FILE} ${DRIVE_READONLY} ${GMAIL_COMPOSE}`,
      state: 'one-time-state',
      include_granted_scopes: 'false',
      login_hint: 'owner@example.com',
    })
  })

  it('shows no screen at Google when the ask is silent, and leaves the login hint out when no account is remembered', () => {
    const url = new URL(
      authorizationUrl({ clientId: 'client', redirectUri: 'https://ipazanin.github.io/ledgerboard/', scopes: ['drive.file'], state: 's', loginHint: null, silent: true }),
    )

    expect(url.searchParams.get('scope')).toBe(scopeRequest(['drive.file']))
    expect(url.searchParams.get('prompt')).toBe('none')
    expect(url.searchParams.has('login_hint')).toBe(false)
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
    onPhone(false)

    expect(signsInByRedirect()).toBe(false)
  })
})

describe('reading the fragment', () => {
  it('reads a token, its lifetime, its scopes and the state', () => {
    expect(redirectFragmentOf(`#${tokenFragment(EVERY_SCOPE)}`)).toEqual({ kind: 'token', accessToken: 'ya29.one', expiresIn: 3599, scope: EVERY_SCOPE, state: 'one-time-state' })
  })

  it('reads an error with its description', () => {
    expect(redirectFragmentOf('#error=access_denied&state=one-time-state')).toEqual({ kind: 'error', error: 'access_denied', description: null, state: 'one-time-state' })
    expect(redirectFragmentOf('#error=invalid_request&error_description=Missing+scope')).toEqual({ kind: 'error', error: 'invalid_request', description: 'Missing scope', state: null })
  })

  it('leaves an ordinary hash route, an empty hash and an unrelated anchor alone', () => {
    expect(redirectFragmentOf('#/company/review?tab=rules')).toBeNull()
    expect(redirectFragmentOf('')).toBeNull()
    expect(redirectFragmentOf('#billing-month-2026-10')).toBeNull()
  })
})

describe('checking the answer against the request', () => {
  const token = { kind: 'token', accessToken: 'ya29.one', expiresIn: 3599, scope: EVERY_SCOPE, state: 'one-time-state' } as const

  it('keeps one token for every scope asked, counting its lifetime from the return, and goes back to the route left', () => {
    expect(settleRedirect(token, PENDING, BACK_AT)).toEqual({
      kind: 'granted',
      token: { value: 'ya29.one', scopes: ['drive.file', 'drive.readonly', 'gmail.compose'], expiresAt: BACK_AT + 3_599_000 },
      asked: PENDING.scopes,
      resume: 'sync',
      route: '#/company/review?tab=rules',
      ask: 'tap',
    })
  })

  it('keeps a token with Drive read unticked on the consent screen, with the scopes it does carry', () => {
    const partial = settleRedirect({ ...token, scope: `${DRIVE_FILE} ${GMAIL_COMPOSE} openid` }, PENDING, BACK_AT)

    expect(partial).toMatchObject({ kind: 'granted', token: { scopes: ['drive.file', 'gmail.compose'] }, asked: PENDING.scopes })
  })

  it('refuses a token with another state, with no state, or that this tab never asked for, and goes to the start when it never asked', () => {
    for (const [fragment, pending] of [
      [{ ...token, state: 'forged' }, PENDING],
      [{ ...token, state: null }, PENDING],
      [token, null],
    ] as const) {
      const answer = settleRedirect(fragment, pending, BACK_AT)
      expect(answer).toMatchObject({ kind: 'refused', error: 'forged', resume: 'none' })
      expect(answer).not.toHaveProperty('token')
    }
    expect(settleRedirect({ ...token, state: 'forged' }, PENDING, BACK_AT).route).toBe('#/company/review?tab=rules')
    expect(settleRedirect(token, null, BACK_AT).route).toBe('#/')
  })

  it('carries Google\'s error, and what the ask resumes, whatever Google answers', () => {
    const denied = settleRedirect({ kind: 'error', error: 'access_denied', description: null, state: 'one-time-state' }, PENDING, BACK_AT)
    const silent = settleRedirect({ kind: 'error', error: 'interaction_required', description: null, state: 'one-time-state' }, { ...PENDING, resume: 'none', ask: 'silent' }, BACK_AT)

    expect(denied).toEqual({ kind: 'refused', error: 'access_denied', resume: 'sync', route: '#/company/review?tab=rules', ask: 'tap' })
    expect(silent).toMatchObject({ kind: 'refused', error: 'interaction_required', ask: 'silent' })
  })

  it('refuses a token with no usable lifetime', () => {
    expect(settleRedirect({ ...token, expiresIn: Number.NaN }, PENDING, BACK_AT)).toMatchObject({ kind: 'refused', error: 'no-token' })
  })
})

describe('the pending redirect', () => {
  it('is good once', () => {
    savePendingRedirect(PENDING)

    expect(takePendingRedirect()).toEqual(PENDING)
    expect(takePendingRedirect()).toBeNull()
  })

  it('keeps only the scopes the app knows, and refuses an unknown resume, an unknown ask or one without scopes', () => {
    localStorage.setItem('ledgerboard.google-redirect', JSON.stringify({ ...PENDING, scopes: ['drive.file', 'calendar'] }))
    expect(takePendingRedirect()).toEqual({ ...PENDING, scopes: ['drive.file'] })

    for (const broken of [{ ...PENDING, resume: 'open' }, { ...PENDING, ask: 'silent-on-open' }, { ...PENDING, scopes: 'drive.file' }]) {
      localStorage.setItem('ledgerboard.google-redirect', JSON.stringify(broken))
      expect(takePendingRedirect()).toBeNull()
    }
  })
})

describe('coming back to the app', () => {
  it('holds one token for several scopes in page memory only, takes it out of the address and puts the route back', () => {
    savePendingRedirect(PENDING)
    window.history.replaceState(null, '', `/ledgerboard/?theme=dark#${tokenFragment(EVERY_SCOPE)}`)

    expect(takeGoogleRedirect()).toMatchObject({ kind: 'granted', resume: 'sync', route: '#/company/review?tab=rules' })
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/ledgerboard/?theme=dark#/company/review?tab=rules')
    expect([currentToken('drive.file'), currentToken('drive.readonly'), currentToken('gmail.compose')]).toEqual(['ya29.one', 'ya29.one', 'ya29.one'])
    expect(googleAccess()).toEqual({ scopes: ['drive.file', 'drive.readonly', 'gmail.compose'], refusal: null })
    expect(loadGrantedScopes()).toEqual(['drive.file', 'drive.readonly', 'gmail.compose'])
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('ya29.one')
  })

  it('holds a partial grant with Drive read unticked, and notes Drive read as not granted while keeping a grant it did not ask about', () => {
    localStorage.setItem('ledgerboard.google-granted', JSON.stringify(['drive.file', 'drive.readonly', 'gmail.compose']))
    savePendingRedirect({ ...PENDING, scopes: ['drive.file', 'drive.readonly'] })
    comeBackWith(tokenFragment(`${DRIVE_FILE} openid`))

    expect(takeGoogleRedirect()).toMatchObject({ kind: 'granted', token: { scopes: ['drive.file'] } })
    expect(currentToken('drive.file')).toBe('ya29.one')
    expect(currentToken('drive.readonly')).toBeNull()
    expect(googleAccess().scopes).toEqual(['drive.file'])
    expect(loadGrantedScopes()).toEqual(['drive.file', 'gmail.compose'])
  })

  it('lets the token run out a minute early', () => {
    vi.useFakeTimers({ now: BACK_AT })
    savePendingRedirect(PENDING)
    comeBackWith(tokenFragment(EVERY_SCOPE))
    takeGoogleRedirect()

    vi.setSystemTime(BACK_AT + 3_599_000 - 60_000)

    expect(currentToken('drive.file')).toBeNull()
  })

  it('keeps nothing from a forged answer, still clears the address, and says why for the sync control', () => {
    savePendingRedirect(PENDING)
    comeBackWith(tokenFragment(EVERY_SCOPE, 'forged', 'ya29.forged'))

    expect(takeGoogleRedirect()).toMatchObject({ kind: 'refused' })
    expect(window.location.hash).toBe('#/company/review?tab=rules')
    expect(currentToken('drive.file')).toBeNull()
    expect(googleAccess()).toEqual({ scopes: null, refusal: 'forged' })
  })

  it('does nothing on an ordinary load', () => {
    window.history.replaceState(null, '', '/ledgerboard/#/company/transactions')

    expect(takeGoogleRedirect()).toBeNull()
    expect(window.location.hash).toBe('#/company/transactions')
  })

  it('reads the account email once for the login hint when the device has none', async () => {
    localStorage.removeItem('ledgerboard.google-account')
    const userinfo = vi.fn(async () => new Response(JSON.stringify({ email: 'owner@example.com' })))
    vi.stubGlobal('fetch', userinfo)
    savePendingRedirect(PENDING)
    comeBackWith(tokenFragment(EVERY_SCOPE))

    takeGoogleRedirect()
    await vi.waitFor(() => expect(localStorage.getItem('ledgerboard.google-account')).toBe('owner@example.com'))

    expect(userinfo).toHaveBeenCalledOnce()
  })
})

describe('the silent trip as the app opens', () => {
  it('asks only for the scopes Google granted that the books still need, and before any grant for the books file', () => {
    configureGoogle()
    needScopes(['drive.file', 'drive.readonly'])
    expect(askSilentlyOnOpen()).toBe(true)
    expect(askLeftWith()).toMatchObject({ scopes: ['drive.file'], resume: 'none', ask: 'silent' })
    takePendingRedirect()
    localStorage.clear()

    localStorage.setItem('ledgerboard.google-granted', JSON.stringify(['drive.file', 'drive.readonly', 'gmail.compose']))
    needScopes(['drive.file', 'drive.readonly'])
    expect(askSilentlyOnOpen()).toBe(true)
    expect(askLeftWith()).toMatchObject({ scopes: ['drive.file', 'drive.readonly'], ask: 'silent' })
  })

  it('always carries the books file, even when the needs were last worked out for books kept in this browser', () => {
    configureGoogle()
    localStorage.setItem('ledgerboard.google-granted', JSON.stringify(['drive.file', 'drive.readonly']))
    needScopes([])
    expect(askSilentlyOnOpen()).toBe(true)
    expect(askLeftWith()).toMatchObject({ scopes: ['drive.file'], ask: 'silent' })
  })

  it('stays when Google never granted the books file, since that token could not sync', () => {
    configureGoogle()
    localStorage.setItem('ledgerboard.google-granted', JSON.stringify(['drive.readonly']))
    needScopes(['drive.file', 'drive.readonly'])

    expect(askSilentlyOnOpen()).toBe(false)
    expect(takePendingRedirect()).toBeNull()
    expect(loadSilentRefusal()).toBeNull()
  })

  it('comes back with one token for every scope asked', () => {
    configureGoogle()
    localStorage.setItem('ledgerboard.google-granted', JSON.stringify(['drive.file', 'drive.readonly']))
    needScopes(['drive.file', 'drive.readonly', 'gmail.compose'])
    expect(askSilentlyOnOpen()).toBe(true)
    comeBackWith(tokenFragment(`${DRIVE_FILE} ${DRIVE_READONLY} openid`, askLeftWith()!.state))

    expect(takeGoogleRedirect()).toMatchObject({ kind: 'granted', ask: 'silent' })
    expect([currentToken('drive.file'), currentToken('drive.readonly')]).toEqual(['ya29.one', 'ya29.one'])
    expect(loadSilentRefusal()).toBeNull()
  })

  it('stops going round on a device whose silent trip Google refused, which the sync control then shows', () => {
    for (const error of ['interaction_required', 'login_required', 'consent_required']) {
      localStorage.clear()
      configureGoogle()
      expect(askSilentlyOnOpen()).toBe(true)
      comeBackWith(`error=${error}&state=${askLeftWith()!.state}`)

      expect(takeGoogleRedirect()).toMatchObject({ kind: 'refused', error, ask: 'silent' })
      expect(loadSilentRefusal()).toBe(error)
      expect(googleAccess()).toEqual({ scopes: null, refusal: error })
      expect(askSilentlyOnOpen()).toBe(false)
      expect(takePendingRedirect()).toBeNull()
    }
  })

  it('stops going round when the tab came back without Google\'s answer', () => {
    configureGoogle()
    expect(askSilentlyOnOpen()).toBe(true)
    takePendingRedirect()

    expect(askSilentlyOnOpen()).toBe(false)
    expect(takePendingRedirect()).toBeNull()
  })

  it('goes round again once a tap brings a token after a sign-in or a consent Google asked for, but not after it said the browser needs a person', () => {
    for (const [error, cleared] of [
      ['login_required', true],
      ['unanswered', true],
      ['interaction_required', false],
    ] as const) {
      localStorage.setItem('ledgerboard.google-silent-refused', error)
      savePendingRedirect(PENDING)
      comeBackWith(tokenFragment(EVERY_SCOPE))
      takeGoogleRedirect()

      expect(loadSilentRefusal()).toBe(cleared ? null : error)
    }
  })

  it('stays when the browser keeps no site storage, or the Google variables are missing, and leaves no mark', () => {
    configureGoogle()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('denied')
    })
    expect(askSilentlyOnOpen()).toBe(false)

    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    expect(askSilentlyOnOpen()).toBe(false)
    expect(loadSilentRefusal()).toBeNull()
    expect(takePendingRedirect()).toBeNull()
  })
})

describe('asking in a tap', () => {
  it('on a phone, leaves for Google with the books file, every scope the settings need and the one missing, to resume the sync', async () => {
    configureGoogle()
    onPhone(true)
    needScopes(['drive.file', 'gmail.compose'])

    void requestAccess(['drive.readonly'], 'sync')
    await Promise.resolve()
    const left = askLeftWith()!

    expect(left).toMatchObject({ scopes: ['drive.file', 'drive.readonly', 'gmail.compose'], resume: 'sync', ask: 'tap' })
    comeBackWith(tokenFragment(EVERY_SCOPE, left.state))
    expect(takeGoogleRedirect()).toMatchObject({ kind: 'granted', resume: 'sync', ask: 'tap' })
    expect(currentToken('drive.readonly')).toBe('ya29.one')
  })

  it('on a phone, refuses an action that could not run again instead of leaving the page', async () => {
    configureGoogle()
    onPhone(true)

    await expect(tokenFor('gmail.compose', null)).rejects.toThrow('asking for it on a phone would leave the page')
    expect(takePendingRedirect()).toBeNull()
  })

  it('on a desktop, holds the popup\'s one token, and says when it lacks the scope the action needs', async () => {
    configureGoogle()
    onPhone(false)
    const asked: string[] = []
    let granted = EVERY_SCOPE
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: (config: google.accounts.oauth2.TokenClientConfig) => ({
            requestAccessToken: () => {
              asked.push(config.scope)
              config.callback({ access_token: 'ya29.popup', expires_in: '3599', scope: granted } as google.accounts.oauth2.TokenResponse)
            },
          }),
        },
      },
    })
    needScopes(['drive.file', 'drive.readonly'])

    expect(await tokenFor('gmail.compose', null)).toBe('ya29.popup')
    expect(asked).toEqual([scopeRequest(['drive.file', 'drive.readonly', 'gmail.compose'])])
    expect(currentToken('drive.readonly')).toBe('ya29.popup')

    forgetGoogleSignIn()
    granted = `${DRIVE_FILE} openid`
    await expect(tokenFor('gmail.compose', null)).rejects.toThrow('Gmail access was not allowed')
    expect(currentToken('drive.file')).toBe('ya29.popup')
  })

  it('forgets the token, the grants and the device mark on sign-out, and keeps what the books need', () => {
    needScopes(['drive.file'])
    savePendingRedirect(PENDING)
    comeBackWith(tokenFragment(EVERY_SCOPE))
    takeGoogleRedirect()
    localStorage.setItem('ledgerboard.google-silent-refused', 'interaction_required')

    forgetGoogleSignIn()

    expect(currentToken('drive.file')).toBeNull()
    expect(loadGrantedScopes()).toBeNull()
    expect(loadSilentRefusal()).toBeNull()
    expect(googleAccess()).toEqual({ scopes: null, refusal: null })
    expect(loadNeededScopes()).toEqual(['drive.file'])
  })
})
