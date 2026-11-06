// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

import { useDriveFilePlace } from '../src/shared/storage/presentation/useDriveFilePlace'
import { useKunaFolderHome } from '../src/shared/storage/presentation/useKunaFolderHome'

vi.mock('../src/shared/google/withGoogleAccess', () => ({ withGoogleAccess: (_scopes: unknown, action: () => Promise<unknown>) => action() }))

afterEach(() => vi.restoreAllMocks())

describe('where a move says the file goes', () => {
  const store = (answer: () => Promise<boolean | null>) => ({ hasKunaFolder: answer, pickDriveFolder: async () => null })

  it('names no place above Kuna while it does not know, as with no token yet', async () => {
    const home = useKunaFolderHome(store(async () => null))
    await home.read()

    expect(home.trail('assets')).toBe('Kuna › assets')
  })

  it('names My Drive only once it knows it is making the folder there, and asks again each time', async () => {
    let exists: boolean | null = null
    const home = useKunaFolderHome(store(async () => exists))
    await home.read()
    exists = false
    await home.read()
    expect(home.trail('assets')).toBe('My Drive › Kuna › assets')
    expect(home.canChoose.value).toBe(true)

    exists = true
    await home.read()
    expect(home.trail('assets')).toBe('Kuna › assets')
    expect(home.canChoose.value).toBe(false)
  })

  it('reads a failed search as not knowing', async () => {
    const home = useKunaFolderHome(store(async () => Promise.reject(new Error('500'))))
    await home.read()

    expect(home.trail('assets')).toBe('Kuna › assets')
  })
})

describe('where Settings says the file sits', () => {
  it('reads again once a token arrives, though the file has not changed', async () => {
    const holdsToken = ref(false)
    const found = { folderId: 'f', folderName: 'life', lastBackup: null, inKunaFolder: false, moveUnfinished: false }
    const driveFilePlace = vi.fn(async () => (holdsToken.value ? found : null))
    const state = reactive({ choice: { source: 'drive', id: 'file-1', name: 'x' }, snapshot: { revision: 'rev-1', meta: { id: 'file-1', source: 'drive' } } })
    const { place } = useDriveFilePlace({ state, driveFilePlace } as never, () => holdsToken.value)
    await nextTick()
    await nextTick()
    expect(place.value).toBeNull()

    holdsToken.value = true
    await nextTick()
    await nextTick()
    await nextTick()

    expect(place.value).toEqual(found)
  })
})
