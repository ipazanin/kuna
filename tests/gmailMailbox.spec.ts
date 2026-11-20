import { afterEach, describe, expect, it, vi } from 'vitest'

import { MailRateLimited } from '../src/shared/mail/application/mailReading'
import { gmailMailbox } from '../src/shared/mail/infrastructure/gmailMailbox'
import { GoogleTimedOut } from '../src/shared/google/googleApi'
import { hangingFetch } from './fixtures/hangingFetch'

/** A Google that answers each request with what the handler gives for its URL, and records every request. */
function stubGoogle(answer: (url: URL) => unknown): URL[] {
  const requests: URL[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit) => {
      const url = new URL(input)
      requests.push(url)
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token')
      expect(init.method ?? 'GET').toBe('GET')
      const body = answer(url)
      return body === undefined ? new Response(`nothing at ${url}`, { status: 404 }) : Response.json(body)
    }),
  )
  return requests
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('gmailMailbox', () => {
  it('searches a page at a time and reads a mail’s subject, its date and the attachments of every part, nested ones among them', async () => {
    const requests = stubGoogle((url) => {
      if (url.pathname.endsWith('/messages')) return { messages: [{ id: 'm1', threadId: 't1' }], nextPageToken: 'page-2' }
      if (url.pathname.endsWith('/messages/m1')) {
        return {
          id: 'm1',
          internalDate: '1791273600000',
          payload: {
            headers: [
              { name: 'From', value: 'Ured <office@bookkeeper.example.com>' },
              { name: 'Subject', value: 'RE: Plaća za 9/2026' },
            ],
            parts: [
              { mimeType: 'text/plain', filename: '', body: { size: 12 } },
              { mimeType: 'multipart/mixed', parts: [{ mimeType: 'application/octet-stream', filename: 'Example plaća 9 2026.xlsx', body: { attachmentId: 'a1', size: 9 } }] },
            ],
          },
        }
      }
      if (url.pathname.endsWith('/attachments/a1')) return { size: 3, data: 'AP_-' }
      return undefined
    })
    const mailbox = gmailMailbox('token')

    expect(await mailbox.search('from:(office@bookkeeper.example.com) subject:"Plaća za" has:attachment after:1', null)).toEqual({ ids: ['m1'], next: 'page-2' })
    expect(await mailbox.message('m1')).toEqual({ id: 'm1', subject: 'RE: Plaća za 9/2026', date: 1791273600000, attachments: [{ id: 'a1', name: 'Example plaća 9 2026.xlsx' }] })
    expect([...new Uint8Array(await mailbox.attachment('m1', 'a1'))]).toEqual([0x00, 0xff, 0xfe])
    expect(requests[0]!.searchParams.get('q')).toBe('from:(office@bookkeeper.example.com) subject:"Plaća za" has:attachment after:1')
    expect(requests[0]!.searchParams.get('maxResults')).toBe('500')
    expect(requests[1]!.searchParams.get('format')).toBe('full')
    expect(requests.map((url) => url.origin)).toEqual(Array(3).fill('https://gmail.googleapis.com'))
  })

  it('asks for the next page by its token, and reads a last page without one', async () => {
    const requests = stubGoogle(() => ({}))

    expect(await gmailMailbox('token').search('q', 'page-2')).toEqual({ ids: [], next: null })
    expect(requests[0]!.searchParams.get('pageToken')).toBe('page-2')
  })
})

/** A Gmail that answers the first `limited` requests with this rate limit, and then with an empty page. */
function stubRateLimit(limited: number, answer: () => Response): number[] {
  const calls: number[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      calls.push(calls.length)
      return calls.length <= limited ? answer() : Response.json({})
    }),
  )
  return calls
}

const USER_RATE_LIMIT = JSON.stringify({
  error: { code: 403, message: 'User Rate Limit Exceeded', errors: [{ domain: 'usageLimits', reason: 'userRateLimitExceeded', message: 'User Rate Limit Exceeded' }] },
})

describe('gmailMailbox asked to slow down', () => {
  it('waits by Google’s backoff after a 403 rate limit and sends the call again', async () => {
    const calls = stubRateLimit(2, () => new Response(USER_RATE_LIMIT, { status: 403 }))
    const waits: number[] = []

    expect(await gmailMailbox('token', async (milliseconds) => void waits.push(milliseconds)).search('q', null)).toEqual({ ids: [], next: null })
    expect(calls).toHaveLength(3)
    expect(waits).toHaveLength(2)
    expect(waits[0]).toBeGreaterThanOrEqual(1000)
    expect(waits[0]).toBeLessThan(2000)
    expect(waits[1]).toBeGreaterThanOrEqual(2000)
    expect(waits[1]).toBeLessThan(3000)
  })

  it('takes a 429 for a rate limit too, and waits by the same backoff', async () => {
    const calls = stubRateLimit(1, () => new Response('{}', { status: 429 }))
    const waits: number[] = []

    await gmailMailbox('token', async (milliseconds) => void waits.push(milliseconds)).search('q', null)
    expect(calls).toHaveLength(2)
    expect(waits).toHaveLength(1)
    expect(waits[0]).toBeGreaterThanOrEqual(1000)
    expect(waits[0]).toBeLessThan(2000)
  })

  it('gives up after five retries with a plain sentence, and sends another 403 back at once', async () => {
    const calls = stubRateLimit(Infinity, () => new Response(USER_RATE_LIMIT, { status: 403 }))
    const waits: number[] = []
    const failure = gmailMailbox('token', async (milliseconds) => void waits.push(milliseconds)).attachment('m1', 'a1')

    await expect(failure).rejects.toBeInstanceOf(MailRateLimited)
    await expect(failure).rejects.toThrow('Gmail asked us to slow down. Sync again in a minute.')
    expect(calls).toHaveLength(6)
    expect(waits.map((milliseconds) => Math.floor(milliseconds / 1000))).toEqual([1, 2, 4, 8, 16])

    const forbidden = stubRateLimit(Infinity, () => new Response(JSON.stringify({ error: { code: 403, errors: [{ reason: 'insufficientPermissions' }] } }), { status: 403 }))
    await expect(gmailMailbox('token', async () => {}).search('q', null)).rejects.toThrow(/^403 from/)
    expect(forbidden).toHaveLength(1)
  })
})

describe('a Gmail that never answers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('gives up on a search after half a minute and on an attachment after three, and sends neither again', async () => {
    const google = hangingFetch()
    const mailbox = gmailMailbox('token', async () => {})
    const search = mailbox.search('q', null)
    const attachment = mailbox.attachment('m1', 'a1')
    google.giveUp()

    await expect(search).rejects.toBeInstanceOf(GoogleTimedOut)
    await expect(attachment).rejects.toBeInstanceOf(GoogleTimedOut)
    expect(google.waits).toEqual([30_000, 180_000])
  })
})
