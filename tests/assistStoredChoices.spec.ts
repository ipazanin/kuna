// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

/** What the shell's pin of the company in use leaves: the pick, and each app's yes become the yes of that company. */
const PINNED = {
  ...Object.fromEntries(Object.entries(KEPT).filter(([name]) => !name.startsWith('kuna.assist.'))),
  'kuna.assist-allowed.anthropic': 'on',
  'kuna.assist-provider': 'anthropic',
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
  return { ...(await import('../src/shared/ai/application/assistSettings')), ...(await import('../src/shared/ai/presentation/aiProvider')) }
}

describe('what a browser already holds of the assistant', () => {
  it('keeps every model and key working, with no pick stored, and clears only the employee switch each task once kept', async () => {
    const { anonymiseOn, assistKeyKept, modelOf, pickedProvider, providerInUse } = await page()

    expect(anonymiseOn('anthropic')).toBe(false)
    expect(modelOf('anthropic').id).toBe('claude-opus-5-5')
    expect(pickedProvider()).toBeNull()
    expect(providerInUse()?.id).toBe('anthropic')
    expect(assistKeyKept.value).toBe(true)
    expect(storedNow()).toEqual(KEPT)
  })

  it("leaves Anonymise off when the shell stores the company already in use as the pick, and gives that company an app's old yes", async () => {
    const { anonymiseOn, assistAllowed, assistAllowedNow, pinProviderInUse, providerInUse, switchProvider } = await page()
    expect(assistAllowedNow()).toBe(false)
    pinProviderInUse()
    expect(assistAllowedNow()).toBe(true)
    expect(assistAllowed('openai')).toBe(false)
    expect(localStorage.getItem('kuna.assist-provider')).toBe('anthropic')
    expect(switchProvider('anthropic')).toBe(false)
    expect(anonymiseOn('anthropic')).toBe(false)
    expect(providerInUse()?.id).toBe('anthropic')
    expect(storedNow()).toEqual(PINNED)
  })

  it("turns Anonymise back on when moving away from the company in use with no pick stored, keeps both keys, and leaves the app's old yes with the company it carried over to", async () => {
    const { anonymiseOn, assistAllowed, assistAllowedNow, providerInUse, switchProvider } = await page()
    expect(switchProvider('openai')).toBe(true)
    expect(providerInUse()?.id).toBe('openai')
    expect(anonymiseOn('anthropic')).toBe(true)
    expect(anonymiseOn('openai')).toBe(true)
    expect(assistAllowedNow()).toBe(false)
    expect(assistAllowed('anthropic')).toBe(true)
    expect(localStorage.getItem('kuna.secret.anthropic')).toBe(OWNER_KEY)
    expect(localStorage.getItem('kuna.secret.openai')).toBe(OTHER_KEY)
  })
})

describe('a change in another tab', () => {
  function otherTabWrites(key: string, value: string | null): void {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
  }

  it('reaches the switches and the pick here, so a stale tab neither sends without asking nor uses the old company', async () => {
    const { anonymiseOn, assistAllowed, pinProviderInUse, providerInUse } = await page()
    pinProviderInUse()
    expect(assistAllowed('anthropic')).toBe(true)
    expect(anonymiseOn('anthropic')).toBe(false)
    otherTabWrites('kuna.assist-allowed.anthropic', null)
    otherTabWrites('kuna.assist-anonymise', null)
    otherTabWrites('kuna.assist-provider', 'openai')
    expect(assistAllowed('anthropic')).toBe(false)
    expect(anonymiseOn('anthropic')).toBe(true)
    expect(providerInUse()?.id).toBe('openai')
  })

  it('reaches what shows the keys here', async () => {
    const { useSecretsChanged } = await import('../src/shared/secrets/presentation/pageSecrets')
    const changed = useSecretsChanged()
    const before = changed.value
    otherTabWrites('kuna.assist-allowed.openai', 'on')
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
