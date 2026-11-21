import { describe, expect, it } from 'vitest'

import { bankKeyId, bankSessionId, forgetBankSecrets, keepKey, keepSession, keyOf, sessionsOf } from '../src/apps/spending/bankSync/application/bankSecrets'
import type { BankSecretStore } from '../src/apps/spending/bankSync/application/bankSecrets'

function storeOver(first: Record<string, string> = {}): BankSecretStore & { readonly kept: Map<string, string> } {
  const kept = new Map(Object.entries(first))
  return {
    kept,
    read: (id) => kept.get(id) ?? null,
    write: (id, value) => (value === null ? kept.delete(id) : kept.set(id, value)),
  }
}

const PEM = '-----BEGIN PRIVATE KEY-----\nmade-up\n-----END PRIVATE KEY-----'

describe('the bank secrets', () => {
  it('names the key by its application and each session by its usage and bank', () => {
    expect(bankKeyId('made-up-app')).toBe('enable-banking made-up-app')
    expect(bankSessionId('personal', 'otp')).toBe('enable-banking-session personal otp')
  })

  it('keeps the key trimmed, as the secrets file takes it, and finds none for a blank application', () => {
    const store = storeOver()
    keepKey(store, '', 'made-up-app', `\n${PEM}\n`, 'personal')
    expect(keyOf(store, 'made-up-app')).toBe(PEM)
    expect(keyOf(store, '')).toBeNull()
  })

  it("forgets the old application's key and every session when a key of another application is kept", () => {
    const store = storeOver({ 'enable-banking old-app': PEM, 'enable-banking-session personal otp': 's1', 'enable-banking-session personal revolut': 's2', anthropic: 'made-up-ai-key' })
    keepKey(store, 'old-app', 'new-app', PEM, 'personal')
    expect([...store.kept.keys()].sort()).toEqual(['anthropic', 'enable-banking new-app'])
  })

  it('keeps the sessions when the same application gets its key again', () => {
    const store = storeOver({ 'enable-banking made-up-app': PEM, 'enable-banking-session personal otp': 's1' })
    keepKey(store, 'made-up-app', 'made-up-app', PEM, 'personal')
    expect(sessionsOf(store, 'personal')).toEqual([{ bank: 'otp', sessionId: 's1' }])
  })

  it('gives the session a new one replaces, and none for the same one or a first link', () => {
    const store = storeOver()
    expect(keepSession(store, 'personal', 'revolut', 's1')).toBeNull()
    expect(keepSession(store, 'personal', 'revolut', 's1')).toBeNull()
    expect(keepSession(store, 'personal', 'revolut', 's2')).toBe('s1')
    expect(sessionsOf(store, 'personal')).toEqual([{ bank: 'revolut', sessionId: 's2' }])
  })

  it('forgets the key and every session, and leaves every other secret', () => {
    const store = storeOver({ 'enable-banking made-up-app': PEM, 'enable-banking-session personal otp': 's1', twelvedata: 'made-up-price-key' })
    forgetBankSecrets(store, 'made-up-app', 'personal')
    expect([...store.kept.keys()]).toEqual(['twelvedata'])
  })
})
