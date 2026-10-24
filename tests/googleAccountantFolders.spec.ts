import { afterEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'

import { googleAccountantFolders } from '../src/packs/hr-doo/infrastructure/googleAccountantFolders'
import { exportAsXlsx, listChildren } from '../src/shared/google/driveClient'

const FOLDER = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
const FILES = "mimeType != 'application/vnd.google-apps.folder' and trashed = false"
const LISTED = 'nextPageToken,files(id,name,mimeType,version)'

/** An xlsx file with one tab, as Drive would send it. */
function xlsxBytes(tab: string, rows: readonly (readonly (string | number)[])[]): ArrayBuffer {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows.map((row) => [...row])), tab)
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

/** A Drive that answers each search query with the files given for it, and each file id with its bytes, and records every request. */
function stubDrive(listings: Readonly<Record<string, readonly object[]>>, contents: Readonly<Record<string, ArrayBuffer>> = {}): URL[] {
  const requests: URL[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit) => {
      const url = new URL(input)
      requests.push(url)
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer read-token')
      const query = url.searchParams.get('q')
      if (query !== null) {
        const files = listings[query]
        return files === undefined ? new Response(`no listing for ${query}`, { status: 404 }) : Response.json({ files })
      }
      const id = decodeURIComponent(url.pathname.split('/')[4] ?? '')
      const bytes = contents[id]
      return bytes === undefined ? new Response(`no file ${id}`, { status: 404 }) : new Response(bytes)
    }),
  )
  return requests
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('googleAccountantFolders', () => {
  it('walks the path, then lists each level of folders inside it, asking Drive for every file’s version', async () => {
    const requests = stubDrive({
      [`'root' in parents and name = 'finance' and ${FOLDER}`]: [{ id: 'finance-id' }],
      [`'finance-id' in parents and name = 'payroll' and ${FOLDER}`]: [{ id: 'payroll-id' }],
      [`('payroll-id' in parents) and ${FILES}`]: [{ id: 'notes', name: 'index.md', mimeType: 'text/markdown', version: '3' }],
      [`('payroll-id' in parents) and ${FOLDER}`]: [{ id: 'year-2026' }],
      [`('year-2026' in parents) and ${FILES}`]: [],
      [`('year-2026' in parents) and ${FOLDER}`]: [{ id: 'month-05' }, { id: 'month-06' }],
      [`('month-05' in parents or 'month-06' in parents) and ${FILES}`]: [
        { id: 'x5', name: '2026-05-salary.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', version: '7' },
        { id: 's5', name: '2026-05-salary', mimeType: 'application/vnd.google-apps.spreadsheet', version: '12' },
        { id: 'o6', name: '2026-06-payment-order-salary.xml', mimeType: 'text/xml', version: '2' },
      ],
      [`('month-05' in parents or 'month-06' in parents) and ${FOLDER}`]: [],
    })

    const listing = await googleAccountantFolders('read-token').files(['finance', 'payroll'])

    expect(listing).toEqual({
      kind: 'listed',
      files: [
        { id: 'x5', name: '2026-05-salary.xlsx', format: 'xlsx', version: '7' },
        { id: 's5', name: '2026-05-salary', format: 'google-sheet', version: '12' },
      ],
    })
    expect(new Set(requests.map((url) => url.origin + url.pathname))).toEqual(new Set(['https://www.googleapis.com/drive/v3/files']))
    expect(requests.filter((url) => url.searchParams.get('q')?.includes(FILES)).map((url) => url.searchParams.get('fields'))).toEqual([LISTED, LISTED, LISTED])
  })

  it('refuses a path with a missing folder or two of one name, naming where', async () => {
    stubDrive({
      [`'root' in parents and name = 'finance' and ${FOLDER}`]: [{ id: 'finance-1' }, { id: 'finance-2' }],
      [`'root' in parents and name = 'work' and ${FOLDER}`]: [],
    })
    const folders = googleAccountantFolders('read-token')

    expect(await folders.files(['finance', 'vat'])).toEqual({ kind: 'refused', reason: 'My Drive holds 2 folders named "finance", so the app cannot tell which one is meant' })
    expect(await folders.files(['work'])).toEqual({ kind: 'refused', reason: 'My Drive holds no folder named "work"' })
  })

  it('downloads an xlsx and exports a Google Sheet as xlsx, then reads every tab', async () => {
    const bytes = xlsxBytes('Rekapitulacija', [['Vrsta isporuke', 'Osnovica', 'PDV']])
    const requests = stubDrive({}, { 'file/1': bytes, 'sheet/2': bytes })
    const folders = googleAccountantFolders('read-token')

    const downloaded = await folders.tabs({ id: 'file/1', name: '2026-09-pdv.xlsx', format: 'xlsx', version: '1' })
    const exported = await folders.tabs({ id: 'sheet/2', name: '2025-12-pdv', format: 'google-sheet', version: '4' })

    expect(downloaded).toEqual([{ name: 'Rekapitulacija', grid: [['Vrsta isporuke', 'Osnovica', 'PDV']] }])
    expect(exported).toEqual(downloaded)
    expect(requests.map(String)).toEqual([
      'https://www.googleapis.com/drive/v3/files/file%2F1?alt=media',
      'https://www.googleapis.com/drive/v3/files/sheet%2F2/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ])
  })
})

describe('driveClient', () => {
  it('asks for the version with the other fields of a listing', async () => {
    const requests = stubDrive({ "'folder' in parents": [{ id: 'a', version: '5' }] })

    expect(await listChildren('read-token', "'folder' in parents", ['id', 'version'])).toEqual([{ id: 'a', version: '5' }])
    expect(requests[0]?.searchParams.get('fields')).toBe('nextPageToken,files(id,version)')
  })

  it('throws Google’s answer for a failed export', async () => {
    stubDrive({})

    await expect(exportAsXlsx('read-token', 'gone')).rejects.toThrow('404 from /drive/v3/files/gone/export: no file gone')
  })
})
