import { afterEach, describe, expect, it, vi } from 'vitest'

import { BankScriptFailure } from '../src/apps/spending/bankSync/application/bankSync'
import { appsScriptBankSync } from '../src/apps/spending/bankSync/infrastructure/appsScriptBankSync'
import { civil } from './fixtures/ledger'

/** Answers every request with the body given, and keeps the requests. */
function stubScript(answer: Response | (() => Response)): { url: string; init: RequestInit }[] {
  const requests: { url: string; init: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, init })
      return typeof answer === 'function' ? answer() : answer
    }),
  )
  return requests
}

const port = appsScriptBankSync('AKfycb-made-up', () => 'script-token')

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('appsScriptBankSync', () => {
  it("posts to the deployment's run address with the page's token and the function's name and parameters", async () => {
    const requests = stubScript(Response.json({ done: true, response: { result: { url: 'https://example.invalid/approve' } } }))

    await expect(port.startLink('Revolut', 'https://example.invalid/kuna/', 'one-time-state')).resolves.toBe('https://example.invalid/approve')

    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://script.googleapis.com/v1/scripts/AKfycb-made-up:run')
    expect(requests[0]?.init.method).toBe('POST')
    const headers = new Headers(requests[0]?.init.headers)
    expect(headers.get('Authorization')).toBe('Bearer script-token')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({ function: 'startLink', parameters: ['Revolut', 'https://example.invalid/kuna/', 'one-time-state'] })
  })

  it('asks for the longest history on the first fetch of an account and the default later', async () => {
    const requests = stubScript(() => Response.json({ done: true, response: { result: [] } }))

    await port.transactions('account-uid', civil('2026-10-01'), true)
    await port.transactions('account-uid', civil('2026-10-20'), false)

    expect(requests.map(({ init }) => JSON.parse(String(init.body)))).toEqual([
      { function: 'transactions', parameters: ['account-uid', '2026-10-01', 'longest'] },
      { function: 'transactions', parameters: ['account-uid', '2026-10-20', 'default'] },
    ])
  })

  it('returns what `finishLink` and `accounts` answer', async () => {
    stubScript(() => Response.json({ done: true, response: { result: { validUntil: '2027-05-03T12:00:00+00:00' } } }))
    await expect(port.finishLink('made-up-code')).resolves.toBe('2027-05-03T12:00:00+00:00')
    stubScript(() => Response.json({ done: true, response: { result: [] } }))
    await expect(port.sessions()).resolves.toEqual([])
  })

  it('reads an answer with no result as an empty list', async () => {
    stubScript(() => Response.json({ done: true, response: {} }))
    await expect(port.sessions()).resolves.toEqual([])
    await expect(port.transactions('account-uid', civil('2026-10-20'), false)).resolves.toEqual([])
  })

  it('says what the script threw', async () => {
    stubScript(Response.json({ done: true, error: { code: 3, message: 'ScriptError', details: [{ errorMessage: 'Enable Banking answered 429: ASPSP_RATE_LIMIT_EXCEEDED' }] } }))
    const failure = port.sessions()
    await expect(failure).rejects.toThrow('The bank sync script did not answer: Enable Banking answered 429: ASPSP_RATE_LIMIT_EXCEEDED')
    await expect(failure).rejects.toBeInstanceOf(BankScriptFailure)
  })

  it('says why Google refused the call, such as a script in another Cloud project', async () => {
    stubScript(new Response('The caller does not have permission', { status: 403 }))
    const failure = port.sessions()
    await expect(failure).rejects.toThrow('The bank sync script did not answer: 403')
    await expect(failure).rejects.not.toBeInstanceOf(BankScriptFailure)
  })

  it("leaves Google's 401 as it came, which the page's sync turns into asking for access", async () => {
    stubScript(new Response('expired', { status: 401 }))
    await expect(port.sessions()).rejects.toMatchObject({ name: 'GoogleApiError', status: 401 })
  })
})
