import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'

import { browserDocumentHome, deleteBrowserDocument, replaceBrowserDocument } from '../src/shared/storage/infrastructure/browserDocument'

const neverRewritten = async () => {
  throw new Error('The browser never runs a write again.')
}

describe('browserDocumentHome', () => {
  it('reads the document a fresh start keeps, and gives back the cached one while the revision holds', async () => {
    const started = await replaceBrowserDocument('local-read', '{"a":1}')
    const home = browserDocumentHome('local-read')

    expect(started.text).toBe('{"a":1}')
    expect(await home.read(null)).toEqual(started)
    expect(await home.read(started)).toBe(started)
  })

  it('saves over the revision it was read at and gives the save a new revision', async () => {
    const base = await replaceBrowserDocument('local-save', '{"a":1}')
    const home = browserDocumentHome('local-save')

    const saved = await home.save(base, '{"a":2}', neverRewritten)

    expect(saved).toEqual({ kind: 'saved', document: { revision: expect.any(String), text: '{"a":2}' } })
    expect(saved.kind === 'saved' && saved.document.revision).not.toBe(base.revision)
    expect(await home.read(base)).toEqual(saved.kind === 'saved' ? saved.document : null)
  })

  it('stores nothing and says the document moved when another tab saved since the read', async () => {
    const base = await replaceBrowserDocument('local-moved', '{"a":1}')
    await browserDocumentHome('local-moved').save(base, '{"a":2}', neverRewritten)

    expect(await browserDocumentHome('local-moved').save(base, '{"a":3}', neverRewritten)).toEqual({ kind: 'moved' })
    expect((await browserDocumentHome('local-moved').read(null)).text).toBe('{"a":2}')
  })

  it('moves the revision on when an import replaces the document, so a tab holding the old one rereads', async () => {
    const base = await replaceBrowserDocument('local-replace', '{"a":1}')

    expect(await replaceBrowserDocument('local-replace', '{"b":1}')).toEqual({ revision: expect.not.stringMatching(base.revision), text: '{"b":1}' })
    expect(await browserDocumentHome('local-replace').save(base, '{"a":2}', neverRewritten)).toEqual({ kind: 'moved' })
  })

  it('never gives a revision again after the database was deleted and made anew, so a tab holding the old one rereads', async () => {
    const base = await replaceBrowserDocument('local-again', '{"a":1}')
    await deleteBrowserDocument('local-again')

    const again = await replaceBrowserDocument('local-again', '{"a":1}')

    expect(again.revision).not.toBe(base.revision)
    expect(await browserDocumentHome('local-again').save(base, '{"a":2}', neverRewritten)).toEqual({ kind: 'moved' })
  })

  it('says so when the browser holds no document', async () => {
    await expect(browserDocumentHome('local-gone').read(null)).rejects.toThrow('This browser no longer holds the workbook.')
  })
})
