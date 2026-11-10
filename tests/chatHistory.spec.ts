// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { spendingReader } from '../src/apps/spending/assistant/spendingReader'
import type { Catalogue } from '../src/shared/ai/application/catalogue'
import type { AppProposer } from '../src/shared/app/assistantOperations'
import type { ModelPort, ModelReply, ModelTurn } from '../src/shared/ai/application/modelPort'
import { forgetSavedChat, readSavedChat, saveChat } from '../src/shared/ai/application/savedChat'
import type { SavedLine } from '../src/shared/ai/application/savedChat'
import { KUNA_CHAT } from '../src/shell/assistant/kunaChat'
import { CHAT_PERSONS, CHAT_READING } from './fixtures/chatBook'

const signedOut = vi.hoisted(() => ({ times: 0 }))
vi.mock('../src/shared/google/googleAuth', () => ({
  signOutOfGoogle: async () => {
    signedOut.times += 1
  },
}))
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
const CONTEXT = { app: 'Spending', screen: 'Entries', path: '/spending', query: {}, element: null, today: '2026-11-07', setUp: [] }
const TOKENS = { input: 1, cacheRead: 0, cacheWrite: 0, output: 1 }
const DAY = 86_400_000
const NOTHING_SPENT = { dollars: 0, unknown: false, any: false }
const FIND = { app: 'spending', kind: 'transaction', query: null, from: null, to: null, about: null, only: null, limit: null, cursor: null }
/** A map in which the chat's one known person is Person 2, as no fresh map would make them, so a test can tell the kept map was taken back. */
const ANA_SECOND = {
  identifiers: [],
  persons: [
    { number: 1, alias: 'Person 1', name: 'Eva Novak', spellings: ['Eva Novak'] },
    { number: 2, alias: 'Person 2', name: 'Ana Horvat', spellings: ['Ana Horvat'] },
  ],
}

function said(role: SavedLine['role'], text: string, fields: Partial<SavedLine> = {}): SavedLine {
  return { role, at: Date.now(), text, note: false, chips: [], strayFigure: false, failure: null, proposals: [], ...fields }
}

async function allowSpending(session: Awaited<ReturnType<typeof loadSession>>): Promise<void> {
  const { pickProvider } = await import('../src/shared/ai/application/assistSettings')
  pickProvider('anthropic')
  session.allowThisChat('anthropic', 'spending')
}

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
  it('comes back after a reload with its alias map, written-out figures, no tool result and no note', async () => {
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

    const saved = (await readSavedChat())!
    const stored = JSON.stringify(saved.lines)
    expect(stored).not.toMatch(/Horvat|HORVAT|Corner market|untrusted/)
    expect(stored).toContain('Person 1')
    expect(stored).toContain('-45.30 EUR')
    expect(stored).toContain('645.30 EUR')
    expect(stored).not.toMatch(/\[f\d+\]/)
    expect(saved.aliases!.persons.map(({ alias, name }) => ({ alias, name }))).toEqual([{ alias: 'Person 1', name: 'Ana Horvat' }])
    expect(JSON.stringify(saved.aliases)).not.toMatch(/Corner market|untrusted/)

    const second = await loadSession()
    await second.restoreChat()
    const texts = second.chatLines.map((line) => line.text)
    expect(texts).toEqual(['Who got the rent?', 'Person 1 got -45.30 EUR. The month spent 645.30 EUR.'])
    expect(second.chatLines.some((line) => line.note)).toBe(false)
    expect(second.shownOnScreen('Person 1')).toBe('Ana Horvat')
    expect(second.chatLines.at(-1)!.sent).toEqual([])
  })

  it('keeps the names of the files a card was made after reading, so its line comes back after a reload', async () => {
    const tidy: AppProposer = {
      operations: [{ name: 'tidy', about: 'Tidies.', input: { type: 'object', properties: {}, required: [], additionalProperties: false }, refs: {}, creates: null, alone: false, example: {} }],
      readsBooks: false,
      check: async (title) => ({ title, count: 1, groups: [], outside: [], undoable: true, heldBack: null, held: {} }),
    }
    const first = await loadSession()
    const { pickProvider } = await import('../src/shared/ai/application/assistSettings')
    pickProvider('anthropic')
    first.allowThisChat('anthropic')
    const bytes = new TextEncoder().encode('date,amount\n2026-10-01,-12.00')
    const sheet = new File([bytes], 'October.csv', { type: 'text/csv' })
    Object.defineProperty(sheet, 'arrayBuffer', { value: async () => bytes.slice().buffer })
    await first.attachFiles([sheet])
    const [attached] = first.chatPromptFiles.value as readonly { readonly attachment: { readonly id: string } }[]
    port.current = scripted([
      { kind: 'tool-calls', calls: [{ id: 'r', name: 'read_attachment', args: { attachment: attached!.attachment.id, pages: null, sheet: null, rows: '1-2' } }], raw: [], tokens: TOKENS },
      {
        kind: 'tool-calls',
        calls: [{ id: 'p', name: 'propose_changes', args: { app: 'spending', title: 'Tidy up', steps: [{ op: 'tidy', input: '{}', as: null }], next: false } }],
        raw: [],
        tokens: TOKENS,
      },
      { kind: 'answer', text: 'Card shown.', raw: [], tokens: TOKENS },
    ])
    await first.sendChatMessage('Tidy after reading it', CONTEXT, async () => ({ ...CATALOGUE, proposers: new Map([['spending', tidy]]) }))
    await settled()
    expect(first.chatLines.flatMap((line) => line.proposals).map((card) => card.readFiles)).toEqual([['October.csv']])

    const second = await loadSession()
    await second.restoreChat()
    expect(second.chatLines.flatMap((line) => line.proposals).map((card) => card.readFiles)).toEqual([['October.csv']])
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

  it('sends the earlier messages again after a reload, and a new read names each person by the alias the kept map gave them', async () => {
    await saveChat({ lines: [said('user', 'Who got the rent?'), said('assistant', 'Person 2 got -45.30 EUR.')], spent: NOTHING_SPENT, aliases: ANA_SECOND })
    const session = await loadSession()
    await session.restoreChat()
    await allowSpending(session)
    const model = scripted([
      { kind: 'tool-calls', calls: [{ id: 'a', name: 'find_records', args: FIND }], raw: [], tokens: TOKENS },
      { kind: 'answer', text: 'Person 2 again.', raw: [], tokens: TOKENS },
    ])
    port.current = model
    await session.sendChatMessage('Who was that?', CONTEXT, async () => CATALOGUE)

    const [user, answer, asked] = model.turns[0]!
    expect(user).toEqual({ role: 'user', parts: [{ kind: 'text', text: 'Who got the rent?' }] })
    expect(answer).toEqual({ role: 'earlier-answer', text: 'Person 2 got -45.30 EUR.' })
    expect(JSON.stringify(asked)).toContain('Who was that?')
    const read = JSON.stringify(model.turns[1]!.at(-1))
    expect(read).toContain('Person 2')
    expect(read).not.toMatch(/Horvat|Person 1/)
    expect(session.shownOnScreen('Person 2 again.')).toBe('Ana Horvat again.')
  })

  it('sends again only the messages the model answered since the last change of model', async () => {
    const lines = [
      said('user', 'Before the change'),
      said('assistant', 'Old answer'),
      said('assistant', 'You changed the AI company or model.', { note: true }),
      said('user', 'This one failed'),
      said('assistant', '', { failure: 'The provider could not be reached.' }),
      said('user', 'Asked after'),
      said('assistant', 'Answered after'),
    ]
    await saveChat({ lines, spent: NOTHING_SPENT, aliases: ANA_SECOND })
    const session = await loadSession()
    await session.restoreChat()
    const model = scripted([{ kind: 'answer', text: 'Now', raw: [], tokens: TOKENS }])
    port.current = model
    await session.sendChatMessage('And now?', CONTEXT, async () => CATALOGUE)

    expect(model.turns[0]!.slice(0, -1)).toEqual([
      { role: 'user', parts: [{ kind: 'text', text: 'Asked after' }] },
      { role: 'earlier-answer', text: 'Answered after' },
    ])
  })

  it('sends a chat kept before its alias map was again, with a fresh map', async () => {
    await saveChat({ lines: [said('user', 'First'), said('assistant', 'Person 1 got it.')], spent: NOTHING_SPENT })
    const session = await loadSession()
    await session.restoreChat()
    const model = scripted([{ kind: 'answer', text: 'Two', raw: [], tokens: TOKENS }])
    port.current = model
    await session.sendChatMessage('Second', CONTEXT, async () => CATALOGUE)

    expect(model.turns[0]!.slice(0, -1)).toEqual([
      { role: 'user', parts: [{ kind: 'text', text: 'First' }] },
      { role: 'earlier-answer', text: 'Person 1 got it.' },
    ])
    expect(session.shownOnScreen('Person 1')).toBe('Person 1')
  })

  it('numbers record refs on after a reload, so a ref in an earlier answer never stands for a record read since', async () => {
    const first = await loadSession()
    await allowSpending(first)
    const before = scripted([
      { kind: 'tool-calls', calls: [{ id: 'a', name: 'find_records', args: FIND }], raw: [], tokens: TOKENS },
      { kind: 'answer', text: 'Read.', raw: [], tokens: TOKENS },
    ])
    port.current = before
    await first.sendChatMessage('Find the rows', CONTEXT, async () => CATALOGUE)
    await first.chatKept()
    const second = await loadSession()
    await second.restoreChat()
    await allowSpending(second)
    const after = scripted([
      { kind: 'tool-calls', calls: [{ id: 'b', name: 'find_records', args: FIND }], raw: [], tokens: TOKENS },
      { kind: 'answer', text: 'Read again.', raw: [], tokens: TOKENS },
    ])
    port.current = after
    await second.sendChatMessage('Find them again', CONTEXT, async () => CATALOGUE)

    const refsIn = (port: typeof before) => new Set(JSON.stringify(port.turns[1]!.at(-1)).match(/transaction-\d+/g))
    const old = refsIn(before)
    const fresh = refsIn(after)
    expect(old.size).toBeGreaterThan(0)
    expect(fresh.size).toBe(old.size)
    expect([...fresh].filter((ref) => old.has(ref))).toEqual([])
  })

  it('counts the amounts of an answer from before a reload as known, unless that answer held a stray figure itself', async () => {
    const lines = [said('user', 'How much this month?'), said('assistant', 'The month spent 645.30 EUR.'), said('user', 'And the café?'), said('assistant', 'About 99.99 EUR.', { strayFigure: true })]
    await saveChat({ lines, spent: NOTHING_SPENT, aliases: ANA_SECOND })
    const session = await loadSession()
    await session.restoreChat()
    port.current = scripted([
      { kind: 'answer', text: 'Still 645.30 EUR.', raw: [], tokens: TOKENS },
      { kind: 'answer', text: 'Still 99.99 EUR.', raw: [], tokens: TOKENS },
    ])
    await session.sendChatMessage('Same as before?', CONTEXT, async () => CATALOGUE)
    await session.sendChatMessage('And the café?', CONTEXT, async () => CATALOGUE)

    expect(session.chatLines.slice(-3).map(({ text, strayFigure }) => ({ text, strayFigure }))).toEqual([
      { text: 'Still 645.30 EUR.', strayFigure: false },
      { text: 'And the café?', strayFigure: false },
      { text: 'Still 99.99 EUR.', strayFigure: true },
    ])
  })

  it('marks an answer the person stopped, and never sends it again after a reload', async () => {
    const first = await loadSession()
    const writing: ModelPort = {
      model: { name: 'Fake', price: null },
      readsPdf: false,
      send: (request) =>
        new Promise((_resolve, reject) => {
          request.onDelta?.('Half an ans')
          request.signal?.addEventListener('abort', () => reject(new Error('stopped')))
        }),
    }
    port.current = writing
    const sending = first.sendChatMessage('Tell me everything', CONTEXT, async () => CATALOGUE)
    await settled()
    first.stopChatMessage()
    await sending
    await first.chatKept()
    expect((await readSavedChat())!.lines.map(({ text, stopped }) => ({ text, stopped }))).toEqual([
      { text: 'Tell me everything', stopped: undefined },
      { text: 'Half an ans', stopped: true },
    ])

    const second = await loadSession()
    await second.restoreChat()
    const model = scripted([{ kind: 'answer', text: 'Here.', raw: [], tokens: TOKENS }])
    port.current = model
    await second.sendChatMessage('Again, shorter', CONTEXT, async () => CATALOGUE)

    expect(second.chatLines[1]!.stopped).toBe(true)
    expect(model.turns[0]).toHaveLength(1)
  })

  it('marks a message Kuna sent for the person, from a button or as Go on, and keeps the mark after a reload', async () => {
    const first = await loadSession()
    port.current = scripted([
      { kind: 'answer', text: 'Sorted.', raw: [], tokens: TOKENS },
      { kind: 'answer', text: 'Typed.', raw: [], tokens: TOKENS },
    ])
    await first.sendChatMessage('Suggest categories', CONTEXT, async () => CATALOGUE, 'task')
    await first.sendChatMessage('Thanks', CONTEXT, async () => CATALOGUE)
    await first.chatKept()
    expect((await readSavedChat())!.lines.filter((line) => line.role === 'user').map(({ text, byKuna }) => ({ text, byKuna }))).toEqual([
      { text: 'Suggest categories', byKuna: true },
      { text: 'Thanks', byKuna: undefined },
    ])

    const second = await loadSession()
    await second.restoreChat()
    expect(second.chatLines.filter((line) => line.role === 'user').map((line) => line.byKuna)).toEqual([true, false])
  })

  it('tells the model with the first message after a reload that the cards and refs from before it are gone, and only then', async () => {
    const first = await loadSession()
    port.current = scripted([{ kind: 'answer', text: 'One', raw: [], tokens: TOKENS }])
    await first.sendChatMessage('Add a category for training courses', CONTEXT, async () => CATALOGUE)
    await settled()
    const second = await loadSession()
    await second.restoreChat()
    const model = scripted([
      { kind: 'answer', text: 'Two', raw: [], tokens: TOKENS },
      { kind: 'answer', text: 'Three', raw: [], tokens: TOKENS },
    ])
    port.current = model
    await second.sendChatMessage('Sorry, retry now please', CONTEXT, async () => CATALOGUE)
    await second.sendChatMessage('And now?', CONTEXT, async () => CATALOGUE)

    const sent = (at: number) => JSON.stringify(model.turns[at]![model.turns[at]!.length - 1])
    expect(sent(0)).toContain('The page reloaded. Its cards can no longer be accepted')
    expect(JSON.stringify(model.turns[0])).toContain('training courses')
    expect(sent(1)).not.toContain('The page reloaded')
  })

  it('brings back a card that was open or failed before the reload as one from before it, never as one Kuna refused', async () => {
    const now = Date.now()
    const card = (id: string, state: 'open' | 'refused') => ({ id, app: 'company', title: 'Add a category', count: 1, state })
    const line: SavedLine = { role: 'assistant', at: now, text: 'Here it is', note: false, chips: [], strayFigure: false, failure: null, proposals: [card('a', 'open'), card('b', 'refused')] }
    await saveChat({ lines: [line], spent: NOTHING_SPENT }, now)
    const session = await loadSession()
    await session.restoreChat()
    const { words } = await import('../src/shared/ai/presentation/words')
    const { readFileSync } = await import('node:fs')
    const shown = session.chatLines.flatMap((kept) => kept.proposals).map(({ state, reason, checked }) => ({ state, reason, checked }))

    expect(shown).toEqual([
      { state: 'ended', reason: null, checked: null },
      { state: 'refused', reason: null, checked: null },
    ])
    expect(readFileSync('src/shared/ai/presentation/ProposalCard.vue', 'utf8')).toContain('proposal.reason === null ? words.proposal.refusedBeforeReload : words.proposal.notWritten(proposal.reason)')
    expect([words.proposal.ended, words.proposal.refusedBeforeReload]).toEqual([
      'Not accepted before the page reloaded. Ask the chat again to make it anew.',
      'Not written before the page reloaded. Ask the chat again to try it.',
    ])
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

  it('is cleared with its alias list when the person signs out of Google', async () => {
    const session = await loadSession()
    await allowSpending(session)
    port.current = scripted([
      { kind: 'tool-calls', calls: [{ id: 'a', name: 'find_records', args: FIND }], raw: [], tokens: TOKENS },
      { kind: 'answer', text: 'Person 1 got it.', raw: [], tokens: TOKENS },
    ])
    await session.sendChatMessage('Who got the rent?', CONTEXT, async () => CATALOGUE)
    await session.chatKept()
    expect(await readSavedChat()).not.toBeNull()
    expect(session.shownOnScreen('Person 1')).toContain('Horvat')

    const { signOutAndForgetChat } = await import('../src/shell/settings/signOutOfKuna')
    await signOutAndForgetChat()

    expect(signedOut.times).toBe(1)
    expect(session.chatLines).toHaveLength(0)
    expect(session.shownOnScreen('Person 1')).toBe('Person 1')
    expect(await readSavedChat()).toBeNull()
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

  it('shows no note after a reload, however often it comes back', async () => {
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
    expect(third.chatLines.map((shown) => shown.text)).toEqual(['First', 'One', 'Second', 'Two'])
  })

  it('goes with Clear and with a new chat, its alias map with it', async () => {
    await saveChat({ lines: [said('user', 'Who got the rent?'), said('assistant', 'Person 2 got it.')], spent: NOTHING_SPENT, aliases: ANA_SECOND })
    const first = await loadSession()
    await first.restoreChat()
    port.current = scripted([{ kind: 'answer', text: 'One', raw: [], tokens: TOKENS }])
    await first.sendChatMessage('First', CONTEXT, async () => CATALOGUE)
    await first.chatKept()
    expect(first.shownOnScreen('Person 2')).toBe('Ana Horvat')
    first.clearChat()
    await settled()
    const { storedChat } = await import('../src/shared/ai/infrastructure/chatHistory')
    expect(await storedChat()).toBeNull()
    expect(first.shownOnScreen('Person 2')).toBe('Person 2')

    const second = await loadSession()
    await second.restoreChat()
    expect(second.chatLines).toEqual([])
    expect(second.shownOnScreen('Person 2')).toBe('Person 2')
  })
})
