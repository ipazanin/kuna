// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { trackWrite } from '../src/shared/storage/application/writesInFlight'
import { warnWhileSaving } from '../src/shell/ui/warnWhileSaving'

function closeAttempt(): Event & { returnValue: unknown } {
  const event = new Event('beforeunload', { cancelable: true }) as Event & { returnValue: unknown }
  window.dispatchEvent(event)
  return event
}

describe('the warning on closing the tab', () => {
  let stop: () => void = () => {}

  afterEach(() => {
    stop()
    vi.restoreAllMocks()
  })

  it('listens only while a save waits or runs', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    stop = warnWhileSaving()
    expect(add).not.toHaveBeenCalledWith('beforeunload', expect.anything())

    let land: () => void = () => {}
    const saving = trackWrite(() => new Promise<void>((resolve) => (land = resolve)))
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function))

    land()
    await saving
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('asks the browser to warn while a save waits, and says nothing once it landed', async () => {
    stop = warnWhileSaving()
    let land: () => void = () => {}
    const saving = trackWrite(() => new Promise<void>((resolve) => (land = resolve)))

    const during = closeAttempt()
    expect(during.defaultPrevented).toBe(true)

    land()
    await saving
    expect(closeAttempt().defaultPrevented).toBe(false)
  })

  it('stops listening when stopped during a save', async () => {
    stop = warnWhileSaving()
    let land: () => void = () => {}
    const saving = trackWrite(() => new Promise<void>((resolve) => (land = resolve)))

    stop()
    expect(closeAttempt().defaultPrevented).toBe(false)
    land()
    await saving
  })
})
