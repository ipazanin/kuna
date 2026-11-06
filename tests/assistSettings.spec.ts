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
  return import('../src/shared/ai/infrastructure/assistSettings')
}

describe("this device's assistant settings", () => {
  it('starts with every app and every employee switch off, no provider picked and each default model', async () => {
    const { assistOn, employeesOn, modelOf, pickedProvider } = await settings()
    expect(assistOn('company')).toBe(false)
    expect(employeesOn('company.suggest-categories')).toBe(false)
    expect(pickedProvider()).toBeNull()
    expect(modelOf('anthropic').id).toBe('claude-sonnet-5-5')
  })

  it('switches one app on and keeps it for the next visit, leaving the others off', async () => {
    const first = await settings()
    first.switchAssist('company', true)
    expect(localStorage.getItem('kuna.assist.company')).toBe('on')
    vi.resetModules()
    const next = await settings()
    expect(next.assistOn('company')).toBe(true)
    expect(next.assistOn('investments')).toBe(false)
    next.switchAssist('company', false)
    expect(localStorage.getItem('kuna.assist.company')).toBeNull()
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

  it('takes back every yes on employee data on a real change of provider, and nothing else', async () => {
    localStorage.setItem('kuna.assist-task.company.suggest-categories', 'on')
    localStorage.setItem('kuna.assist-task.hr-doo.explain-figure', 'on')
    localStorage.setItem('kuna.assist.company', 'on')
    localStorage.setItem('kuna.assist-provider', 'anthropic')
    localStorage.setItem('kuna.assist-model.anthropic', 'claude-opus-5-5')
    localStorage.setItem('kuna.secret.anthropic', 'made-up-anthropic-key-0042')
    const { assistOn, employeesOn, modelOf, pickProvider } = await settings()

    expect(pickProvider('anthropic')).toBe(false)
    expect(employeesOn('hr-doo.explain-figure')).toBe(true)

    expect(pickProvider('openai')).toBe(true)
    expect(employeesOn('company.suggest-categories')).toBe(false)
    expect(employeesOn('hr-doo.explain-figure')).toBe(false)
    expect(localStorage.getItem('kuna.assist-task.company.suggest-categories')).toBeNull()
    expect(localStorage.getItem('kuna.assist-task.hr-doo.explain-figure')).toBeNull()
    expect(assistOn('company')).toBe(true)
    expect(modelOf('anthropic').id).toBe('claude-opus-5-5')
    expect(localStorage.getItem('kuna.secret.anthropic')).toBe('made-up-anthropic-key-0042')

    expect(pickProvider('anthropic')).toBe(false)
  })

  it('takes back a yes given this visit while storage is denied', async () => {
    const { employeesOn, pickProvider, switchEmployees } = await settings()
    pickProvider('anthropic')
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError')
      })
    }
    switchEmployees('company.suggest-categories', true)
    expect(pickProvider('openai')).toBe(true)
    expect(employeesOn('company.suggest-categories')).toBe(false)
  })

  it('pins the provider in use with no yes taken back, and leaves a stored pick alone', async () => {
    localStorage.setItem('kuna.assist-task.company.suggest-categories', 'on')
    const { employeesOn, pickedProvider, pinProvider } = await settings()
    pinProvider('openai')
    expect(pickedProvider()).toBe('openai')
    expect(employeesOn('company.suggest-categories')).toBe(true)
    pinProvider('anthropic')
    expect(pickedProvider()).toBe('openai')
  })

  it('holds a choice for the visit when storage is denied', async () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError')
      })
    }
    const { assistOn, switchAssist } = await settings()
    expect(assistOn('company')).toBe(false)
    expect(() => switchAssist('company', true)).not.toThrow()
    expect(assistOn('company')).toBe(true)
  })
})
