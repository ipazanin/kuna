// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('the answer to the one start', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('is none on a new device, and is kept on this device', async () => {
    const { answerKunaStart, kunaStart } = await import('../src/shared/app/kunaStart')
    expect(kunaStart()).toBeNull()

    answerKunaStart({ apps: ['loans'], home: 'drive' })

    vi.resetModules()
    const again = await import('../src/shared/app/kunaStart')
    expect(again.kunaStart()).toEqual({ apps: ['loans'], home: 'drive' })
  })

  it('reads anything else in storage as no answer, so it only asks once more', async () => {
    localStorage.setItem('kuna.start', JSON.stringify({ home: 'moon', apps: [] }))
    expect((await import('../src/shared/app/kunaStart')).kunaStart()).toBeNull()
    vi.resetModules()
    localStorage.setItem('kuna.start', '{not json')
    expect((await import('../src/shared/app/kunaStart')).kunaStart()).toBeNull()
  })

  it('adds an app a first run answered for to what was said, and can be taken back', async () => {
    const { answerFromFirstRun, answerKunaStart, forgetKunaStart, kunaStart } = await import('../src/shared/app/kunaStart')
    answerKunaStart({ apps: ['loans'], home: 'browser' })

    answerFromFirstRun('drive', 'assets', false)
    expect(kunaStart()).toEqual({ apps: ['loans', 'assets'], home: 'drive' })

    forgetKunaStart()
    expect(kunaStart()).toBeNull()
    expect(localStorage.getItem('kuna.start')).toBeNull()
  })

  it('keeps the answer when someone with a file open only came to change that file', async () => {
    const { answerFromFirstRun, answerKunaStart, kunaStart } = await import('../src/shared/app/kunaStart')
    answerKunaStart({ apps: ['company'], home: 'drive' })

    answerFromFirstRun('browser', 'company', true)

    expect(kunaStart()).toEqual({ apps: ['company'], home: 'drive' })
  })
})
