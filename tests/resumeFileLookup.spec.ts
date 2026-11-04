import type { Router } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import type { RedirectReturn } from '../src/shared/google/googleRedirect'
import type { DriveFileLookup } from '../src/shared/storage/application/workbookPorts'
import { resumeFileLookup } from '../src/shared/storage/presentation/resumeFileLookup'
import type { FileLookupResume } from '../src/shared/storage/presentation/resumeFileLookup'

vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: () => {} }) }))

const WORDS: FileLookupResume['words'] = {
  notOpened: 'Not opened',
  alreadyOpen: 'Already open',
  alreadyOpenNote: (name) => name,
  opened: (name) => `Opened ${name}`,
  openedNote: (name) => name,
}

/** Google's answer to a tap that left the page to find or pick the app's file, or to sync. */
function answer(resume: 'find' | 'pick' | 'sync'): RedirectReturn {
  const token = { value: 'fake-token', scopes: ['drive.file' as const], expiresAt: Date.now() + 3_600_000 }
  return resume === 'sync'
    ? { kind: 'granted', token, asked: ['drive.file'], resume, route: '#/things', ask: 'tap' }
    : { kind: 'granted', token, asked: ['drive.file'], resume, app: 'things', route: '#/things/start?step=find', ask: 'tap' }
}

/** A store whose Drive lookup puts a file on screen, noting each lookup it was asked for. */
function storeFindingFile() {
  const looked: DriveFileLookup[] = []
  const state = { status: 'ready', choice: null as { source: 'drive'; id: string; name: string } | null, error: null }
  const store = {
    state,
    open: async () => {},
    chooseDriveFile: async (lookup: DriveFileLookup) => {
      looked.push(lookup)
      state.choice = { source: 'drive', id: 'things-file', name: 'kuna-things.json' }
    },
  } as unknown as FileLookupResume['store']
  return { store, looked }
}

/** A router on `path` that notes where it is sent. */
function routerOn(path: string) {
  const pushed: string[] = []
  const router = { isReady: async () => {}, currentRoute: { value: { path } }, push: async (to: string) => void pushed.push(to) } as unknown as Router
  return { router, pushed }
}

describe('a find or a pick a trip to Google resumes', () => {
  it.each(['find', 'pick'] as const)('runs the %s and ends on the Overview when the page came back to the first run', async (lookup) => {
    const { store, looked } = storeFindingFile()
    const { router, pushed } = routerOn('/things/start')

    resumeFileLookup({ store, words: WORDS, startRoute: '/things/start', overviewRoute: '/things' }, router, answer(lookup))

    await vi.waitFor(() => expect(pushed).toEqual(['/things']))
    expect(looked).toEqual([lookup])
  })

  it('stays on another route the page came back to', async () => {
    const { store, looked } = storeFindingFile()
    const { router, pushed } = routerOn('/things/settings')

    resumeFileLookup({ store, words: WORDS, startRoute: '/things/start', overviewRoute: '/things' }, router, answer('find'))

    await vi.waitFor(() => expect(looked).toEqual(['find']))
    await Promise.resolve()
    expect(pushed).toEqual([])
  })

  it('does nothing for a return that resumes a sync', async () => {
    const { store, looked } = storeFindingFile()
    const { router, pushed } = routerOn('/things/start')

    resumeFileLookup({ store, words: WORDS, startRoute: '/things/start', overviewRoute: '/things' }, router, answer('sync'))
    await Promise.resolve()

    expect(looked).toEqual([])
    expect(pushed).toEqual([])
  })
})
