import { describe, expect, it } from 'vitest'

import { catalogueOf } from '../src/shared/ai/application/catalogue'
import { proposeChanges } from '../src/shared/ai/application/chatProposals'
import type { ChatReads } from '../src/shared/ai/application/chatReads'
import { chatRefs } from '../src/shared/ai/domain/chatRefs'
import type { CheckedProposal } from '../src/shared/app/assistantOperations'
import type { KunaStart } from '../src/shared/app/kunaStart'
import type { LanguageChoice } from '../src/shared/text/language'
import type { ThemeChoice } from '../src/shared/theme/theme'
import { newPseudonyms } from '../src/shared/privacy/domain/pseudonyms'
import { kunaAssistant } from '../src/shell/assistant/kunaAssistant'
import { KUNA_CHAT } from '../src/shell/assistant/kunaChat'
import { kunaAcceptance, kunaOperations, kunaProposer } from '../src/shell/assistant/kunaOperations'
import type { KunaDevice } from '../src/shell/assistant/kunaOperations'
import { words } from '../src/shell/assistant/words'
import { words as settingsWords } from '../src/shell/settings/words'

/** A device as Kuna settings and the home keep it, in memory. */
function fakeDevice(start: KunaStart | null = { home: 'drive', apps: ['company'] }) {
  const held = { theme: 'system' as ThemeChoice, language: 'browser' as LanguageChoice, autoSync: true, start, reloads: 0 }
  const device: KunaDevice = {
    theme: () => held.theme,
    chooseTheme: (choice) => (held.theme = choice),
    language: () => held.language,
    chooseLanguage: (choice) => {
      held.language = choice
      held.reloads += 1
    },
    autoSync: () => held.autoSync,
    switchAutoSync: (on) => (held.autoSync = on),
    start: () => held.start,
    answerStart: (answer) => (held.start = answer),
    forgetStart: () => (held.start = null),
    apps: () => [
      { id: 'company', name: 'Company' },
      { id: 'loans', name: 'Loans' },
      { id: 'spending', name: 'Spending' },
    ],
  }
  return { held, device }
}

function propose(device: KunaDevice, steps: readonly { readonly op: string; readonly input: unknown }[]) {
  const reads: ChatReads = { readers: new Map(), pseudonyms: newPseudonyms(), refs: chatRefs(), anonymising: () => true, persons: () => [], mayRead: async () => false }
  const cards: CheckedProposal[] = []
  const answer = proposeChanges(
    { app: 'kuna', title: 'A title', steps: steps.map((step) => ({ op: step.op, input: JSON.stringify(step.input), as: null })) },
    new Map([['kuna', kunaProposer(device)]]),
    reads,
    [],
    (_app, card) => cards.push(card),
  )
  return { answer, cards }
}

describe("Kuna's own operations", () => {
  it.each(kunaOperations(fakeDevice().device).map((operation) => [operation.name, operation] as const))(
    'have an example that passes the check without asking to read any books, and sets it on Accept: %s',
    async (_name, operation) => {
      const { held, device } = fakeDevice()
      const before = JSON.stringify(held)
      const { answer, cards } = propose(device, [{ op: operation.name, input: operation.example }])

      expect((await answer).isError, (await answer).text).toBe(false)
      const done = await kunaAcceptance(device).accept(cards[0]!)

      expect(done.kind).toBe('done')
      expect(JSON.stringify(held)).not.toBe(before)
    },
  )

  it('puts back the theme, auto sync and the apps with one Undo', async () => {
    const { held, device } = fakeDevice()
    const { answer, cards } = propose(device, [
      { op: 'set-theme', input: { theme: 'dark' } },
      { op: 'switch-auto-sync', input: { auto: 'off' } },
      { op: 'add-app', input: { app: 'loans' } },
      { op: 'add-app', input: { app: 'spending' } },
    ])
    await answer

    const done = await kunaAcceptance(device).accept(cards[0]!)

    expect(held).toMatchObject({ theme: 'dark', autoSync: false, start: { home: 'drive', apps: ['company', 'loans', 'spending'] } })
    expect(cards[0]!.groups.map((group) => group.lines.map((line) => line.label))).toEqual([[words.thisDevice], ['Loans', 'Spending']])
    if (done.kind !== 'done' || done.undo === null) throw new Error('No Undo')
    expect((await done.undo()).kind).toBe('undone')
    expect(held).toMatchObject({ theme: 'system', autoSync: true, start: { home: 'drive', apps: ['company'] } })
  })

  it('ends the Undo once a setting was changed since, and refuses an Accept when it was changed before', async () => {
    const { held, device } = fakeDevice()
    const first = propose(device, [{ op: 'set-theme', input: { theme: 'dark' } }])
    await first.answer
    held.theme = 'light'

    expect(await kunaAcceptance(device).accept(first.cards[0]!)).toEqual({ kind: 'refused', reason: words.refused.changedSince })

    held.theme = 'system'
    const done = await kunaAcceptance(device).accept(first.cards[0]!)
    held.theme = 'light'
    if (done.kind !== 'done' || done.undo === null) throw new Error('No Undo')
    expect((await done.undo()).kind).toBe('refused')
    expect(held.theme).toBe('light')
  })

  it('loads Kuna again for a language, with the card saying so and no Undo', async () => {
    const { held, device } = fakeDevice()
    const { answer, cards } = propose(device, [{ op: 'set-language', input: { language: 'hr' } }])
    await answer

    const done = await kunaAcceptance(device).accept(cards[0]!)

    expect(cards[0]!.outside).toEqual([words.outside.reloads])
    expect(cards[0]!.undoable).toBe(false)
    expect(done).toEqual({ kind: 'done', undo: null })
    expect(held.reloads).toBe(1)
  })

  it('forgets where new files go, and Undo puts the answer back as it was', async () => {
    const { held, device } = fakeDevice({ home: 'browser', apps: ['company', 'loans'] })
    const { answer, cards } = propose(device, [{ op: 'forget-files-home', input: {} }])
    await answer

    const done = await kunaAcceptance(device).accept(cards[0]!)

    expect(held.start).toBeNull()
    expect(cards[0]!.groups[0]!.lines[0]!.fields).toEqual([{ name: settingsWords.filesHome.title, before: words.home.browser, after: words.home.askAgain, warns: false }])
    if (done.kind !== 'done' || done.undo === null) throw new Error('No Undo')
    expect((await done.undo()).kind).toBe('undone')
    expect(held.start).toEqual({ home: 'browser', apps: ['company', 'loans'] })
  })

  it('refuses to forget an answer this device does not keep, or one the same card adds an app to', async () => {
    const unasked = propose(fakeDevice(null).device, [{ op: 'forget-files-home', input: {} }])
    const withApp = propose(fakeDevice().device, [
      { op: 'add-app', input: { app: 'loans' } },
      { op: 'forget-files-home', input: {} },
    ])

    expect((await unasked.answer).text).toBe(words.refused.notAnswered)
    expect((await withApp.answer).text).toBe(words.refused.twice)
  })

  it('refuses what would change nothing, a setting twice, an app in use, and an app before the home asked', async () => {
    const same = propose(fakeDevice().device, [{ op: 'set-theme', input: { theme: 'system' } }])
    const twice = propose(fakeDevice().device, [
      { op: 'set-theme', input: { theme: 'dark' } },
      { op: 'set-theme', input: { theme: 'light' } },
    ])
    const inUse = propose(fakeDevice().device, [{ op: 'add-app', input: { app: 'company' } }])
    const unasked = propose(fakeDevice(null).device, [{ op: 'add-app', input: { app: 'loans' } }])

    expect((await same.answer).text).toBe(words.refused.same)
    expect((await twice.answer).text).toBe(words.refused.twice)
    expect((await inUse.answer).text).toBe(words.refused.inUse)
    expect((await unasked.answer).text).toBe(words.refused.noAnswer)
  })

  it('reaches no Anonymise, key, provider or sync, which its page names as only the person sets them on Kuna settings', async () => {
    const operations = kunaOperations(fakeDevice().device).map((operation) => operation.name)
    for (const op of ['set-anonymise', 'set-provider', 'set-key', 'sync-now', 'clear-history', 'sign-out']) {
      const { answer } = propose(fakeDevice().device, [{ op, input: {} }])
      expect((await answer).isError).toBe(true)
    }
    const catalogue = catalogueOf([], { ...KUNA_CHAT, assistant: kunaAssistant() })
    const page = catalogue.pages.get('kuna')!

    expect(operations).toEqual(['set-theme', 'set-language', 'switch-auto-sync', 'add-app', 'forget-files-home'])
    for (const key of ['ai_provider', 'anonymise', 'chat_history', 'sync_now', 'google_sign_in']) expect(page.split(`- ${key}: `)[1]!.split('\n')[0]).toContain('Only a person sets it')
    expect(page).toContain('- Kuna settings: /settings')
    expect(catalogue.proposers.has('kuna')).toBe(true)
    expect([...catalogue.pages.keys()].filter((path) => path.startsWith('kuna/op/'))).toEqual(operations.map((operation) => `kuna/op/${operation}`))
  })
})
