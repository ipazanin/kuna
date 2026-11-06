import { afterEach, describe, expect, it, vi } from 'vitest'

import { googleReceiptPhotos } from '../src/apps/spending/receipts/infrastructure/googleReceiptPhotos'
import { civil } from './fixtures/ledger'

interface Asked {
  readonly url: string
  readonly method: string
}

/** Answers as Drive does: the books file's parent, the folders the query finds, a made folder and an uploaded file. */
function driveWith(folders: readonly { readonly id: string }[]): Asked[] {
  const asked: Asked[] = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    asked.push({ url, method })
    if (url.includes('/upload/')) return Response.json({ id: 'photo-id' })
    if (method === 'POST') return Response.json({ id: 'made-folder', name: 'Receipts', mimeType: 'application/vnd.google-apps.folder' })
    if (url.includes('/files/books-file')) return Response.json({ parents: ['books-folder'] })
    return Response.json({ files: folders })
  })
  return asked
}

const PHOTO = new File(['made-up bytes'], 'IMG_0001.JPG', { type: 'image/jpeg' })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("the Drive home of a receipt's photo", () => {
  it('uploads into the Receipts folder beside the file when it is there, and gives the file id', async () => {
    const asked = driveWith([{ id: 'receipts-folder' }])

    expect(await googleReceiptPhotos('token', 'books-file').keep(PHOTO, civil('2026-11-03'))).toBe('photo-id')

    expect(asked.filter((request) => request.method === 'POST').map((request) => request.url.includes('/upload/'))).toEqual([true])
    const listing = decodeURIComponent(asked.find((request) => request.url.includes('q='))!.url).replaceAll('+', ' ')
    expect(listing).toContain("'books-folder' in parents and name = 'Receipts'")
    expect(listing).toContain('trashed = false')
  })

  it('makes the folder on first use', async () => {
    const asked = driveWith([])

    await googleReceiptPhotos('token', 'books-file').keep(PHOTO, civil('2026-11-03'))

    expect(asked.filter((request) => request.method === 'POST').map((request) => request.url.includes('/upload/'))).toEqual([false, true])
  })
})
