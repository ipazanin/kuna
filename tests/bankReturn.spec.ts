import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'

import { bankReturnOf, searchWithoutReturn } from '../src/apps/spending/bankSync/domain/bankReturn'
import { loadPendingLink, savePendingLink, takeBankReturn, takeReturnNote } from '../src/apps/spending/bankSync/infrastructure/bankBrowserState'
import { notedBankReturn, openBankSyncAfterReturn } from '../src/apps/spending/bankSync/presentation/bankReturnOnOpen'

function stubAddress(search: string): { replaced: () => string | null } {
  const stored = new Map<string, string>()
  let replaced: string | null = null
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, text: string) => stored.set(key, text),
    removeItem: (key: string) => stored.delete(key),
  })
  vi.stubGlobal('window', {
    location: { search, pathname: '/kuna/', hash: '' },
    history: {
      replaceState: (_state: unknown, _title: string, url: string) => {
        replaced = url
      },
    },
  })
  return { replaced: () => replaced }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('bankReturnOf', () => {
  it('reads a code and a state from the query string, where Enable Banking puts them', () => {
    expect(bankReturnOf('?code=made-up&state=one-time')).toEqual({ code: 'made-up', state: 'one-time' })
  })

  it('reads a refusal', () => {
    expect(bankReturnOf('?error=access_denied&error_description=Cancelled%20by%20user&state=one-time')).toEqual({ error: 'access_denied', description: 'Cancelled by user', state: 'one-time' })
  })

  it('leaves an address no bank came back to alone', () => {
    expect(bankReturnOf('')).toBeNull()
    expect(bankReturnOf('?theme=dark&code=made-up')).toBeNull()
  })

  it('takes only the answer out of the search', () => {
    expect(searchWithoutReturn('?theme=dark&code=made-up&state=one-time')).toBe('?theme=dark')
    expect(searchWithoutReturn('?code=made-up&state=one-time')).toBe('')
  })
})

describe('takeBankReturn', () => {
  it('keeps the code for the link this browser started and clears the address', () => {
    const address = stubAddress('?code=made-up&state=one-time')
    savePendingLink({ bank: 'revolut', state: 'one-time', code: null, validUntil: null })

    takeBankReturn()

    expect(takeReturnNote()).toEqual({ kind: 'code' })
    expect(loadPendingLink()).toEqual({ bank: 'revolut', state: 'one-time', code: 'made-up', validUntil: null })
    expect(address.replaced()).toBe('/kuna/')
  })

  it('refuses an answer with another state and keeps no code', () => {
    const address = stubAddress('?code=made-up&state=forged')
    savePendingLink({ bank: 'revolut', state: 'one-time', code: null, validUntil: null })

    takeBankReturn()

    expect(takeReturnNote()).toEqual({ kind: 'elsewhere' })
    expect(loadPendingLink()?.code).toBeNull()
    expect(address.replaced()).toBe('/kuna/')
  })

  it('says a bank came back elsewhere when this browser started no link', () => {
    stubAddress('?code=made-up&state=one-time')
    takeBankReturn()
    expect(takeReturnNote()).toEqual({ kind: 'elsewhere' })
  })

  it("forgets the link when the bank refused, and keeps the bank's reason past the silent trip to Google", async () => {
    stubAddress('?error=access_denied&error_description=Cancelled%20by%20user&state=one-time')
    savePendingLink({ bank: 'otp', state: 'one-time', code: null, validUntil: null })

    takeBankReturn()

    expect(loadPendingLink()).toBeNull()
    vi.resetModules()
    const reloaded = await import('../src/apps/spending/bankSync/infrastructure/bankBrowserState')
    expect(reloaded.takeReturnNote()).toEqual({ kind: 'refused', reason: 'Cancelled by user' })
    expect(reloaded.takeReturnNote()).toBeNull()
  })

  it('touches nothing on an ordinary address', () => {
    const address = stubAddress('?theme=dark')
    takeBankReturn()
    expect(takeReturnNote()).toBeNull()
    expect(address.replaced()).toBeNull()
  })
})

describe('openBankSyncAfterReturn', () => {
  const routerOf = () => {
    const replaced: unknown[] = []
    return {
      replaced,
      router: {
        replace: (to: unknown) => {
          replaced.push(to)
          return Promise.resolve(undefined)
        },
      } as unknown as Pick<Router, 'replace'>,
    }
  }

  it('opens the Bank sync tab once for a return, and no open after it, with the code still waiting', () => {
    stubAddress('?code=made-up&state=one-time')
    savePendingLink({ bank: 'otp', state: 'one-time', code: null, validUntil: null })
    takeBankReturn()

    const first = routerOf()
    openBankSyncAfterReturn(first.router)
    expect(first.replaced).toEqual(['/spending/settings?tab=bank-sync'])
    expect(notedBankReturn()).toEqual({ kind: 'code' })

    const next = routerOf()
    openBankSyncAfterReturn(next.router)
    expect(next.replaced).toEqual([])
    expect(loadPendingLink()?.code).toBe('made-up')
  })
})
