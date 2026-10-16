import { googleConfig } from './googleConfig'
import {
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
 * the remembered email as the login hint skips the account chooser.
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

/** Forgets the token and the account on this device, as switching to a workbook kept here does. */
export function forgetGoogleSignIn(): void {
  forgetAccessToken()
  forgetAccountEmail()
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
