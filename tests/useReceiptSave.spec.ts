import { describe, expect, it, vi } from 'vitest'

import type { ReceiptPhotos } from '../src/apps/spending/receipts/application/receiptPhotos'
import { useReceiptSave } from '../src/apps/spending/receipts/presentation/useReceiptSave'
import { civil } from './fixtures/ledger'

const PHOTO = { file: new File(['made-up'], 'photo.jpg', { type: 'image/jpeg' }), issuedOn: civil('2026-11-03') }

/** Photos whose upload waits until told, and which number their ids. */
function drive() {
  let uploads = 0
  const waiting: (() => void)[] = []
  const photos: ReceiptPhotos = {
    keep: async () => {
      uploads += 1
      const id = `photo-${uploads}`
      await new Promise<void>((resolve) => waiting.push(resolve))
      return id
    },
  }
  return { photos: async () => photos, finish: () => waiting.shift()?.(), uploads: () => uploads }
}

describe('saving a receipt', () => {
  it('ignores a second tap during the upload, so one photo and one row are made', async () => {
    const { photos, finish, uploads } = drive()
    const { save, saving } = useReceiptSave(photos)
    const write = vi.fn(async () => true)

    const first = save(PHOTO, write)
    expect(saving.value).toBe(true)
    expect(await save(PHOTO, write)).toEqual({ kind: 'busy' })
    await vi.waitFor(() => expect(uploads()).toBe(1))
    finish()

    expect(await first).toEqual({ kind: 'saved' })
    expect(saving.value).toBe(false)
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith('photo-1')
  })

  it('ignores a second tap during the write', async () => {
    const { save } = useReceiptSave(async () => ({ keep: async () => 'id' }))
    let done: (went: boolean) => void = () => {}
    const write = vi.fn(() => new Promise<boolean>((resolve) => (done = resolve)))

    const first = save(null, write)
    await vi.waitFor(() => expect(write).toHaveBeenCalled())
    expect(await save(null, write)).toEqual({ kind: 'busy' })
    done(true)

    expect(await first).toEqual({ kind: 'saved' })
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('uploads once across a refused write and its retry, so no photo is left behind', async () => {
    const { photos, finish, uploads } = drive()
    const { save } = useReceiptSave(photos)
    const seen: string[] = []
    const write = vi.fn(async (id: string) => {
      seen.push(id)
      return seen.length > 1
    })

    const refused = save(PHOTO, write)
    await vi.waitFor(() => expect(uploads()).toBe(1))
    finish()
    expect(await refused).toEqual({ kind: 'refused' })

    expect(await save(PHOTO, write)).toEqual({ kind: 'saved' })
    expect(uploads()).toBe(1)
    expect(seen).toEqual(['photo-1', 'photo-1'])
  })

  it('uploads again for another photo', async () => {
    const { photos, finish, uploads } = drive()
    const { save } = useReceiptSave(photos)
    const write = async () => false
    const first = save(PHOTO, write)
    await vi.waitFor(() => expect(uploads()).toBe(1))
    finish()
    await first

    const second = save({ ...PHOTO, file: new File(['other'], 'other.jpg') }, write)
    await vi.waitFor(() => expect(uploads()).toBe(2))
    finish()
    await second
  })

  it('writes nothing when the upload fails, and says why', async () => {
    const write = vi.fn(async () => true)
    const { save, saving } = useReceiptSave(async () => ({
      keep: async () => {
        throw new Error('Drive said no')
      },
    }))

    expect(await save(PHOTO, write)).toEqual({ kind: 'photo-failed', reason: 'Drive said no' })
    expect(write).not.toHaveBeenCalled()
    expect(saving.value).toBe(false)
  })

  it('writes with no photo id when none is kept', async () => {
    const write = vi.fn(async () => true)
    const { save } = useReceiptSave(async () => ({ keep: async () => 'never' }))

    await save(null, write)

    expect(write).toHaveBeenCalledWith('')
  })
})
