// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { currentGmailToken, signsInByRedirect, takeGoogleRedirect } from '../src/shared/google/googleAuth'
import {
  GMAIL_COMPOSE,
  GMAIL_NOT_GRANTED,
  REDIRECT_SIGN_IN_QUERY,
  authorizationUrl,
  redirectFragmentOf,
  savePendingRedirect,
  settleRedirect,
  takePendingRedirect,
} from '../src/shared/google/googleRedirect'
import type { PendingRedirect } from '../src/shared/google/googleRedirect'
import { loadAccessToken } from '../src/shared/google/googleSession'

const SIGN_IN_SCOPE = 'https://www.googleapis.com/auth/drive.file openid email'
const PENDING: PendingRedirect = { state: 'one-time-state', grant: 'sign-in', resume: 'sync', route: '#/review?tab=rules' }
const BACK_AT = Date.parse('2026-10-21T09:00:00.000Z')

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState(null, '', '/ledgerboard/')
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

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
      authorizationUrl({ clientId: 'client', redirectUri: 'http://localhost:5173/ledgerboard/', scope: GMAIL_COMPOSE, state: 's', includeGrantedScopes: true, loginHint: null }),
    )

    expect(url.searchParams.has('login_hint')).toBe(false)
    expect(url.searchParams.get('include_granted_scopes')).toBe('true')
    expect(url.searchParams.has('prompt')).toBe(false)
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
})

describe('coming back to the app', () => {
  it('keeps the sign-in, takes the token out of the address and puts the route back', () => {
    savePendingRedirect(PENDING)
    localStorage.setItem('ledgerboard.google-account', 'owner@example.com')
    window.history.replaceState(null, '', `/ledgerboard/?theme=dark#access_token=ya29.a0&token_type=Bearer&expires_in=3599&scope=${encodeURIComponent(SIGN_IN_SCOPE)}&state=one-time-state`)

    const answer = takeGoogleRedirect()

    expect(answer).toMatchObject({ kind: 'granted', resume: 'sync', route: '#/review?tab=rules' })
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/ledgerboard/?theme=dark#/review?tab=rules')
    expect(loadAccessToken(Date.now())?.value).toBe('ya29.a0')
  })

  it('keeps a Gmail token in page memory only', () => {
    savePendingRedirect({ ...PENDING, grant: 'gmail', resume: 'none' })
    window.history.replaceState(null, '', `/ledgerboard/#access_token=ya29.gmail&expires_in=3599&scope=${encodeURIComponent(GMAIL_COMPOSE)}&state=one-time-state`)

    expect(takeGoogleRedirect()).toMatchObject({ kind: 'granted', grant: 'gmail' })
    expect(currentGmailToken()).toBe('ya29.gmail')
    expect(loadAccessToken(Date.now())).toBeNull()
  })

  it('keeps nothing from a forged answer and still clears the address', () => {
    savePendingRedirect(PENDING)
    window.history.replaceState(null, '', '/ledgerboard/#access_token=ya29.forged&expires_in=3599&scope=email&state=forged')

    expect(takeGoogleRedirect()).toMatchObject({ kind: 'refused' })
    expect(window.location.hash).toBe('#/review?tab=rules')
    expect(loadAccessToken(Date.now())).toBeNull()
  })

  it('does nothing on an ordinary load', () => {
    window.history.replaceState(null, '', '/ledgerboard/#/transactions')

    expect(takeGoogleRedirect()).toBeNull()
    expect(window.location.hash).toBe('#/transactions')
  })
})
