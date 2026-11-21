/** How long a token lasts. Enable Banking takes up to a day, and an hour keeps a token that leaks short-lived. */
const TOKEN_SECONDS = 3600

/** How long before its end a token is no longer handed out, so a call that takes a while still lands inside its hour. */
const MARGIN_SECONDS = 300

const PEM_LINE = /-----(?:BEGIN|END) PRIVATE KEY-----/g

/** The key could not be read: not a PKCS#8 private key, as Enable Banking's Control Panel downloads it. */
export class UnreadableBankKey extends Error {
  override readonly name = 'UnreadableBankKey'
}

/** Signs the tokens of one Enable Banking application. */
export interface BankTokens {
  /** A token signed with the application's key, the same one for most of its hour. */
  token(): Promise<string>
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function jsonPart(part: object): string {
  return base64url(new TextEncoder().encode(JSON.stringify(part)))
}

/** The DER bytes of a PEM. Line breaks written as the two characters `\n`, as a one-line field keeps them, read as breaks. */
function derOf(pem: string): Uint8Array<ArrayBuffer> {
  const text = pem.replace(/\\n/g, '\n')
  if (!/-----BEGIN PRIVATE KEY-----/.test(text)) throw new UnreadableBankKey('Not a PKCS#8 private key')
  const body = text.replace(PEM_LINE, '').replace(/\s+/g, '')
  let binary: string
  try {
    binary = atob(body)
  } catch {
    throw new UnreadableBankKey('Not a PKCS#8 private key')
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function importKey(pem: string): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey('pkcs8', derOf(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  } catch (failure) {
    if (failure instanceof UnreadableBankKey) throw failure
    throw new UnreadableBankKey(failure instanceof Error ? failure.message : String(failure))
  }
}

/**
 * The tokens Enable Banking asks for, signed in this page with the application's key: RS256, the application id as `kid`,
 * its issuer and audience. The key is imported once and cannot be read back out. `now` gives epoch milliseconds.
 */
export function enableBankingTokens(applicationId: string, pem: string, now: () => number = Date.now): BankTokens {
  let key: Promise<CryptoKey> | null = null
  let held: { readonly token: string; readonly until: number } | null = null
  return {
    async token() {
      const at = Math.floor(now() / 1000)
      if (held !== null && at < held.until - MARGIN_SECONDS) return held.token
      key ??= importKey(pem)
      const signed = `${jsonPart({ typ: 'JWT', alg: 'RS256', kid: applicationId })}.${jsonPart({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: at, exp: at + TOKEN_SECONDS })}`
      const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await key, new TextEncoder().encode(signed))
      held = { token: `${signed}.${base64url(new Uint8Array(signature))}`, until: at + TOKEN_SECONDS }
      return held.token
    },
  }
}
