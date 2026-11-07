// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import { onChoiceChangedElsewhere } from '../src/shared/storage/infrastructure/workbookChoice'

function stored(key: string | null, newValue: string | null, area: Storage = localStorage): void {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: area }))
}

describe('another tab changing an app’s file', () => {
  it('tells the page when that app’s choice is set, removed or the storage is cleared, and at nothing else', () => {
    const forgotten = vi.fn()
    const chosen = vi.fn()
    onChoiceChangedElsewhere('loans', { forgotten, chosen })

    stored('kuna.workbook-file.assets', null)
    stored('kuna.workbook-file.assets', '{"source":"browser","id":"local-1","name":"x"}')
    stored('kuna.workbook-file.loans', null, sessionStorage)
    expect(forgotten).not.toHaveBeenCalled()
    expect(chosen).not.toHaveBeenCalled()

    stored('kuna.workbook-file.loans', '{"source":"browser","id":"local-1","name":"x"}')
    expect(chosen).toHaveBeenCalledTimes(1)
    expect(forgotten).not.toHaveBeenCalled()

    stored('kuna.workbook-file.loans', null)
    expect(forgotten).toHaveBeenCalledTimes(1)

    stored(null, null)
    expect(forgotten).toHaveBeenCalledTimes(2)
    expect(chosen).toHaveBeenCalledTimes(1)
  })
})
