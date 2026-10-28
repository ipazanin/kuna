import { afterEach, describe, expect, it, vi } from 'vitest'

import { googleStatementFolder } from '../src/apps/company/imports/infrastructure/googleStatementFolder'
import { downloadFile, listChildren } from '../src/shared/google/driveClient'

const FOLDER = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"

interface Page {
  readonly files: readonly object[]
  readonly nextPageToken?: string
}

/** A Drive that answers each search query, or each query and page token, with the page given for it, and records every request. */
function stubDrive(pages: Readonly<Record<string, Page>>): URL[] {
  const requests: URL[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit) => {
      const url = new URL(input)
      requests.push(url)
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer read-token')
      const query = url.searchParams.get('q') ?? ''
      const page = pages[`${query}#${url.searchParams.get('pageToken') ?? ''}`] ?? pages[query]
      return page === undefined ? new Response(`no page for ${query}`, { status: 404 }) : Response.json(page)
    }),
  )
  return requests
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('googleStatementFolder', () => {
  it('walks the path one folder at a time from My Drive, then lists the files of every folder inside it', async () => {
    const requests = stubDrive({
      [`'root' in parents and name = 'work' and ${FOLDER}`]: { files: [{ id: 'work-id' }] },
      [`'work-id' in parents and name = 'statements' and ${FOLDER}`]: { files: [{ id: 'statements-id' }] },
      [`('statements-id' in parents) and ${FOLDER}`]: { files: [{ id: 'year-2025' }, { id: 'year-2026' }] },
      ["('year-2025' in parents or 'year-2026' in parents) and mimeType != 'application/vnd.google-apps.folder' and trashed = false"]: {
        files: [
          { id: 'a', name: '2025-12-30-statement-001-main.xml' },
          { id: 'b', name: '2026-01-02-statement-002-main.xml' },
        ],
      },
    })

    const listing = await googleStatementFolder('read-token', 'books-file').files(['work', 'statements'])

    expect(listing).toEqual({
      kind: 'listed',
      files: [
        { id: 'a', name: '2025-12-30-statement-001-main.xml' },
        { id: 'b', name: '2026-01-02-statement-002-main.xml' },
      ],
    })
    expect(requests.map((url) => url.origin + url.pathname)).toEqual(Array(4).fill('https://www.googleapis.com/drive/v3/files'))
    expect(requests.map((url) => url.searchParams.get('fields'))).toEqual(['nextPageToken,files(id)', 'nextPageToken,files(id)', 'nextPageToken,files(id)', 'nextPageToken,files(id,name)'])
  })

  it('refuses a path where two folders share a name, naming the folder and where it is, and reads no further', async () => {
    const requests = stubDrive({
      [`'root' in parents and name = 'work' and ${FOLDER}`]: { files: [{ id: 'work-id' }] },
      [`'work-id' in parents and name = 'erste' and ${FOLDER}`]: { files: [{ id: 'erste-1' }, { id: 'erste-2' }] },
    })

    const listing = await googleStatementFolder('read-token', 'books-file').files(['work', 'erste', 'statements'])

    expect(listing).toEqual({ kind: 'refused', reason: 'work holds 2 folders named "erste", so the app cannot tell which one holds the statements. Rename or remove the others in Drive.' })
    expect(requests).toHaveLength(2)
  })

  it('reports the first folder of the path that is missing, and never makes it', async () => {
    const requests = stubDrive({
      [`'root' in parents and name = 'work' and ${FOLDER}`]: { files: [{ id: 'work-id' }] },
      [`'work-id' in parents and name = 'statements' and ${FOLDER}`]: { files: [] },
      [`'root' in parents and name = 'finance' and ${FOLDER}`]: { files: [] },
    })
    const folder = googleStatementFolder('read-token', 'books-file')

    expect(await folder.files(['work', 'statements', '2026'])).toEqual({ kind: 'refused', reason: 'work holds no folder named "statements", so no statements were read. Check the statements_folder setting.' })
    expect(await folder.files(['finance'])).toEqual({ kind: 'refused', reason: 'My Drive holds no folder named "finance", so no statements were read. Check the statements_folder setting.' })
    expect(requests).toHaveLength(3)
  })

  it('escapes quotes and backslashes in a folder name', async () => {
    const requests = stubDrive({
      [`'root' in parents and name = 'Owner\\'s \\\\ statements' and ${FOLDER}`]: { files: [{ id: 'quoted-id' }] },
      [`('quoted-id' in parents) and ${FOLDER}`]: { files: [] },
    })

    expect(await googleStatementFolder('read-token', 'books-file').files(["Owner's \\ statements"])).toEqual({ kind: 'listed', files: [] })
    expect(requests[0]?.searchParams.get('q')).toBe(`'root' in parents and name = 'Owner\\'s \\\\ statements' and ${FOLDER}`)
  })

  it('walks a path from the folder of the books file, which the books file’s own scope can do, and lists what the app filed in it', async () => {
    const requests: URL[] = []
    const pages: Readonly<Record<string, Page>> = {
      [`'books-folder' in parents and name = 'statements' and ${FOLDER}`]: { files: [{ id: 'statements-id' }] },
      [`('statements-id' in parents) and ${FOLDER}`]: { files: [{ id: 'year-2026' }] },
      ["('year-2026' in parents) and mimeType != 'application/vnd.google-apps.folder' and trashed = false"]: { files: [{ id: 'a', name: '2026-10-08-statement-029.xml' }] },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init: RequestInit) => {
        const url = new URL(input)
        requests.push(url)
        expect(new Headers(init.headers).get('Authorization')).toBe('Bearer file-token')
        if (url.pathname.endsWith('/files/books-file')) return Response.json({ parents: ['books-folder'] })
        const page = pages[url.searchParams.get('q') ?? '']
        return page === undefined ? new Response('not visible to drive.file', { status: 404 }) : Response.json(page)
      }),
    )

    const listing = await googleStatementFolder('file-token', 'books-file').files(['.', 'statements'])

    expect(listing).toEqual({ kind: 'listed', files: [{ id: 'a', name: '2026-10-08-statement-029.xml' }] })
    expect(requests[0]?.searchParams.get('fields')).toBe('parents')
    expect(requests.some((url) => url.searchParams.get('q')?.startsWith("'root'"))).toBe(false)
  })

  it('says the folder of the books file lacks the statements folder when the app made none there', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => (new URL(input).pathname.endsWith('/files/books-file') ? Response.json({ parents: ['books-folder'] }) : Response.json({ files: [] }))),
    )

    expect(await googleStatementFolder('file-token', 'books-file').files(['.', 'statements'])).toEqual({
      kind: 'refused',
      reason: 'The folder of the books file holds no folder named "statements", so no statements were read. Check the statements_folder setting.',
    })
  })

  it('downloads a file by its id', async () => {
    const requests: URL[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        requests.push(new URL(input))
        return new Response('<Document/>')
      }),
    )

    const bytes = await googleStatementFolder('read-token', 'books-file').download({ id: 'file/1', name: 'a.xml' })

    expect(new TextDecoder().decode(bytes)).toBe('<Document/>')
    expect(requests.map(String)).toEqual(['https://www.googleapis.com/drive/v3/files/file%2F1?alt=media'])
  })
})

describe('driveClient', () => {
  it('lists every page, passing each page token back until Drive sends none', async () => {
    const query = `'folder-id' in parents and trashed = false`
    const requests = stubDrive({
      [`${query}#`]: { files: [{ id: 'a', name: 'a.xml' }], nextPageToken: 'page-2' },
      [`${query}#page-2`]: { files: [{ id: 'b', name: 'b.xml' }], nextPageToken: 'page-3' },
      [`${query}#page-3`]: { files: [{ id: 'c', name: 'c.xml' }] },
    })

    expect(await listChildren('read-token', query, ['id', 'name'])).toEqual([
      { id: 'a', name: 'a.xml' },
      { id: 'b', name: 'b.xml' },
      { id: 'c', name: 'c.xml' },
    ])
    expect(requests.map((url) => url.searchParams.get('pageToken'))).toEqual([null, 'page-2', 'page-3'])
  })

  it('throws Google’s answer for a failed call', async () => {
    stubDrive({})

    await expect(downloadFile('read-token', 'gone')).rejects.toThrow('404 from /drive/v3/files/gone: no page for ')
  })
})
