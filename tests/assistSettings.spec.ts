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

  it('reads a stored value it does not know as no choice', async () => {
    localStorage.setItem('kuna.assist-provider', 'someone-else')
    localStorage.setItem('kuna.assist-model.anthropic', 'claude-made-up')
    const { modelOf, pickedProvider } = await settings()
    expect(pickedProvider()).toBeNull()
    expect(modelOf('anthropic').id).toBe('claude-sonnet-5-5')
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
