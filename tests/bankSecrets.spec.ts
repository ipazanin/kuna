import { describe, expect, it } from 'vitest'

import { bankKeyId, bankSessionId, forgetBankSecrets, forgetSession, keepKey, keepSession, keyOf, sessionsOf } from '../src/shared/bank-sync/application/bankSecrets'
import type { BankSecretStore } from '../src/shared/bank-sync/application/bankSecrets'

function storeOver(first: Record<string, string> = {}): BankSecretStore & { readonly kept: Map<string, string> } {
  const kept = new Map(Object.entries(first))
  return {
    kept,
    read: (id) => kept.get(id) ?? null,
    write: (id, value) => {
      if (value === null) kept.delete(id)
      else kept.set(id, value)
    },
    ids: () => [...kept.keys()],
  }
}

const PEM = '-----BEGIN PRIVATE KEY-----\nmade-up\n-----END PRIVATE KEY-----'
const OTP = { bank: 'OTP banka', usage: 'personal' } as const
const REVOLUT = { bank: 'Revolut', usage: 'personal' } as const

describe('the bank secrets', () => {
  it('names the key by its application and each session by its login and bank', () => {
    expect(bankKeyId('made-up-app')).toBe('enable-banking made-up-app')
    expect(bankSessionId(OTP)).toBe('enable-banking-session personal OTP banka')
    expect(bankSessionId({ bank: 'Made-up Bank', usage: 'business' })).toBe('enable-banking-session business Made-up Bank')
  })

  it('keeps the key trimmed, as the secrets file takes it, and finds none for a blank application', () => {
    const store = storeOver()
    keepKey(store, '', 'made-up-app', `\n${PEM}\n`)
    expect(keyOf(store, 'made-up-app')).toBe(PEM)
    expect(keyOf(store, '')).toBeNull()
  })

  it("forgets the old application's key and every session when a key of another application is kept", () => {
    const store = storeOver({
      'enable-banking old-app': PEM,
      'enable-banking-session personal otp': 's1',
      'enable-banking-session personal Revolut': 's2',
      'enable-banking-session business Made-up Bank': 's3',
      anthropic: 'made-up-ai-key',
    })
    keepKey(store, 'old-app', 'new-app', PEM)
    expect([...store.kept.keys()].sort()).toEqual(['anthropic', 'enable-banking new-app'])
  })

  it('keeps the sessions when the same application gets its key again', () => {
    const store = storeOver({ 'enable-banking made-up-app': PEM, 'enable-banking-session personal Revolut': 's1' })
    keepKey(store, 'made-up-app', 'made-up-app', PEM)
    expect(sessionsOf(store, 'personal')).toEqual([{ ...REVOLUT, sessionId: 's1' }])
  })

  it("reads a session a browser kept under the bank's old short name as that bank's, and only the sessions of the login asked", () => {
    const store = storeOver({ 'enable-banking-session personal otp': 's1', 'enable-banking-session personal revolut': 's2', 'enable-banking-session business Made-up Bank': 's3' })
    expect(sessionsOf(store, 'personal')).toEqual([
      { ...OTP, sessionId: 's1' },
      { ...REVOLUT, sessionId: 's2' },
    ])
    expect(sessionsOf(store, 'business')).toEqual([{ bank: 'Made-up Bank', usage: 'business', sessionId: 's3' }])
  })

  it("moves a session from the bank's old short name when the bank links again, and gives the old one to close", () => {
    const store = storeOver({ 'enable-banking-session personal otp': 's1' })
    expect(keepSession(store, OTP, 's2')).toBe('s1')
    expect([...store.kept.entries()]).toEqual([['enable-banking-session personal OTP banka', 's2']])
  })

  it('gives the session a new one replaces, and none for the same one or a first link', () => {
    const store = storeOver()
    expect(keepSession(store, REVOLUT, 's1')).toBeNull()
    expect(keepSession(store, REVOLUT, 's1')).toBeNull()
    expect(keepSession(store, REVOLUT, 's2')).toBe('s1')
    expect(sessionsOf(store, 'personal')).toEqual([{ ...REVOLUT, sessionId: 's2' }])
  })

  it('forgets the key and every session, and leaves every other secret', () => {
    const store = storeOver({
      'enable-banking made-up-app': PEM,
      'enable-banking-session personal otp': 's1',
      'enable-banking-session personal Zagrebačka banka': 's2',
      twelvedata: 'made-up-price-key',
    })
    forgetBankSecrets(store, 'made-up-app')
    expect([...store.kept.keys()]).toEqual(['twelvedata'])
  })

  it("forgets one bank's session under its name and its old short name, gives both to close, and leaves every other", () => {
    const store = storeOver({
      'enable-banking made-up-app': PEM,
      'enable-banking-session personal Revolut': 's1',
      'enable-banking-session personal revolut': 's0',
      'enable-banking-session personal OTP banka': 's2',
    })
    expect(forgetSession(store, REVOLUT)).toEqual(['s1', 's0'])
    expect([...store.kept.keys()]).toEqual(['enable-banking made-up-app', 'enable-banking-session personal OTP banka'])
    expect(forgetSession(store, REVOLUT)).toEqual([])
  })
})
