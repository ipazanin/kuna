// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { effectScope, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { KeyTest } from '../src/shared/ai/domain/providerPresets'

const ANTHROPIC_KEY = 'made-up-anthropic-key-0042'
const OPENAI_KEY = 'made-up-openai-key-0077'
const TYPO = 'made-up-typo-in-the-key-1234'
const SAVED_AT = '2026-10-30T10:00:00.000Z'
/** Anonymise switched off for OpenAI, which a real change of AI company turns back on. */
const ANONYMISE_OFF = 'kuna.assist-anonymise'

const test = vi.hoisted(() => ({ answer: { kind: 'works' } as KeyTest }))

vi.mock('../src/shared/ai/application/modelAccess', async (original) => ({
  ...(await original<typeof import('../src/shared/ai/application/modelAccess')>()),
  testProviderKey: async () => test.answer,
}))

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
  test.answer = { kind: 'works' }
})

interface Started {
  readonly stored?: Readonly<Record<string, string>>
  readonly brought?: () => void
}

/** The card as Kuna settings starts it: the shell holds the provider in use first, then the card opens. */
async function card({ stored = {}, brought }: Started = {}) {
  for (const [name, value] of Object.entries(stored)) localStorage.setItem(name, value)
  const { holdProviderInUse, providerInUse } = await import('../src/shared/ai/presentation/useAiTask')
  const { anonymiseOn } = await import('../src/shared/ai/application/assistSettings')
  const { keepSyncedSecrets } = await import('../src/shared/secrets/presentation/pageSecrets')
  const { useAssistantCard } = await import('../src/shared/ai/presentation/useAssistantCard')
  holdProviderInUse()
  const announced: { title: string; undo: () => void }[] = []
  const scope = effectScope()
  const view = scope.run(() => useAssistantCard((title, undo) => announced.push({ title, undo })))!
  const fetchKey = () =>
    view.fetchKey(async () => {
      brought?.()
      return null
    })
  return { view, fetchKey, announced, inUse: () => providerInUse()?.id ?? null, anonymiseOff: () => !anonymiseOn('openai'), keepSyncedSecrets }
}

async function saveTyped(view: Awaited<ReturnType<typeof card>>['view'], key: string): Promise<void> {
  view.typed.value = key
  await view.save()
  await nextTick()
}

const OPENAI_IN_USE = { 'kuna.secret.openai': OPENAI_KEY, [ANONYMISE_OFF]: 'openai' }

describe('the provider changes only by a person on the select', () => {
  it('stays on the company in use when a key for another is accepted, with no pick stored before, and says how to switch', async () => {
    const { view, inUse, anonymiseOff } = await card({ stored: OPENAI_IN_USE })
    view.pick('anthropic')
    await nextTick()
    expect(view.keepsUsing.value).toContain('Kuna keeps using OpenAI')
    await saveTyped(view, ANTHROPIC_KEY)

    expect(localStorage.getItem('kuna.secret.anthropic')).toBe(ANTHROPIC_KEY)
    expect(inUse()).toBe('openai')
    expect(localStorage.getItem('kuna.assist-provider')).toBe('openai')
    expect(anonymiseOff()).toBe(true)
    expect(view.shownId.value).toBe('openai')
    expect(view.savedAsideLines.value.join(' ')).toContain('Your Anthropic key is saved. Kuna keeps using OpenAI until you pick Anthropic here.')
  })

  it('moves on the pick that follows, and turns Anonymise back on then', async () => {
    const { view, inUse, anonymiseOff } = await card({ stored: OPENAI_IN_USE })
    view.pick('anthropic')
    await nextTick()
    await saveTyped(view, ANTHROPIC_KEY)
    view.pick('anthropic')
    await nextTick()

    expect(inUse()).toBe('anthropic')
    expect(anonymiseOff()).toBe(false)
    expect(view.movedHere.value).toMatchObject({ to: 'anthropic', from: 'openai', anonymiseBack: true })
    expect(view.otherKept.value?.id).toBe('openai')
  })

  it('leaves the assistant alone when someone only looks at a company with no key', async () => {
    const { view, inUse, anonymiseOff } = await card({ stored: OPENAI_IN_USE })
    view.pick('openrouter')
    await nextTick()
    expect(inUse()).toBe('openai')
    expect(anonymiseOff()).toBe(true)
    expect(view.shownId.value).toBe('openrouter')
  })

  it('takes a pick of a company with no key at once while the assistant has no key to lose', async () => {
    const { view, inUse } = await card()
    view.pick('openai')
    await nextTick()
    expect(inUse()).toBe('openai')
    await saveTyped(view, OPENAI_KEY)
    expect(inUse()).toBe('openai')
    expect(view.shownId.value).toBe('openai')
  })

  it('stays on a key that a Test now refuses, since only the select moves it', async () => {
    const { view, inUse } = await card({ stored: { 'kuna.secret.openai': OPENAI_KEY } })
    test.answer = { kind: 'refused' }
    await view.testKey(view.shown.value)
    await nextTick()
    expect(inUse()).toBe('openai')
    expect(view.fieldOpen.value).toBe(true)
  })

  it('stays where it is through Remove and its Undo', async () => {
    const { view, announced, inUse, anonymiseOff } = await card({ stored: { ...OPENAI_IN_USE, 'kuna.secret.anthropic': ANTHROPIC_KEY } })
    expect(inUse()).toBe('anthropic')
    view.remove('anthropic')
    await nextTick()
    expect(inUse()).toBe('anthropic')
    expect(view.row.value.kept).toBe(false)
    announced[0]!.undo()
    await nextTick()
    expect(inUse()).toBe('anthropic')
    expect(localStorage.getItem('kuna.secret.anthropic')).toBe(ANTHROPIC_KEY)
    expect(anonymiseOff()).toBe(true)
  })

  it('stays where it is when a sync brings a key that sorts first, and the card keeps showing it', async () => {
    const { view, inUse, anonymiseOff, keepSyncedSecrets } = await card({ stored: OPENAI_IN_USE })
    keepSyncedSecrets({ anthropic: { key: ANTHROPIC_KEY, changedAt: SAVED_AT } })
    await nextTick()
    expect(inUse()).toBe('openai')
    expect(anonymiseOff()).toBe(true)
    expect(view.shownId.value).toBe('openai')
  })

  it('stays where it is when a sync takes its key, and does not fall to the other saved key', async () => {
    const { inUse, anonymiseOff, keepSyncedSecrets } = await card({ stored: { ...OPENAI_IN_USE, 'kuna.secret.anthropic': ANTHROPIC_KEY } })
    expect(inUse()).toBe('anthropic')
    keepSyncedSecrets({ anthropic: { key: null, changedAt: SAVED_AT } })
    await nextTick()
    expect(inUse()).toBe('anthropic')
    expect(anonymiseOff()).toBe(true)
  })

  it('holds the first company a sync brings when a later sync brings another', async () => {
    const { inUse, keepSyncedSecrets } = await card()
    keepSyncedSecrets({ openai: { key: OPENAI_KEY, changedAt: SAVED_AT } })
    keepSyncedSecrets({ anthropic: { key: ANTHROPIC_KEY, changedAt: SAVED_AT } })
    expect(inUse()).toBe('openai')
  })
})

describe('a key the company refuses', () => {
  it('is not kept, so it cannot take over from the key in use', async () => {
    const { view, inUse, anonymiseOff } = await card({ stored: OPENAI_IN_USE })
    view.pick('anthropic')
    await nextTick()
    test.answer = { kind: 'refused' }
    await saveTyped(view, TYPO)

    expect(localStorage.getItem('kuna.secret.anthropic')).toBeNull()
    expect(localStorage.getItem('kuna.secret-changed.anthropic')).toBeNull()
    expect(inUse()).toBe('openai')
    expect(anonymiseOff()).toBe(true)
    expect(view.testLine.value).toBe('Anthropic refused this key. Copy it again, or make a new one.')
    expect(view.keepsUsing.value).toContain('Kuna keeps using OpenAI')
    expect(view.fieldOpen.value).toBe(true)
  })

  it('does not push out a working key on Replace, and Keep this key closes the field and the line', async () => {
    const { view, announced } = await card({ stored: { 'kuna.secret.anthropic': ANTHROPIC_KEY } })
    view.replacing.value = true
    test.answer = { kind: 'refused' }
    await saveTyped(view, TYPO)

    expect(localStorage.getItem('kuna.secret.anthropic')).toBe(ANTHROPIC_KEY)
    expect(announced).toEqual([])
    expect(view.testLine.value).toContain('refused')
    view.stopReplacing()
    expect(view.fieldOpen.value).toBe(false)
    expect(view.testLine.value).toBeNull()
  })

  it('is still kept when the Test only failed, as it does offline, and the replaced key comes back on Undo', async () => {
    const { view, announced } = await card({ stored: { 'kuna.secret.anthropic': ANTHROPIC_KEY } })
    view.replacing.value = true
    test.answer = { kind: 'failed', reason: 'offline' }
    await saveTyped(view, TYPO)

    expect(localStorage.getItem('kuna.secret.anthropic')).toBe(TYPO)
    expect(announced.map((toast) => toast.title)).toEqual(['Key replaced'])
    announced[0]!.undo()
    expect(localStorage.getItem('kuna.secret.anthropic')).toBe(ANTHROPIC_KEY)
  })
})

describe('Get it from Google', () => {
  it('moves nothing and says so when it finds nothing for the company on screen', async () => {
    const { view, fetchKey, inUse, anonymiseOff } = await card({ stored: { ...OPENAI_IN_USE, 'kuna.assist-provider': 'openai', 'kuna.secret.anthropic': ANTHROPIC_KEY } })
    view.pick('openrouter')
    await nextTick()
    await fetchKey()
    await nextTick()

    expect(inUse()).toBe('openai')
    expect(anonymiseOff()).toBe(true)
    expect(view.movedHere.value).toBeNull()
    expect(view.fetchLine.value).toBe('Your Google account holds no OpenRouter key for Kuna.')
  })

  it('moves nothing when it brings a key for another company, and names it', async () => {
    const started = await card({
      stored: { 'kuna.assist-provider': 'openai' },
      brought: () => started.keepSyncedSecrets({ anthropic: { key: ANTHROPIC_KEY, changedAt: SAVED_AT } }),
    })
    await started.fetchKey()
    await nextTick()
    expect(started.inUse()).toBe('openai')
    expect(started.view.fetchLine.value).toBe('Your Google account holds a key for Anthropic. Pick it here to use it.')
  })

  it('puts a new browser on the key it brought, as there was nothing to move from', async () => {
    const started = await card({ brought: () => started.keepSyncedSecrets({ openai: { key: OPENAI_KEY, changedAt: SAVED_AT } }) })
    await started.fetchKey()
    await nextTick()
    expect(started.inUse()).toBe('openai')
    expect(started.view.shownId.value).toBe('openai')
    expect(started.view.fetchLine.value).toBeNull()
  })

  it('does not count a price key as an AI key', async () => {
    const started = await card({ brought: () => started.keepSyncedSecrets({ twelvedata: { key: 'made-up-twelve-data-key-8642', changedAt: SAVED_AT } }) })
    await started.fetchKey()
    expect(started.view.fetchLine.value).toBe('Your Google account holds no Anthropic key for Kuna.')
  })
})

describe('a test of the key', () => {
  it('counts as working only when the company took the key, and not after a typed key is refused', async () => {
    const { view } = await card()
    await saveTyped(view, ANTHROPIC_KEY)
    expect(view.testWorks.value).toBe(true)

    test.answer = { kind: 'refused' }
    view.replacing.value = true
    await saveTyped(view, TYPO)
    expect(view.testWorks.value).toBe(false)
    expect(localStorage.getItem('kuna.secret.anthropic')).toBe(ANTHROPIC_KEY)
  })

  it('does not count as working when it could not finish, though the key stays', async () => {
    test.answer = { kind: 'failed', reason: 'offline' }
    const { view } = await card()
    await saveTyped(view, ANTHROPIC_KEY)
    expect(view.testWorks.value).toBe(false)
    expect(view.row.value.kept).toBe(true)
  })
})

describe('which companies read a PDF', () => {
  it('is what each adapter says', async () => {
    const { presetOf } = await import('../src/shared/ai/domain/providerPresets')
    const { anthropicMessages } = await import('../src/shared/ai/infrastructure/anthropicMessages')
    const { openAiResponses } = await import('../src/shared/ai/infrastructure/openAiResponses')
    const { openRouterChat } = await import('../src/shared/ai/infrastructure/openRouterChat')
    const model = { id: 'made-up', name: 'Made up', price: null }

    expect(presetOf('anthropic').readsPdf).toBe(anthropicMessages(ANTHROPIC_KEY, model).readsPdf)
    expect(presetOf('openai').readsPdf).toBe(openAiResponses('https://made.up', OPENAI_KEY, model).readsPdf)
    expect(presetOf('openrouter').readsPdf).toBe(openRouterChat('https://made.up', OPENAI_KEY, model).readsPdf)
  })
})

describe('the line about the saved chat', () => {
  const A_LINE = { role: 'user', at: Date.now(), text: 'Made-up question', note: false, chips: [], strayFigure: false, failure: null, proposals: [] } as const
  const NOTHING_SPENT = { dollars: 0, unknown: false, any: false }

  async function line() {
    const { useSavedChatLine } = await import('../src/shared/ai/presentation/useSavedChatLine')
    return effectScope().run(() => useSavedChatLine())!
  }

  it('shows Clear whenever a chat is saved, with no key kept, and says once it is cleared', async () => {
    const { readSavedChat, saveChat } = await import('../src/shared/ai/application/savedChat')
    await saveChat({ lines: [A_LINE], spent: NOTHING_SPENT })
    const history = await line()
    await vi.waitFor(() => expect(history.shown.value).toBe(true))

    await history.clear()
    await vi.waitFor(async () => expect(await readSavedChat()).toBeNull())
    expect(history.shown.value).toBe(true)
    expect(history.cleared.value).toBe(true)
  })

  it('hides when no chat is saved', async () => {
    const { forgetSavedChat } = await import('../src/shared/ai/application/savedChat')
    await forgetSavedChat()
    const history = await line()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(history.shown.value).toBe(false)
  })
})
