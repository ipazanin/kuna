import { afterEach, describe, expect, it, vi } from 'vitest'

import { gmailDrafts } from '../src/apps/company/invoicing/infrastructure/googleInvoiceDrive'
import { GoogleTimedOut } from '../src/shared/google/googleApi'
import { hangingFetch } from './fixtures/hangingFetch'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('a Gmail draft that never answers', () => {
  it('gives up after two minutes, as long as an upload of a file to Drive waits', async () => {
    const google = hangingFetch()
    const draft = gmailDrafts('token').create({ to: 'billing@example.com', subject: 'Invoice 1-1-1', body: 'Attached.' }, { fileName: 'invoice.pdf', pdf: new Uint8Array([37, 80, 68, 70]) })
    google.giveUp()

    await expect(draft).rejects.toBeInstanceOf(GoogleTimedOut)
    expect(google.waits).toEqual([120_000])
  })
})
