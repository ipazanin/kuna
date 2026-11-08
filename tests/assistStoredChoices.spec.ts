// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppContribution } from '../src/shared/app/appContribution'
import { assistLines } from '../src/shell/settings/assistLines'

const OWNER_KEY = 'made-up-anthropic-key-0042'
const OTHER_KEY = 'made-up-openai-key-0077'
const SAVED_AT = '2026-10-30T10:00:00.000Z'

/** What an earlier version of Kuna left in a browser, written by hand so this spec keeps checking the names and the values even if the code's change. */
const BEFORE_THIS_CHANGE: Readonly<Record<string, string>> = {
  'kuna.assist.company': 'on',
  'kuna.assist-task.company.suggest-categories': 'on',
  'kuna.assist-anonymise': 'anthropic',
  'kuna.assist-model.anthropic': 'claude-opus-5-5',
  'kuna.secret.anthropic': OWNER_KEY,
  'kuna.secret-changed.anthropic': SAVED_AT,
  'kuna.secret.openai': OTHER_KEY,
  'kuna.secret-changed.openai': SAVED_AT,
}

/** What reading the choices leaves: all of it but the employee switch a task once kept. */
const KEPT = Object.fromEntries(Object.entries(BEFORE_THIS_CHANGE).filter(([name]) => !name.startsWith('kuna.assist-task.')))

function storedNow(): Record<string, string | null> {
  return Object.fromEntries(Object.keys(localStorage).map((name) => [name, localStorage.getItem(name)]))
}

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
  for (const [name, stored] of Object.entries(BEFORE_THIS_CHANGE)) localStorage.setItem(name, stored)
})

async function page() {
  return { ...(await import('../src/shared/ai/application/assistSettings')), ...(await import('../src/shared/ai/presentation/useAiTask')) }
}

describe('what a browser already holds of the assistant', () => {
  it('keeps every switch, model and key working, with no pick stored, and clears only the employee switch each task once kept', async () => {
    const { anonymiseOn, assistKeyKept, assistOn, modelOf, pickedProvider, providerInUse } = await page()

    expect(assistOn('company')).toBe(true)
    expect(assistOn('spending')).toBe(false)
    expect(anonymiseOn('anthropic')).toBe(false)
    expect(modelOf('anthropic').id).toBe('claude-opus-5-5')
    expect(pickedProvider()).toBeNull()
    expect(providerInUse()?.id).toBe('anthropic')
    expect(assistKeyKept.value).toBe(true)
    expect(storedNow()).toEqual(KEPT)
  })

  it('leaves Anonymise off when the shell stores the company already in use as the pick', async () => {
    const { anonymiseOn, pinProviderInUse, providerInUse, switchProvider } = await page()
    pinProviderInUse()
    expect(localStorage.getItem('kuna.assist-provider')).toBe('anthropic')
    expect(switchProvider('anthropic')).toBe(false)
    expect(anonymiseOn('anthropic')).toBe(false)
    expect(providerInUse()?.id).toBe('anthropic')
    expect(storedNow()).toEqual({ ...KEPT, 'kuna.assist-provider': 'anthropic' })
  })

  it('turns Anonymise back on when moving away from the company in use with no pick stored, and keeps both keys', async () => {
    const { anonymiseOn, assistOn, providerInUse, switchProvider } = await page()
    expect(switchProvider('openai')).toBe(true)
    expect(providerInUse()?.id).toBe('openai')
    expect(anonymiseOn('anthropic')).toBe(true)
    expect(anonymiseOn('openai')).toBe(true)
    expect(assistOn('company')).toBe(true)
    expect(localStorage.getItem('kuna.secret.anthropic')).toBe(OWNER_KEY)
    expect(localStorage.getItem('kuna.secret.openai')).toBe(OTHER_KEY)
  })
})

describe('the lines of the apps in Kuna settings', () => {
  const app = (id: string, assist: unknown, firstRun = false) => ({ id, name: id, assist, firstRun: () => firstRun }) as unknown as AppContribution
  const tasks = (count: number) => ({ settings: `/${count}`, tasks: () => Array.from({ length: count }) })

  it('lists an app that names an assistant, tasks or none, and leaves out one with no assistant or in its first run', () => {
    expect(assistLines([app('none', undefined), app('chat-only', tasks(0)), app('setting-up', tasks(1), true), app('company', tasks(2))])).toEqual([
      { id: 'chat-only', name: 'chat-only', to: '/0' },
      { id: 'company', name: 'company', to: '/2' },
    ])
  })
})

describe('a change in another tab', () => {
  function otherTabWrites(key: string, value: string | null): void {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
  }

  it('reaches the switches and the pick here, so a stale tab neither sends without asking nor uses the old company', async () => {
    const { anonymiseOn, assistOn, providerInUse } = await page()
    expect(assistOn('company')).toBe(true)
    expect(anonymiseOn('anthropic')).toBe(false)
    otherTabWrites('kuna.assist.company', null)
    otherTabWrites('kuna.assist-anonymise', null)
    otherTabWrites('kuna.assist-provider', 'openai')
    expect(assistOn('company')).toBe(false)
    expect(anonymiseOn('anthropic')).toBe(true)
    expect(providerInUse()?.id).toBe('openai')
  })

  it('reaches what shows the keys here', async () => {
    const { useSecretsChanged } = await import('../src/shared/secrets/presentation/pageSecrets')
    const changed = useSecretsChanged()
    const before = changed.value
    otherTabWrites('kuna.assist.spending', 'on')
    expect(changed.value).toBe(before)
    otherTabWrites('kuna.secret.openrouter', 'made-up-openrouter-key-0042')
    expect(changed.value).toBe(before + 1)
  })

  it('keeps a pick another tab has only just stored when this tab pins', async () => {
    const { pickedProvider, pinProvider } = await page()
    expect(pickedProvider()).toBeNull()
    localStorage.setItem('kuna.assist-provider', 'openai')
    pinProvider('anthropic')
    expect(localStorage.getItem('kuna.assist-provider')).toBe('openai')
  })
})
