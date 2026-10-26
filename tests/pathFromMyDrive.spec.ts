import { afterEach, describe, expect, it, vi } from 'vitest'

import { pathFromMyDrive } from '../src/shared/google/driveClient'

/** A Drive that answers `files.get` for each id with the fields given for it, and 404 for any other, as Drive does under drive.file. */
function stubFiles(files: Readonly<Record<string, object>>): string[] {
  const asked: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const id = decodeURIComponent(new URL(input).pathname.split('/').at(-1)!)
      asked.push(id)
      const file = files[id]
      return file === undefined ? Response.json({ error: { code: 404, message: `File not found: ${id}.`, errors: [{ reason: 'notFound' }] } }, { status: 404 }) : Response.json(file)
    }),
  )
  return asked
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pathFromMyDrive', () => {
  it('walks a picked folder up through its parents to My Drive and names the folders from the top', async () => {
    const asked = stubFiles({
      root: { id: 'root-id' },
      books: { name: 'shadow-accounting', parents: ['dss'] },
      dss: { name: 'dss', parents: ['work'] },
      work: { name: 'work', parents: ['root-id'] },
    })

    expect(await pathFromMyDrive('read-token', 'books')).toEqual(['work', 'dss', 'shadow-accounting'])
    expect(asked).toEqual(['root', 'books', 'dss', 'work'])
  })

  it('names no path for a folder outside My Drive, such as one shared with the person', async () => {
    stubFiles({ root: { id: 'root-id' }, shared: { name: 'shared books', parents: [] } })

    expect(await pathFromMyDrive('read-token', 'shared')).toBeNull()
  })

  it('throws where Drive answers 404 for a parent, as it does for a token with drive.file alone', async () => {
    stubFiles({ books: { name: 'books', parents: ['hidden'] } })

    await expect(pathFromMyDrive('file-token', 'books')).rejects.toThrow()
  })
})
