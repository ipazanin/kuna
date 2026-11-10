// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function settings() {
  return import('../src/shared/ai/application/assistSettings')
}

describe("this device's assistant settings", () => {
  it('starts with no AI company allowed, Anonymise on for every AI company, no provider picked and each default model', async () => {
    const { anonymiseOn, assistAllowed, modelOf, pickedProvider } = await settings()
    expect(assistAllowed('anthropic')).toBe(false)
    expect(anonymiseOn('anthropic')).toBe(true)
    expect(anonymiseOn('openai')).toBe(true)
    expect(pickedProvider()).toBeNull()
    expect(modelOf('anthropic').id).toBe('claude-sonnet-5-5')
  })

  it('allows one AI company and keeps it for the next visit, leaving the others asking', async () => {
    const first = await settings()
    first.allowAssist('anthropic', true)
    expect(localStorage.getItem('kuna.assist-allowed.anthropic')).toBe('on')
    vi.resetModules()
    const next = await settings()
    expect(next.assistAllowed('anthropic')).toBe(true)
    expect(next.assistAllowed('openai')).toBe(false)
    next.allowAssist('anthropic', false)
    expect(localStorage.getItem('kuna.assist-allowed.anthropic')).toBeNull()
  })

  it("carries an app's old yes over to the AI company in use, and removes every app's old switch", async () => {
    localStorage.setItem('kuna.assist.company', 'on')
    localStorage.setItem('kuna.assist.spending', 'off')
    const { assistAllowed, carryOverAppYes } = await settings()
    expect(assistAllowed('openai')).toBe(false)
    carryOverAppYes('openai')
    expect(assistAllowed('openai')).toBe(true)
    expect(localStorage.getItem('kuna.assist-allowed.openai')).toBe('on')
    expect(localStorage.getItem('kuna.assist.company')).toBeNull()
    expect(localStorage.getItem('kuna.assist.spending')).toBeNull()
    expect(assistAllowed('anthropic')).toBe(false)
  })

  it('carries over no yes when no app had its old switch on, and still removes the old keys', async () => {
    localStorage.setItem('kuna.assist.loans', 'off')
    const { assistAllowed, carryOverAppYes } = await settings()
    carryOverAppYes('anthropic')
    expect(assistAllowed('anthropic')).toBe(false)
    expect(localStorage.getItem('kuna.assist-allowed.anthropic')).toBeNull()
    expect(localStorage.getItem('kuna.assist.loans')).toBeNull()
  })

  it('keeps a picked model and provider, and forgets a pick of the default', async () => {
    const { modelOf, pickModel, pickProvider, pickedProvider } = await settings()
    pickModel('anthropic', 'claude-opus-5-5')
    pickProvider('openai')
    expect(modelOf('anthropic').id).toBe('claude-opus-5-5')
    expect(pickedProvider()).toBe('openai')
    pickModel('anthropic', 'claude-sonnet-5-5')
    expect(localStorage.getItem('kuna.assist-model.anthropic')).toBeNull()
  })

  it('reads a provider it does not know as no choice', async () => {
    localStorage.setItem('kuna.assist-provider', 'someone-else')
    const { pickedProvider } = await settings()
    expect(pickedProvider()).toBeNull()
  })

  it('keeps a typed model, trimmed and with no price, and an empty field goes back to the default', async () => {
    const { modelOf, pickModel } = await settings()
    pickModel('openrouter', '  made-up/model:free ')
    expect(localStorage.getItem('kuna.assist-model.openrouter')).toBe('made-up/model:free')
    expect(modelOf('openrouter')).toEqual({ id: 'made-up/model:free', name: 'made-up/model:free', price: null })
    pickModel('openrouter', '   ')
    expect(localStorage.getItem('kuna.assist-model.openrouter')).toBeNull()
    expect(modelOf('openrouter').id).toBe('anthropic/claude-sonnet-5-5')
  })

  it('keeps Anonymise off only for the AI company it was switched off for, and reads every other as on', async () => {
    const first = await settings()
    first.switchAnonymise('anthropic', false)
    expect(localStorage.getItem('kuna.assist-anonymise')).toBe('anthropic')
    vi.resetModules()
    const next = await settings()
    expect(next.anonymiseOn('anthropic')).toBe(false)
    expect(next.anonymiseOn('openai')).toBe(true)
    expect(next.anonymiseOn('openrouter')).toBe(true)
    next.switchAnonymise('anthropic', true)
    expect(localStorage.getItem('kuna.assist-anonymise')).toBeNull()
  })

  it('turns Anonymise back on at a real change of AI company, and nothing else', async () => {
    localStorage.setItem('kuna.assist-allowed.anthropic', 'on')
    localStorage.setItem('kuna.assist-provider', 'anthropic')
    localStorage.setItem('kuna.assist-anonymise', 'anthropic')
    localStorage.setItem('kuna.assist-model.anthropic', 'claude-opus-5-5')
    localStorage.setItem('kuna.secret.anthropic', 'made-up-anthropic-key-0042')
    const { anonymiseOn, assistAllowed, modelOf, pickProvider } = await settings()

    expect(pickProvider('anthropic')).toBe(false)
    expect(anonymiseOn('anthropic')).toBe(false)

    expect(pickProvider('openai')).toBe(true)
    expect(anonymiseOn('openai')).toBe(true)
    expect(anonymiseOn('anthropic')).toBe(true)
    expect(localStorage.getItem('kuna.assist-anonymise')).toBeNull()
    expect(assistAllowed('anthropic')).toBe(true)
    expect(assistAllowed('openai')).toBe(false)
    expect(modelOf('anthropic').id).toBe('claude-opus-5-5')
    expect(localStorage.getItem('kuna.secret.anthropic')).toBe('made-up-anthropic-key-0042')

    expect(pickProvider('anthropic')).toBe(false)
  })

  it('turns Anonymise back on at a change of AI company made while storage is denied', async () => {
    const { anonymiseOn, pickProvider, switchAnonymise } = await settings()
    pickProvider('anthropic')
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError')
      })
    }
    switchAnonymise('anthropic', false)
    expect(pickProvider('openai')).toBe(true)
    expect(anonymiseOn('anthropic')).toBe(true)
  })

  it('pins the provider in use with Anonymise left as it is, and leaves a stored pick alone', async () => {
    localStorage.setItem('kuna.assist-anonymise', 'openai')
    const { anonymiseOn, pickedProvider, pinProvider } = await settings()
    pinProvider('openai')
    expect(pickedProvider()).toBe('openai')
    expect(anonymiseOn('openai')).toBe(false)
    pinProvider('anthropic')
    expect(pickedProvider()).toBe('openai')
  })

  it('clears the employee switch each task kept before Anonymise replaced them', async () => {
    localStorage.setItem('kuna.assist-task.company.suggest-categories', 'on')
    localStorage.setItem('kuna.assist-task.hr-doo.explain-figure', 'on')
    localStorage.setItem('kuna.assist-allowed.anthropic', 'on')
    const { assistAllowed } = await settings()
    expect(localStorage.getItem('kuna.assist-task.company.suggest-categories')).toBeNull()
    expect(localStorage.getItem('kuna.assist-task.hr-doo.explain-figure')).toBeNull()
    expect(assistAllowed('anthropic')).toBe(true)
  })

  it('holds a choice for the visit when storage is denied', async () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError')
      })
    }
    const { allowAssist, assistAllowed } = await settings()
    expect(assistAllowed('anthropic')).toBe(false)
    expect(() => allowAssist('anthropic', true)).not.toThrow()
    expect(assistAllowed('anthropic')).toBe(true)
  })
})
