// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { spendingReader } from '../src/apps/spending/assistant/spendingReader'
import type { Catalogue } from '../src/shared/ai/application/catalogue'
import type { ModelPort, ModelReply, ModelTurn } from '../src/shared/ai/application/modelPort'
import { forgetSavedChat, readSavedChat, saveChat } from '../src/shared/ai/application/savedChat'
import type { SavedLine } from '../src/shared/ai/application/savedChat'
import { KUNA_CHAT } from '../src/shell/assistant/kunaChat'
import { CHAT_PERSONS, CHAT_READING } from './fixtures/chatBook'

const port = vi.hoisted(() => ({ current: null as ModelPort | null }))
vi.mock('../src/shared/ai/application/modelAccess', () => ({ modelPort: async () => port.current, keyKept: () => true }))
vi.mock('../src/shared/secrets/presentation/pageSecrets', async () => {
  const { ref } = await import('vue')
  return { useSecretsChanged: () => ref(0) }
})

const CATALOGUE: Catalogue = {
  system: 'Be Kuna.',
  pages: new Map(),
  routes: new Map(),
  places: new Map(),
  placeParams: new Map(),
  readers: new Map([['spending', { name: 'Spending', reader: spendingReader(CHAT_READING) }]]),
  proposers: new Map(),
  persons: () => CHAT_PERSONS,
  formatOf: async () => 'none',
}
const CONTEXT = { app: 'Spending', screen: 'Entries', path: '/spending', query: {}, element: null, today: '2026-11-07' }
const TOKENS = { input: 1, cacheRead: 0, cacheWrite: 0, output: 1 }
const DAY = 86_400_000
const NOTHING_SPENT = { dollars: 0, unknown: false, any: false }
const FIND = { app: 'spending', kind: 'transaction', query: null, from: null, to: null, about: null, only: null, limit: null, cursor: null }

function scripted(replies: readonly ModelReply[]): ModelPort & { readonly turns: (readonly ModelTurn[])[] } {
  let at = 0
  const turns: (readonly ModelTurn[])[] = []
  return {
    turns,
    model: { name: 'Fake', price: null },
    readsPdf: false,
    async send(request) {
      turns.push(request.turns)
      at += 1
      return replies[at - 1]!
    },
  }
}

const loadSession = async () => {
  vi.resetModules()
  const session = await import('../src/shared/ai/presentation/chatSession')
  void session.loadCatalogue([], KUNA_CHAT)
  return session
}

async function settled(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20))
}

beforeEach(async () => {
  localStorage.clear()
  const session = await loadSession()
  session.clearChat()
  await settled()
})

describe('a chat kept in this browser', () => {
  it('comes back after a reload with aliases, written-out figures, no tool result and a line that says so', async () => {
    const first = await loadSession()
    first.allowThisChat('anthropic', 'spending')
    const { pickProvider } = await import('../src/shared/ai/application/assistSettings')
    pickProvider('anthropic')
    first.allowThisChat('anthropic', 'spending')
    port.current = scripted([
      { kind: 'tool-calls', calls: [{ id: 'a', name: 'find_records', args: FIND }], raw: [], tokens: TOKENS },
      { kind: 'tool-calls', calls: [{ id: 'b', name: 'read_figures', args: { app: 'spending', report: 'month', period: '2026-10' } }], raw: [], tokens: TOKENS },
      { kind: 'answer', text: 'Person 1 got [f1]. The month spent [f4].', raw: [], tokens: TOKENS },
    ])
    await first.sendChatMessage('Who got the rent?', CONTEXT, async () => CATALOGUE)
    expect(first.shownOnScreen('Person 1')).toContain('Horvat')
    await settled()

    const stored = JSON.stringify(await readSavedChat())
    expect(stored).not.toMatch(/Horvat|HORVAT|Corner market|untrusted/)
    expect(stored).toContain('Person 1')
    expect(stored).toContain('-45.30 EUR')
    expect(stored).toContain('645.30 EUR')
    expect(stored).not.toMatch(/\[f\d+\]/)

    const second = await loadSession()
    await second.restoreChat()
    const texts = second.chatLines.map((line) => line.text)
    expect(texts[0]).toContain('names show as aliases')
    expect(texts).toContain('Person 1 got -45.30 EUR. The month spent 645.30 EUR.')
    expect(second.shownOnScreen('Person 1')).toBe('Person 1')
    expect(second.chatLines.at(-1)!.sent).toEqual([])
  })

  it('keeps only the names of the files a message went with, never the files', async () => {
    const first = await loadSession()
    const { pickProvider } = await import('../src/shared/ai/application/assistSettings')
    pickProvider('anthropic')
    first.allowThisChat('anthropic')
    const bytes = new TextEncoder().encode('date,amount\n2026-10-01,-12.00')
    const sheet = new File([bytes], 'October.csv', { type: 'text/csv' })
    Object.defineProperty(sheet, 'arrayBuffer', { value: async () => bytes.slice().buffer })
    await first.attachFiles([sheet])
    port.current = scripted([{ kind: 'answer', text: 'Read.', raw: [], tokens: TOKENS }])
    await first.sendChatMessage('Import it', CONTEXT, async () => CATALOGUE)
    await settled()

    const stored = JSON.stringify(await readSavedChat())
    expect(stored).toContain('"attachments":["October.csv"]')
    expect(stored).not.toContain('2026-10-01')

    const second = await loadSession()
    await second.restoreChat()
    expect(second.chatLines.find((line) => line.role === 'user')?.attachments).toEqual(['October.csv'])
  })

  it('is written by the time chatKept resolves, so a reload right after keeps it', async () => {
    const session = await loadSession()
    const { storedChat } = await import('../src/shared/ai/infrastructure/chatHistory')
    port.current = scripted([{ kind: 'answer', text: 'Kept', raw: [], tokens: TOKENS }])
    await session.sendChatMessage('Keep this', CONTEXT, async () => CATALOGUE)

    await session.chatKept()

    expect(JSON.stringify(await storedChat())).toContain('Keep this')
  })

  it('starts the model fresh after a reload', async () => {
    const first = await loadSession()
    port.current = scripted([{ kind: 'answer', text: 'One', raw: [], tokens: TOKENS }])
    await first.sendChatMessage('First', CONTEXT, async () => CATALOGUE)
    await settled()
    const second = await loadSession()
    await second.restoreChat()
    const model = scripted([{ kind: 'answer', text: 'Two', raw: [], tokens: TOKENS }])
    port.current = model
    await second.sendChatMessage('Second', CONTEXT, async () => CATALOGUE)
    expect(model.turns[0]).toHaveLength(1)
  })

  it('goes after 30 days', async () => {
    const first = await loadSession()
    port.current = scripted([{ kind: 'answer', text: 'One', raw: [], tokens: TOKENS }])
    await first.sendChatMessage('First', CONTEXT, async () => CATALOGUE)
    await settled()
    expect(await readSavedChat(Date.now() + 29 * DAY)).not.toBeNull()
    expect(await readSavedChat(Date.now() + 31 * DAY)).toBeNull()
    expect(await readSavedChat()).toBeNull()
  })

  it('lets each line go 30 days after it was written, on save and on read', async () => {
    const now = Date.parse('2026-11-07T09:00:00.000Z')
    const line = (text: string, daysAgo: number): SavedLine => ({ role: 'user', at: now - daysAgo * DAY, text, note: false, chips: [], strayFigure: false, failure: null, proposals: [] })

    await saveChat({ lines: [line('Old', 31), line('New', 1)], spent: NOTHING_SPENT }, now)
    expect((await readSavedChat(now))!.lines.map((kept) => kept.text)).toEqual(['New'])
    expect((await readSavedChat(now + 10 * DAY))!.lines.map((kept) => kept.text)).toEqual(['New'])

    expect(await readSavedChat(now + 30 * DAY)).toBeNull()
    expect(await readSavedChat(now)).toBeNull()

    await saveChat({ lines: [line('New', 1)], spent: NOTHING_SPENT }, now)
    await saveChat({ lines: [line('Old', 31)], spent: NOTHING_SPENT }, now)
    expect(await readSavedChat(now)).toBeNull()
  })

  it('keeps a Clear made while a save is still on its way, so a cleared chat never comes back', async () => {
    const now = Date.now()
    const line: SavedLine = { role: 'user', at: now, text: 'Kept too late', note: false, chips: [], strayFigure: false, failure: null, proposals: [] }
    const saving = saveChat({ lines: [line], spent: NOTHING_SPENT }, now)
    const clearing = forgetSavedChat()
    expect(await readSavedChat(now)).toBeNull()
    await Promise.all([saving, clearing])
    expect(await readSavedChat(now)).toBeNull()
  })

  it('says once per restore that the chat came back, and never keeps that line', async () => {
    const first = await loadSession()
    port.current = scripted([{ kind: 'answer', text: 'One', raw: [], tokens: TOKENS }])
    await first.sendChatMessage('First', CONTEXT, async () => CATALOGUE)
    await settled()

    const second = await loadSession()
    await second.restoreChat()
    port.current = scripted([{ kind: 'answer', text: 'Two', raw: [], tokens: TOKENS }])
    await second.sendChatMessage('Second', CONTEXT, async () => CATALOGUE)
    await settled()
    expect((await readSavedChat())!.lines.map((kept) => kept.text)).toEqual(['First', 'One', 'Second', 'Two'])

    const third = await loadSession()
    await third.restoreChat()
    const { words } = await import('../src/shared/ai/presentation/words')
    expect(third.chatLines.filter((shown) => shown.text === words.history.restored)).toHaveLength(1)
    expect(third.chatLines.map((shown) => shown.text)).toEqual([words.history.restored, 'First', 'One', 'Second', 'Two'])
  })

  it('goes with Clear and with a new chat', async () => {
    const first = await loadSession()
    port.current = scripted([{ kind: 'answer', text: 'One', raw: [], tokens: TOKENS }])
    await first.sendChatMessage('First', CONTEXT, async () => CATALOGUE)
    await settled()
    expect(await readSavedChat()).not.toBeNull()
    first.clearChat()
    await settled()
    expect(await readSavedChat()).toBeNull()
  })
})
