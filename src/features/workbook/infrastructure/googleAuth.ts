import { googleConfig } from './googleConfig'
import { loadScript } from './loadScript'

const IDENTITY_SERVICES_SRC = 'https://accounts.google.com/gsi/client'

/** The only scope the app asks for: files the user picked or the app created, nothing else. */
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export type TokenPrompt = '' | 'none' | 'consent' | 'select_account'

export interface AccessToken {
  readonly value: string
  readonly grantedScope: string
  readonly expiresInSeconds: number
  /** Epoch milliseconds. */
  readonly expiresAt: number
}

// Held in memory only, so a reload or a closed tab always needs a new token.
let current: AccessToken | null = null

export function currentAccessToken(): AccessToken | null {
  return current !== null && current.expiresAt > Date.now() ? current : null
}

/** Loads the GIS library ahead of a click, so the click itself can open the popup without delay. */
export function prepareGoogleIdentity(): Promise<void> {
  return loadScript(IDENTITY_SERVICES_SRC)
}

/**
 * Asks Google for an access token. Call it from a click handler: Firefox blocks the consent popup
 * unless it opens during a user gesture. `prompt: ''` shows a popup only when Google needs one.
 */
export async function requestToken(prompt: TokenPrompt): Promise<AccessToken> {
  const { clientId } = googleConfig()
  await prepareGoogleIdentity()
  const requestedAt = Date.now()

  return new Promise<AccessToken>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      prompt,
      callback: (response) => {
        if (response.error) {
          reject(new Error(`Google refused the token: ${response.error} ${response.error_description ?? ''}`.trim()))
          return
        }
        const expiresInSeconds = Number(response.expires_in)
        current = {
          value: response.access_token,
          grantedScope: response.scope,
          expiresInSeconds,
          expiresAt: requestedAt + expiresInSeconds * 1000,
        }
        resolve(current)
      },
      error_callback: (failure) => {
        reject(new Error(`The Google sign-in popup did not complete: ${failure.type} ${failure.message}`.trim()))
      },
    })
    client.requestAccessToken()
  })
}
