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

/**
 * Asks Google for an access token. Call it from a click handler: Firefox blocks the consent popup
 * unless it opens during a user gesture. `prompt: ''` shows a popup only when Google needs one, and
 * the remembered email as the login hint skips the account chooser. The token carries only these
 * scopes, never a Gmail grant given since, because this one is kept in `localStorage`.
 */
export async function requestToken(): Promise<StoredAccessToken> {
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
  saveAccessToken(token)
  if (loginHint === null) {
    void rememberAccountEmail(token)
  }
  return token
}

const GMAIL_COMPOSE = 'https://www.googleapis.com/auth/gmail.compose'

let gmailToken: { readonly value: string; readonly expiresAt: number } | null = null

/** The Gmail token of this page while it is still good. It is never stored, so a reload asks again. */
export function currentGmailToken(): string | null {
  return gmailToken !== null && gmailToken.expiresAt - EXPIRY_MARGIN_MS > Date.now() ? gmailToken.value : null
}

/**
 * Asks Google for `gmail.compose` on top of what was granted, the first time with a consent popup.
 * Call it from a click handler, as `requestToken`. The token stays in this page's memory only,
 * since it can send mail as well as save drafts.
 */
export async function requestGmailToken(): Promise<string> {
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
          reject(new Error('Gmail access was not granted, so no draft can be saved. Leave "Create the mail draft" off to write the mail yourself.'))
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
