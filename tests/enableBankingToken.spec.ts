import { createVerify, generateKeyPairSync } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { UnreadableBankKey, enableBankingTokens } from '../src/apps/spending/bankSync/infrastructure/enableBankingToken'

// Made here for each run, so no private key is ever in the repository.
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })

const START = Date.parse('2026-11-21T09:00:00.000Z')

function partOf(token: string, place: 0 | 1): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[place]!, 'base64url').toString('utf8')) as Record<string, unknown>
}

function verifies(token: string): boolean {
  const [header, claims, signature] = token.split('.') as [string, string, string]
  return createVerify('RSA-SHA256').update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, 'base64url'))
}

describe('the Enable Banking token', () => {
  it('is signed as Enable Banking asks: RS256, the application id as the kid, its issuer and audience, an hour, and no padding', async () => {
    const token = await enableBankingTokens('made-up-app-id', privateKey, () => START).token()

    expect(token).not.toContain('=')
    expect(partOf(token, 0)).toEqual({ typ: 'JWT', alg: 'RS256', kid: 'made-up-app-id' })
    const claims = partOf(token, 1) as { iss: string; aud: string; iat: number; exp: number }
    expect([claims.iss, claims.aud]).toEqual(['enablebanking.com', 'api.enablebanking.com'])
    expect(claims.iat).toBe(START / 1000)
    expect(claims.exp - claims.iat).toBe(3600)
    expect(verifies(token)).toBe(true)
  })

  it('reads a key whose line breaks a one-line field kept as \\n', async () => {
    const token = await enableBankingTokens('made-up-app-id', privateKey.replace(/\n/g, '\\n'), () => START).token()
    expect(verifies(token)).toBe(true)
  })

  it('hands out the same token for most of its hour, and a new one before it runs out', async () => {
    let now = START
    const tokens = enableBankingTokens('made-up-app-id', privateKey, () => now)
    const first = await tokens.token()
    now = START + 50 * 60_000
    expect(await tokens.token()).toBe(first)
    now = START + 56 * 60_000
    const second = await tokens.token()
    expect(second).not.toBe(first)
    expect(partOf(second, 1).iat).toBe(now / 1000)
  })

  it('says it cannot read a key that is not a PKCS#8 private key', async () => {
    await expect(enableBankingTokens('made-up-app-id', 'not a key', () => START).token()).rejects.toBeInstanceOf(UnreadableBankKey)
    const rsaOnly = '-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK\n-----END RSA PRIVATE KEY-----'
    await expect(enableBankingTokens('made-up-app-id', rsaOnly, () => START).token()).rejects.toBeInstanceOf(UnreadableBankKey)
    const broken = '-----BEGIN PRIVATE KEY-----\nbWFkZS11cA==\n-----END PRIVATE KEY-----'
    await expect(enableBankingTokens('made-up-app-id', broken, () => START).token()).rejects.toBeInstanceOf(UnreadableBankKey)
  })
})
