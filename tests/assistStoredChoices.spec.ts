// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const OWNER_KEY = 'made-up-anthropic-key-0042'
const OTHER_KEY = 'made-up-openai-key-0077'
const SAVED_AT = '2026-10-30T10:00:00.000Z'

/** What an earlier version of Kuna left in a browser, written by hand so this spec keeps checking the names and the values even if the code's change. */
const BEFORE_THIS_CHANGE: Readonly<Record<string, string>> = {
  'kuna.assist.company': 'on',
  'kuna.assist-task.company.suggest-categories': 'on',
  'kuna.assist-model.anthropic': 'claude-opus-5-5',
  'kuna.secret.anthropic': OWNER_KEY,
  'kuna.secret-changed.anthropic': SAVED_AT,
  'kuna.secret.openai': OTHER_KEY,
  'kuna.secret-changed.openai': SAVED_AT,
}

function storedNow(): Record<string, string | null> {
  return Object.fromEntries(Object.keys(localStorage).map((name) => [name, localStorage.getItem(name)]))
}

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
  for (const [name, stored] of Object.entries(BEFORE_THIS_CHANGE)) localStorage.setItem(name, stored)
})

async function page() {
  return { ...(await import('../src/shared/ai/infrastructure/assistSettings')), ...(await import('../src/shared/ai/presentation/useAiTask')) }
}

describe('what a browser already holds of the assistant', () => {
  it('keeps every switch, model and key working, with no pick stored and nothing rewritten by reading them', async () => {
    const { assistKeyKept, assistOn, employeesOn, modelOf, pickedProvider, providerInUse } = await page()

    expect(assistOn('company')).toBe(true)
    expect(assistOn('spending')).toBe(false)
    expect(employeesOn('company.suggest-categories')).toBe(true)
    expect(modelOf('anthropic').id).toBe('claude-opus-5-5')
    expect(pickedProvider()).toBeNull()
    expect(providerInUse()?.id).toBe('anthropic')
    expect(assistKeyKept.value).toBe(true)
    expect(storedNow()).toEqual(BEFORE_THIS_CHANGE)
  })

  it('takes no yes back when the company already in use gets stored as the pick', async () => {
    const { employeesOn, pinProviderInUse, providerInUse, switchProvider } = await page()
    pinProviderInUse()
    expect(localStorage.getItem('kuna.assist-provider')).toBe('anthropic')
    expect(switchProvider('anthropic')).toBe(false)
    expect(employeesOn('company.suggest-categories')).toBe(true)
    expect(providerInUse()?.id).toBe('anthropic')
    expect(storedNow()).toEqual({ ...BEFORE_THIS_CHANGE, 'kuna.assist-provider': 'anthropic' })
  })

  it('takes a yes back when moving away from the company in use with no pick stored, and keeps both keys', async () => {
    const { assistOn, employeesOn, providerInUse, switchProvider } = await page()
    expect(switchProvider('openai')).toBe(true)
    expect(providerInUse()?.id).toBe('openai')
    expect(employeesOn('company.suggest-categories')).toBe(false)
    expect(assistOn('company')).toBe(true)
    expect(localStorage.getItem('kuna.secret.anthropic')).toBe(OWNER_KEY)
    expect(localStorage.getItem('kuna.secret.openai')).toBe(OTHER_KEY)
  })

  it('once pinned, stays on its company when a sync brings a key that sorts first', async () => {
    localStorage.removeItem('kuna.secret.anthropic')
    localStorage.removeItem('kuna.secret-changed.anthropic')
    const { employeesOn, pinProviderInUse, providerInUse } = await page()
    const { keepSyncedSecrets } = await import('../src/shared/secrets/presentation/pageSecrets')
    expect(providerInUse()?.id).toBe('openai')
    pinProviderInUse()
    keepSyncedSecrets({ anthropic: { key: OWNER_KEY, changedAt: SAVED_AT } })
    expect(providerInUse()?.id).toBe('openai')
    expect(employeesOn('company.suggest-categories')).toBe(true)
  })
})

describe('where the assistant has no tasks', () => {
  const read = (file: string) => readFileSync(join(import.meta.dirname, '..', file), 'utf8')

  it.each(['loans', 'assets', 'investments'])('%s publishes no assistant, so it gets no tab and no line in Kuna settings', (app) => {
    expect(read(`src/apps/${app}/app.ts`)).not.toMatch(/\bassist\s*:/)
  })

  it('leaves out an app with no assistant, with no tasks or in its first run', () => {
    expect(read('src/shell/settings/SettingsScreen.vue')).toContain('app.assist === undefined || app.firstRun() || app.assist.tasks().length === 0')
  })
})
