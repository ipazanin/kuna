// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { spendingReader } from '../src/apps/spending/assistant/spendingReader'
import type { Catalogue } from '../src/shared/ai/application/catalogue'
import type { ModelPort, ModelReply, ModelTurn } from '../src/shared/ai/application/modelPort'
import { readSavedChat } from '../src/shared/ai/application/chatHistory'
import { CHAT_READING } from './fixtures/chatBook'

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
  readers: new Map([['spending', { name: 'Spending', reader: spendingReader(CHAT_READING) }]]),
  proposers: new Map(),
}
const CONTEXT = { app: 'Spending', screen: 'Entries', path: '/spending', query: {}, tag: null, today: '2026-11-07' }
const TOKENS = { input: 1, cacheRead: 0, cacheWrite: 0, output: 1 }
const FIND = { app: 'spending', kind: 'transaction', query: null, from: null, to: null, about: null, limit: null, cursor: null }

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
  return import('../src/shared/ai/presentation/chatSession')
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
      { kind: 'answer', text: 'Person 1 got [f1].', raw: [], tokens: TOKENS },
    ])
    await first.sendChatMessage('Who got the rent?', CONTEXT, async () => CATALOGUE)
    expect(first.shownOnScreen('Person 1')).toContain('Horvat')
    await settled()

    const stored = JSON.stringify(await readSavedChat())
    expect(stored).not.toMatch(/Horvat|HORVAT|Corner market|untrusted/)
    expect(stored).toContain('Person 1')
    expect(stored).toContain('645.30 EUR')

    const second = await loadSession()
    await second.restoreChat()
    const texts = second.chatLines.map((line) => line.text)
    expect(texts[0]).toContain('names show as aliases')
    expect(texts).toContain('Person 1 got 645.30 EUR.')
    expect(second.shownOnScreen('Person 1')).toBe('Person 1')
    expect(second.chatLines.at(-1)!.sent).toEqual([])
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
    expect(await readSavedChat(Date.now() + 29 * 86_400_000)).not.toBeNull()
    expect(await readSavedChat(Date.now() + 31 * 86_400_000)).toBeNull()
    expect(await readSavedChat()).toBeNull()
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
