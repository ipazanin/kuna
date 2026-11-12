import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createFile,
  createFolder,
  deleteFile,
  downloadFile,
  downloadRevision,
  filesWithAppProperty,
  getFile,
  listRevisions,
  trashFile,
  deleteRevision,
  uploadContent,
} from '../src/shared/google/driveClient'
import { GoogleApiError, GoogleTimedOut } from '../src/shared/google/googleApi'
import { DriveFileMissing } from '../src/shared/storage/application/driveFileMissing'
import { words as storageWords } from '../src/shared/storage/application/words'
import { hangingFetch } from './fixtures/hangingFetch'
import { googleDocumentDrive } from '../src/shared/storage/infrastructure/googleDocumentDrive'

interface SentRequest {
  readonly url: URL
  readonly method: string
  readonly headers: Headers
  readonly body: string | null
  readonly cache: RequestCache | undefined
}

/** A Drive that gives each request the next answer, and records what was sent. */
function stubDrive(...answers: Response[]): SentRequest[] {
  const sent: SentRequest[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const body = init.body === undefined || init.body === null ? null : init.body instanceof Blob ? await init.body.text() : String(init.body)
      sent.push({ url: new URL(input), method: init.method ?? 'GET', headers: new Headers(init.headers), body, cache: init.cache })
      return answers.shift() ?? new Response('no answer left', { status: 500 })
    }),
  )
  return sent
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('driveClient', () => {
  it('reads the fields asked for of one file past the browser cache', async () => {
    const sent = stubDrive(Response.json({ headRevisionId: 'rev-7', parents: ['folder-1'] }))

    expect(await getFile('token', 'file 1', ['headRevisionId', 'parents'])).toEqual({ headRevisionId: 'rev-7', parents: ['folder-1'] })
    expect(sent[0]!.url.href).toBe('https://www.googleapis.com/drive/v3/files/file%201?fields=headRevisionId%2Cparents')
    expect(sent[0]!.headers.get('Authorization')).toBe('Bearer token')
    expect(sent[0]!.cache).toBe('no-store')
  })

  it('downloads a file by alt=media past the browser cache', async () => {
    const sent = stubDrive(new Response('{"a":1}'))

    expect(new TextDecoder().decode(await downloadFile('token', 'file-1'))).toBe('{"a":1}')
    expect(sent[0]!.url.href).toBe('https://www.googleapis.com/drive/v3/files/file-1?alt=media')
    expect(sent[0]!.cache).toBe('no-store')
  })

  it('uploads content by media upload, kept forever when asked, and gives the head revision', async () => {
    const sent = stubDrive(Response.json({ headRevisionId: 'rev-8' }), Response.json({ headRevisionId: 'rev-9' }))

    expect(await uploadContent('token', 'file-1', '{"a":2}', 'application/json', true)).toBe('rev-8')
    expect(await uploadContent('token', 'file-2', 'pdf bytes', 'application/pdf', false)).toBe('rev-9')

    expect(sent.map((request) => [request.method, request.url.href, request.headers.get('Content-Type'), request.body])).toEqual([
      ['PATCH', 'https://www.googleapis.com/upload/drive/v3/files/file-1?uploadType=media&fields=headRevisionId&keepRevisionForever=true', 'application/json', '{"a":2}'],
      ['PATCH', 'https://www.googleapis.com/upload/drive/v3/files/file-2?uploadType=media&fields=headRevisionId', 'application/pdf', 'pdf bytes'],
    ])
  })

  it('creates a file with its metadata and content in one multipart upload', async () => {
    const sent = stubDrive(Response.json({ id: 'file-3', headRevisionId: 'rev-1' }))

    const created = await createFile('token', { name: 'kuna-company.json', mimeType: 'application/json', parents: ['folder-1'], appProperties: { kuna: 'company' } }, '{}', ['id', 'headRevisionId'])

    expect(created).toEqual({ id: 'file-3', headRevisionId: 'rev-1' })
    const [request] = sent
    expect([request!.method, request!.url.href]).toEqual(['POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id%2CheadRevisionId'])
    const boundary = /^multipart\/related; boundary=(kuna-[\w-]+)$/.exec(request!.headers.get('Content-Type')!)![1]!
    expect(request!.body).toBe(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        '{"name":"kuna-company.json","mimeType":"application/json","parents":["folder-1"],"appProperties":{"kuna":"company"}}' +
        `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n{}\r\n--${boundary}--`,
    )
  })

  it('creates a folder inside another', async () => {
    const sent = stubDrive(Response.json({ id: 'folder-2', name: 'backups', mimeType: 'application/vnd.google-apps.folder' }))

    expect(await createFolder('token', 'folder-1', 'backups')).toEqual({ id: 'folder-2', name: 'backups', mimeType: 'application/vnd.google-apps.folder' })
    expect([sent[0]!.method, sent[0]!.url.href, sent[0]!.body]).toEqual([
      'POST',
      'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType',
      '{"name":"backups","mimeType":"application/vnd.google-apps.folder","parents":["folder-1"]}',
    ])
  })

  it('moves a file to the bin', async () => {
    const sent = stubDrive(Response.json({ id: 'file-4' }))

    await trashFile('token', 'file-4')

    expect([sent[0]!.method, sent[0]!.url.href, sent[0]!.body]).toEqual(['PATCH', 'https://www.googleapis.com/drive/v3/files/file-4?fields=id', '{"trashed":true}'])
  })

  it('lists every revision page by page past the browser cache, a revision without keepForever read as not kept', async () => {
    const sent = stubDrive(
      Response.json({ revisions: [{ id: 'rev-1', modifiedTime: '2026-10-24T15:00:00.000Z', keepForever: true }], nextPageToken: 'page-2' }),
      Response.json({ revisions: [{ id: 'rev-2', modifiedTime: '2026-10-24T15:00:01.000Z' }] }),
    )

    expect(await listRevisions('token', 'file-1')).toEqual([
      { id: 'rev-1', modifiedTime: '2026-10-24T15:00:00.000Z', keepForever: true },
      { id: 'rev-2', modifiedTime: '2026-10-24T15:00:01.000Z', keepForever: false },
    ])
    expect(sent.map((request) => request.url.href)).toEqual([
      'https://www.googleapis.com/drive/v3/files/file-1/revisions?fields=nextPageToken%2Crevisions%28id%2CmodifiedTime%2CkeepForever%29&pageSize=1000',
      'https://www.googleapis.com/drive/v3/files/file-1/revisions?fields=nextPageToken%2Crevisions%28id%2CmodifiedTime%2CkeepForever%29&pageSize=1000&pageToken=page-2',
    ])
    expect(sent.map((request) => request.cache)).toEqual(['no-store', 'no-store'])
  })

  it('downloads one revision by alt=media', async () => {
    const sent = stubDrive(new Response('{"b":1}'))

    expect(new TextDecoder().decode(await downloadRevision('token', 'file-1', 'rev-2'))).toBe('{"b":1}')
    expect(sent[0]!.url.href).toBe('https://www.googleapis.com/drive/v3/files/file-1/revisions/rev-2?alt=media')
  })

  it('deletes a kept revision by revisions.delete', async () => {
    const sent = stubDrive(new Response(null, { status: 204 }))

    await deleteRevision('token', 'file-1', 'rev-1')

    expect([sent[0]!.method, sent[0]!.url.href]).toEqual(['DELETE', 'https://www.googleapis.com/drive/v3/files/file-1/revisions/rev-1'])
  })

  it('searches by a property the app gave a file, the trashed ones left out', async () => {
    const sent = stubDrive(Response.json({ files: [{ id: 'file-1' }] }))

    expect(await filesWithAppProperty('token', 'kuna', 'company', ['id'])).toEqual([{ id: 'file-1' }])
    expect(sent[0]!.url.searchParams.get('q')).toBe("appProperties has { key='kuna' and value='company' } and trashed = false")
    expect(sent[0]!.url.searchParams.get('fields')).toBe('nextPageToken,files(id)')
  })

  it("reads Google's reason from a refusal", async () => {
    stubDrive(
      Response.json(
        {
          error: {
            code: 403,
            message: 'A maximum of 200 revisions can be kept forever.',
            errors: [{ domain: 'global', reason: 'keptRevisionsLimitExceeded', message: 'A maximum of 200 revisions can be kept forever.' }],
          },
        },
        { status: 403 },
      ),
      new Response('Bad gateway', { status: 502 }),
    )

    const refusal = await uploadContent('token', 'file-1', '{}', 'application/json', true).catch((failure: unknown) => failure)
    const outage = await uploadContent('token', 'file-1', '{}', 'application/json', true).catch((failure: unknown) => failure)

    expect(refusal).toBeInstanceOf(GoogleApiError)
    expect((refusal as GoogleApiError).reason).toBe('keptRevisionsLimitExceeded')
    expect((outage as GoogleApiError).reason).toBeNull()
  })
})

describe('googleDocumentDrive', () => {
  it("answers Drive's refusal of a 201st kept revision as the cap, and passes other failures on", async () => {
    stubDrive(
      Response.json({ error: { code: 403, errors: [{ reason: 'keptRevisionsLimitExceeded' }] } }, { status: 403 }),
      Response.json({ error: { code: 403, errors: [{ reason: 'userRateLimitExceeded' }] } }, { status: 403 }),
    )
    const drive = googleDocumentDrive(async () => 'token')

    expect(await drive.upload('file-1', '{}')).toEqual({ kind: 'kept-revisions-full' })
    await expect(drive.upload('file-1', '{}')).rejects.toThrow('userRateLimitExceeded')
  })

  it('reads the head revision of a file and whether it is in the bin, which it refuses as missing', async () => {
    const sent = stubDrive(Response.json({ headRevisionId: 'rev-7', trashed: false }), Response.json({ headRevisionId: 'rev-7', trashed: true }))
    const drive = googleDocumentDrive(async () => 'token')

    expect(await drive.headRevision('file-1')).toBe('rev-7')
    expect(sent[0]!.url.searchParams.get('fields')).toBe('headRevisionId,trashed')
    const binned = await drive.headRevision('file-1').catch((failure: unknown) => failure)
    expect(binned).toBeInstanceOf(DriveFileMissing)
    expect((binned as Error).message).toBe(storageWords.inBin)
  })

  it('refuses a file Drive answers 404 for as gone, and passes other failures on', async () => {
    stubDrive(Response.json({ error: { code: 404, message: 'File not found: file-1.' } }, { status: 404 }), new Response('busy', { status: 503 }))
    const drive = googleDocumentDrive(async () => 'token')

    const gone = await drive.headRevision('file-1').catch((failure: unknown) => failure)
    expect(gone).toBeInstanceOf(DriveFileMissing)
    expect((gone as Error).message).toBe(storageWords.goneFromDrive)
    await expect(drive.headRevision('file-1')).rejects.toBeInstanceOf(GoogleApiError)
  })
})

describe('deleting a file', () => {
  it('sends files.delete, which skips the bin', async () => {
    const sent = stubDrive(new Response(null, { status: 204 }))

    await deleteFile('token', 'keys 1')
    expect([sent[0]!.method, sent[0]!.url.href]).toEqual(['DELETE', 'https://www.googleapis.com/drive/v3/files/keys%201'])
    expect(sent[0]!.headers.get('Authorization')).toBe('Bearer token')
  })
})

describe('a Drive request that hangs', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('gives up on an upload after two minutes and says Drive did not answer in time', async () => {
    const drive = hangingFetch()
    const upload = uploadContent('token', 'file-1', '{}', 'application/json', true)
    drive.giveUp()

    await expect(upload).rejects.toBeInstanceOf(GoogleTimedOut)
    expect(drive.waits).toEqual([120_000])
  })

  it('gives up on a read of fields after half a minute', async () => {
    const drive = hangingFetch()
    const read = getFile('token', 'file-1', ['headRevisionId'])
    drive.giveUp()

    await expect(read).rejects.toBeInstanceOf(GoogleTimedOut)
    expect(drive.waits).toEqual([30_000])
  })

  it('gives up the same way when the answer started and its body stalled, which Firefox fails with an AbortError', async () => {
    const waits: number[] = []
    const controller = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      waits.push(milliseconds)
      return controller.signal
    })
    const stalled = new ReadableStream<Uint8Array>({
      start(stream) {
        controller.signal.addEventListener('abort', () => stream.error(new DOMException('The operation was aborted.', 'AbortError')))
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(stalled)),
    )

    const download = downloadFile('token', 'file-1')
    await vi.waitFor(() => expect(waits).toEqual([120_000]))
    controller.abort(new DOMException('signal timed out', 'TimeoutError'))

    await expect(download).rejects.toBeInstanceOf(GoogleTimedOut)
  })

  it("passes Drive's own refusal on unchanged while the wait has not run out", async () => {
    stubDrive(new Response('Backend Error', { status: 500 }))

    await expect(getFile('token', 'file-1', ['headRevisionId'])).rejects.toBeInstanceOf(GoogleApiError)
  })
})
