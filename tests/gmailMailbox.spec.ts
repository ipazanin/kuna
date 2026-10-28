import { afterEach, describe, expect, it, vi } from 'vitest'

import { MailRateLimited } from '../src/apps/company/mail/application/mailFiling'
import { gmailMailbox } from '../src/apps/company/mail/infrastructure/gmailMailbox'
import { googleMailFolders } from '../src/apps/company/mail/infrastructure/googleMailFolders'

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
              { name: 'From', value: 'Ured <office@accountant.example.com>' },
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

    expect(await mailbox.search('from:(office@accountant.example.com) subject:"Plaća za" has:attachment after:1', null)).toEqual({ ids: ['m1'], next: 'page-2' })
    expect(await mailbox.message('m1')).toEqual({ id: 'm1', subject: 'RE: Plaća za 9/2026', date: 1791273600000, attachments: [{ id: 'a1', name: 'Example plaća 9 2026.xlsx' }] })
    expect([...new Uint8Array(await mailbox.attachment('m1', 'a1'))]).toEqual([0x00, 0xff, 0xfe])
    expect(requests[0]!.searchParams.get('q')).toBe('from:(office@accountant.example.com) subject:"Plaća za" has:attachment after:1')
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

const USER_RATE_LIMIT = JSON.stringify({ error: { code: 403, message: 'User Rate Limit Exceeded', errors: [{ domain: 'usageLimits', reason: 'userRateLimitExceeded', message: 'User Rate Limit Exceeded' }] } })

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

const FOLDER = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
const FILES = "mimeType != 'application/vnd.google-apps.folder' and trashed = false"

describe('googleMailFolders', () => {
  it('lists only the folders on the way to the ones asked for and those inside them, then their files with when Drive made them, their checksum and the mail the app filed them from', async () => {
    const pages: Readonly<Record<string, unknown>> = {
      [`'root' in parents and name = 'finance' and ${FOLDER}`]: { files: [{ id: 'finance' }] },
      [`'finance' in parents and name = 'payroll' and ${FOLDER}`]: { files: [{ id: 'payroll' }] },
      [`('payroll' in parents) and ${FOLDER}`]: {
        files: [
          { id: 'y2025', name: '2025-payroll', parents: ['payroll'] },
          { id: 'y2026', name: '2026-payroll', parents: ['payroll'] },
        ],
      },
      [`('y2026' in parents) and ${FOLDER}`]: {
        files: [
          { id: 'm08', name: '2026-08', parents: ['y2026'] },
          { id: 'm09', name: '2026-09', parents: ['y2026'] },
        ],
      },
      [`('m08' in parents or 'm09' in parents) and ${FOLDER}`]: { files: [] },
      [`('y2026' in parents or 'm08' in parents or 'm09' in parents) and ${FILES}`]: {
        files: [
          { name: '2026-08-salary.xlsx', parents: ['m08'], createdTime: '2026-09-05T10:00:00.000Z', sha256Checksum: 'def' },
          { name: '2026-09-salary.xlsx', parents: ['m09'], createdTime: '2026-10-05T10:00:00.000Z', sha256Checksum: 'abc' },
          { name: '2026-09-salary', parents: ['m09'], createdTime: '2026-10-06T10:00:00.000Z', appProperties: { 'ledgerboard-mail': 'hr-doo.payroll', 'ledgerboard-mail-date': '2026-10-05T08:30:00.000Z' } },
        ],
      },
    }
    const requests = stubGoogle((url) => pages[url.searchParams.get('q') ?? ''])

    const listing = await googleMailFolders('token', 'books-file').filesIn(['finance', 'payroll'], [['2026-payroll']])

    expect(listing).toEqual({
      kind: 'listed',
      files: [
        { folders: ['2026-payroll', '2026-08'], name: '2026-08-salary.xlsx', createdTime: Date.parse('2026-09-05T10:00:00.000Z'), sha256: 'def', filedFrom: null },
        { folders: ['2026-payroll', '2026-09'], name: '2026-09-salary.xlsx', createdTime: Date.parse('2026-10-05T10:00:00.000Z'), sha256: 'abc', filedFrom: null },
        { folders: ['2026-payroll', '2026-09'], name: '2026-09-salary', createdTime: Date.parse('2026-10-06T10:00:00.000Z'), sha256: null, filedFrom: Date.parse('2026-10-05T08:30:00.000Z') },
      ],
    })
    expect(requests.some((url) => url.searchParams.get('q')?.includes("'y2025'"))).toBe(false)
    expect(requests.at(-1)!.searchParams.get('fields')).toBe('nextPageToken,files(name,parents,createdTime,sha256Checksum,appProperties)')
  })

  it('refuses a path where a folder is missing', async () => {
    stubGoogle(() => ({ files: [] }))

    expect(await googleMailFolders('token', 'books-file').filesIn(['finance', 'statements'], [['2026-statements']])).toEqual({ kind: 'refused', reason: 'My Drive holds no folder named "finance"' })
  })
})

describe('googleMailFolders making a file', () => {
  /** A Drive with the statements folder and its 2031 year folder, which makes every folder and file asked for and records each request with its body. */
  function stubDrive(): { readonly method: string; readonly url: URL; readonly body: string }[] {
    const requests: { readonly method: string; readonly url: URL; readonly body: string }[] = []
    let made = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init: RequestInit) => {
        const url = new URL(input)
        const body = init.body instanceof Blob ? await init.body.text() : String(init.body ?? '')
        requests.push({ method: init.method ?? 'GET', url, body })
        if ((init.method ?? 'GET') === 'POST') {
          made += 1
          return Response.json({ id: `made-${made}`, name: 'made', mimeType: 'made' })
        }
        const query = url.searchParams.get('q') ?? ''
        if (query === `'root' in parents and name = 'finance' and ${FOLDER}`) return Response.json({ files: [{ id: 'finance' }] })
        if (query === `'finance' in parents and name = 'statements' and ${FOLDER}`) return Response.json({ files: [{ id: 'statements' }] })
        if (query === `('statements' in parents) and ${FOLDER}`) return Response.json({ files: [{ id: 'y2031', name: '2031-statements' }] })
        return Response.json({ files: [] })
      }),
    )
    return requests
  }

  const PROPERTIES = { 'ledgerboard-mail': 'statements', 'ledgerboard-mail-id': '18c2f4a9d7e01b3c', 'ledgerboard-mail-date': '2031-03-12T04:00:00.000Z' }

  it('makes the file in the year folder Drive holds, as the media type its name ends in and with its properties, and makes a missing year folder once a run', async () => {
    const requests = stubDrive()
    const folders = googleMailFolders('token', 'books-file')
    const file = (name: string) => ({ name, properties: PROPERTIES, bytes: new TextEncoder().encode('pdf').buffer as ArrayBuffer })

    await folders.create(['finance', 'statements'], ['2031-statements'], file('2031-03-12-statement-042.pdf'))
    await folders.create(['finance', 'statements'], ['2032-statements'], file('2032-01-02-statement-001.pdf'))
    await folders.create(['finance', 'statements'], ['2032-statements'], file('2032-01-02-statement-001-main.xml'))

    const posts = requests.filter((request) => request.method === 'POST')
    expect(posts.map((request) => request.url.pathname)).toEqual(['/upload/drive/v3/files', '/drive/v3/files', '/upload/drive/v3/files', '/upload/drive/v3/files'])
    expect(JSON.parse(posts[1]!.body)).toEqual({ name: '2032-statements', mimeType: 'application/vnd.google-apps.folder', parents: ['statements'] })
    const metadata = posts.flatMap((request) => (request.url.pathname.startsWith('/upload') ? [JSON.parse(/\r\n\r\n(\{.*\})\r\n/.exec(request.body)![1]!)] : []))
    expect(metadata).toEqual([
      { name: '2031-03-12-statement-042.pdf', mimeType: 'application/pdf', parents: ['y2031'], appProperties: PROPERTIES },
      { name: '2032-01-02-statement-001.pdf', mimeType: 'application/pdf', parents: ['made-2'], appProperties: PROPERTIES },
      { name: '2032-01-02-statement-001-main.xml', mimeType: 'application/xml', parents: ['made-2'], appProperties: PROPERTIES },
    ])
    expect(requests.filter((request) => request.method === 'GET')).toHaveLength(4)
    expect(requests.every((request) => request.method === 'GET' || request.method === 'POST')).toBe(true)
  })

  it('makes a missing year folder and the month folder inside it before the file, as the payroll and the invoices need', async () => {
    const requests: { readonly method: string; readonly url: URL; readonly body: string }[] = []
    let made = 0
    vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
      const url = new URL(input)
      const method = init.method ?? 'GET'
      requests.push({ method, url, body: init.body instanceof Blob ? await init.body.text() : String(init.body ?? '') })
      if (method === 'POST') {
        made += 1
        return Response.json({ id: `made-${made}`, name: 'made', mimeType: 'made' })
      }
      const query = url.searchParams.get('q') ?? ''
      if (query === `'root' in parents and name = 'finance' and ${FOLDER}`) return Response.json({ files: [{ id: 'finance' }] })
      if (query === `'finance' in parents and name = 'payroll' and ${FOLDER}`) return Response.json({ files: [{ id: 'payroll' }] })
      return Response.json({ files: [] })
    })

    await googleMailFolders('token', 'books-file').create(['finance', 'payroll'], ['2026-payroll', '2026-09'], { name: '2026-09-salary.xlsx', properties: PROPERTIES, bytes: new TextEncoder().encode('xlsx').buffer as ArrayBuffer })

    const posts = requests.filter((request) => request.method === 'POST')
    expect(posts.slice(0, 2).map((request) => JSON.parse(request.body))).toEqual([
      { name: '2026-payroll', mimeType: 'application/vnd.google-apps.folder', parents: ['payroll'] },
      { name: '2026-09', mimeType: 'application/vnd.google-apps.folder', parents: ['made-1'] },
    ])
    expect(JSON.parse(/\r\n\r\n(\{.*\})\r\n/.exec(posts[2]!.body)![1]!)).toEqual({ name: '2026-09-salary.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', parents: ['made-2'], appProperties: PROPERTIES })
  })

  it('files into the statements folder the app made beside the books, found from the books file without a walk from My Drive', async () => {
    const requests: { readonly url: URL; readonly body: string }[] = []
    vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
      const url = new URL(input)
      const method = init.method ?? 'GET'
      requests.push({ url, body: init.body instanceof Blob ? await init.body.text() : '' })
      if (url.pathname.endsWith('/files/books-file')) return Response.json({ parents: ['books-folder'] })
      if (method === 'POST') return Response.json({ id: 'filed' })
      const query = url.searchParams.get('q') ?? ''
      if (query === `'books-folder' in parents and name = 'statements' and ${FOLDER}`) return Response.json({ files: [{ id: 'app-statements' }] })
      if (query === `('app-statements' in parents) and ${FOLDER}`) return Response.json({ files: [{ id: 'y2031', name: '2031-statements' }] })
      return Response.json({ files: [] })
    })

    await googleMailFolders('token', 'books-file').create(['.', 'statements'], ['2031-statements'], { name: '2031-03-12-statement-042.pdf', properties: PROPERTIES, bytes: new TextEncoder().encode('pdf').buffer as ArrayBuffer })

    const upload = requests.find((request) => request.url.pathname.startsWith('/upload'))!
    expect(JSON.parse(/\r\n\r\n(\{.*\})\r\n/.exec(upload.body)![1]!)).toMatchObject({ parents: ['y2031'] })
    expect(requests.some((request) => request.url.searchParams.get('q')?.startsWith("'root'"))).toBe(false)
  })
})
