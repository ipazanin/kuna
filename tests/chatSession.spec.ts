// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Catalogue } from '../src/shared/ai/application/catalogue'
import type { ModelPort, ModelReply, ModelRequest } from '../src/shared/ai/application/modelPort'
import { spendingReader } from '../src/apps/spending/assistant/spendingReader'
import { CHAT_READING, IBAN_OF_ANA } from './fixtures/chatBook'

const port = vi.hoisted(() => ({ current: null as ModelPort | null }))
vi.mock('../src/shared/ai/application/modelAccess', () => ({ modelPort: async () => port.current, keyKept: () => true }))
vi.mock('../src/shared/secrets/presentation/pageSecrets', async () => {
  const { ref } = await import('vue')
  return { useSecretsChanged: () => ref(0) }
})

const { allowThisChat, allowedThisChat, answerReadAsk, chatAsking, chatFigure, chatLines, chatSpent, chatStatus, clearChat, sendChatMessage, shownOnScreen, stopChatMessage } =
  await import('../src/shared/ai/presentation/chatSession')
const { assistOn, pickProvider, pickModel, switchAnonymise, switchAssist } = await import('../src/shared/ai/application/assistSettings')
const { words } = await import('../src/shared/ai/presentation/words')

const CATALOGUE: Catalogue = {
  system: 'Be Kuna.',
  pages: new Map([['spending', 'The Spending page.']]),
  routes: new Map([['/spending', 'Spending: Overview']]),
  places: new Map([['/spending/transactions?tab=review', 'To review']]),
  readers: new Map([['spending', { name: 'Spending', reader: spendingReader(CHAT_READING) }]]),
  proposers: new Map(),
}
const knowledge = async (): Promise<Catalogue> => CATALOGUE
const TOKENS = { input: 1000, cacheRead: 0, cacheWrite: 0, output: 1000 }
const CONTEXT = { app: 'Spending', screen: 'Entries', path: '/spending/transactions', query: {}, tag: null, today: '2026-11-07' }
const READ_ROWS = { app: 'spending', kind: 'transaction', query: null, from: null, to: null, about: null, limit: null, cursor: null }
const lookup = (name: string, args: unknown, id = 'call'): ModelReply => ({ kind: 'tool-calls', calls: [{ id, name, args }], raw: [], tokens: TOKENS })

function scripted(
  replies: readonly (ModelReply | ((request: ModelRequest) => Promise<ModelReply>))[],
  price = { inputPerMillion: 2, cacheReadPerMillion: 0.1, cacheWritePerMillion: 2.5, outputPerMillion: 10 } as ModelPort['model']['price'],
): ModelPort & { readonly requests: ModelRequest[] } {
  const requests: ModelRequest[] = []
  let at = 0
  return {
    requests,
    model: { name: 'Fake', price },
    readsPdf: false,
    async send(request) {
      requests.push(request)
      const reply = replies[at]!
      at += 1
      return typeof reply === 'function' ? reply(request) : reply
    },
  }
}

const answer = (text: string): ModelReply => ({ kind: 'answer', text, raw: [{ text }], tokens: TOKENS })

beforeEach(() => {
  clearChat()
  localStorage.clear()
  switchAssist('spending', false)
  pickProvider('anthropic')
})

describe('a chat in memory', () => {
  it('keeps going from the last answer, with the context only when it changed', async () => {
    const model = scripted([answer('One'), answer('Two'), answer('Three')])
    port.current = model
    await sendChatMessage('First', CONTEXT, knowledge)
    await sendChatMessage('Second', CONTEXT, knowledge)
    await sendChatMessage('Third', { ...CONTEXT, app: 'Loans', screen: 'Overview', path: '/loans' }, knowledge)

    expect(chatLines.map((line) => line.text)).toEqual(['First', 'One', 'Second', 'Two', 'Third', 'Three'])
    const textOf = (request: ModelRequest) => {
      const last = request.turns.at(-1)!
      return last.role === 'user' ? last.parts.map((part) => (part.kind === 'text' ? part.text : '')) : []
    }
    expect(textOf(model.requests[0]!)[0]).toContain('in Spending')
    expect(textOf(model.requests[1]!)).toEqual(['Second'])
    expect(textOf(model.requests[2]!)[0]).toContain('in Loans')
    expect(model.requests[2]!.turns).toHaveLength(5)
    expect(model.requests[0]!.system[0]!.text).toBe('Be Kuna.')
  })

  it('names the tab open when the catalogue declares it, and sends no other part of the query', async () => {
    const model = scripted([answer('One')])
    port.current = model
    await sendChatMessage('First', { ...CONTEXT, query: { tab: 'review', counterparty: 'Shop on the corner' } }, knowledge)
    const first = model.requests[0]!.turns.at(-1)!
    const text = first.role === 'user' ? first.parts.map((part) => (part.kind === 'text' ? part.text : '')).join('') : ''
    expect(text).toContain('on the screen Entries, tab To review (/spending/transactions?tab=review)')
    expect(text).not.toContain('Shop on the corner')
  })

  it('shows a cost that adds up and never stops on it', async () => {
    port.current = scripted([answer('One'), answer('Two')])
    await sendChatMessage('First', CONTEXT, knowledge)
    await sendChatMessage('Second', CONTEXT, knowledge)
    // Each request is 1,000 in at $2 and 1,000 out at $10 a million, so two are 2.4 cents.
    expect(chatSpent.value).toBe(words.usage.about('$0.02'))
  })

  it('says price unknown for a model Kuna has no price for', async () => {
    port.current = scripted([answer('One')], null)
    await sendChatMessage('First', CONTEXT, knowledge)
    expect(chatSpent.value).toBe(words.usage.priceUnknown)
  })

  it('leaves the turns as they were after a failure, and offers the same message again', async () => {
    const model = scripted([answer('One'), { kind: 'refused', reason: 'No.', tokens: TOKENS }, answer('Three')])
    port.current = model
    await sendChatMessage('First', CONTEXT, knowledge)
    await sendChatMessage('Second', CONTEXT, knowledge)
    expect(chatLines.at(-1)!.failure).toBe(words.result.refused('No.'))
    expect(chatLines.at(-1)!.retry).toBe('Second')
    await sendChatMessage('Second', CONTEXT, knowledge)
    expect(model.requests[2]!.turns).toHaveLength(3)
    expect(chatStatus.value).toBe('ready')
  })

  it("starts a new chain, and says so, when the model changes, as one model cannot read another's turns", async () => {
    const model = scripted([answer('One'), answer('Two')])
    port.current = model
    await sendChatMessage('First', CONTEXT, knowledge)
    pickModel('anthropic', 'claude-opus-5-5')
    await sendChatMessage('Second', CONTEXT, knowledge)
    expect(model.requests[1]!.turns).toHaveLength(1)
    expect(chatLines.some((line) => line.note && line.text === words.chat.chainChanged)).toBe(true)
  })

  it('reads a tool and links what it shows under the answer, dropping what the model wrote before the lookup', async () => {
    const model = scripted([
      async (request) => {
        request.onDelta?.('Let me look.')
        return { kind: 'tool-calls', calls: [{ id: 'one', name: 'kuna_docs', args: { path: 'spending' } }], raw: [], tokens: TOKENS }
      },
      { kind: 'tool-calls', calls: [{ id: 'two', name: 'show_screen', args: { route: '/spending' } }], raw: [], tokens: TOKENS },
      async (request) => {
        request.onDelta?.('Here it is.')
        return answer('Here it is.')
      },
    ])
    port.current = model
    await sendChatMessage('Where?', CONTEXT, knowledge)
    expect(chatLines.at(-1)!.text).toBe('Here it is.')
    expect(chatLines.at(-1)!.chips).toEqual([{ kind: 'screen', to: '/spending', label: 'Spending: Overview' }])
  })

  it('drops an empty answer once the person stops it, with nothing to retry', async () => {
    port.current = scripted([
      (request) =>
        new Promise((_, refuse) => {
          request.signal?.addEventListener('abort', () => refuse(new Error('aborted')))
        }),
    ])
    const sending = sendChatMessage('First', CONTEXT, knowledge)
    await vi.waitFor(() => expect(chatStatus.value).toBe('streaming'))
    await new Promise((resolve) => setTimeout(resolve))
    stopChatMessage()
    await sending
    expect(chatLines.map((line) => line.text)).toEqual(['First'])
    expect(chatStatus.value).toBe('ready')
  })

  it('keeps a yes for this chat until a new chat, on the provider it was given for, and stores nothing', () => {
    const storedBefore = localStorage.length
    expect(allowedThisChat('anthropic')).toBe(false)
    allowThisChat('anthropic')
    expect(allowedThisChat('anthropic')).toBe(true)
    expect(allowedThisChat('openai')).toBe(false)
    expect(localStorage.length).toBe(storedBefore)
    clearChat()
    expect(allowedThisChat('anthropic')).toBe(false)
  })

  describe('reading', () => {
    /** The text of the tool result that went in the given request. */
    const resultIn = (request: ModelRequest): string => {
      const last = request.turns.at(-1)!
      return last.role === 'tool-results' ? last.results[0]!.text : ''
    }

    it('asks before the first read, reads once allowed, and shows the exact text that went, aliases and all', async () => {
      const model = scripted([lookup('find_records', READ_ROWS), answer('Person 1 got 600,00 €.')])
      port.current = model
      const sending = sendChatMessage('Who got the rent?', CONTEXT, knowledge)
      await vi.waitFor(() => expect(chatAsking.value).toEqual({ app: 'spending', name: 'Spending' }))
      expect(model.requests).toHaveLength(1)
      answerReadAsk('chat')
      await sending
      const line = chatLines.at(-1)!
      expect(line.sent).toHaveLength(1)
      expect(line.sent[0]!.text).toBe(resultIn(model.requests[1]!))
      expect(line.sent[0]!.text).toContain('Person 1')
      expect(line.sent[0]!.text).not.toContain('Horvat')
      expect(line.sent[0]!.read).toMatchObject({ kind: 'records', app: 'Spending', count: 3 })
      expect(line.text).toBe('Person 1 got 600,00 €.')
      expect(shownOnScreen(line.text)).toContain('Ana Horvat')
      expect(line.strayFigure).toBe(false)
    })

    it('keeps a yes for the chat and asks no more, and stores nothing', async () => {
      port.current = scripted([lookup('find_records', READ_ROWS), answer('One'), lookup('find_records', READ_ROWS), answer('Two')])
      const storedBefore = localStorage.length
      const sending = sendChatMessage('First', CONTEXT, knowledge)
      await vi.waitFor(() => expect(chatAsking.value).not.toBeNull())
      answerReadAsk('chat')
      await sending
      await sendChatMessage('Second', CONTEXT, knowledge)
      expect(chatAsking.value).toBeNull()
      expect(chatLines.at(-1)!.text).toBe('Two')
      expect(assistOn('spending')).toBe(false)
      expect(localStorage.length).toBe(storedBefore)
    })

    it('does not ask when a yes came with the first send, or the switch is on', async () => {
      port.current = scripted([lookup('find_records', READ_ROWS), answer('One')])
      allowThisChat('anthropic', 'spending')
      await sendChatMessage('First', CONTEXT, knowledge)
      expect(chatLines.at(-1)!.sent).toHaveLength(1)
      clearChat()
      switchAssist('spending', true)
      port.current = scripted([lookup('find_records', READ_ROWS), answer('Two')])
      await sendChatMessage('Second', CONTEXT, knowledge)
      expect(chatLines.at(-1)!.sent).toHaveLength(1)
    })

    it('holds the yes to the company it named, so another company asks again', async () => {
      allowThisChat('anthropic', 'spending')
      pickProvider('openai')
      port.current = scripted([lookup('find_records', READ_ROWS), answer('One')])
      const sending = sendChatMessage('First', CONTEXT, knowledge)
      await vi.waitFor(() => expect(chatAsking.value).not.toBeNull())
      answerReadAsk('no')
      await sending
    })

    it('writes the switch on Always', async () => {
      port.current = scripted([lookup('find_records', READ_ROWS), answer('One')])
      const sending = sendChatMessage('First', CONTEXT, knowledge)
      await vi.waitFor(() => expect(chatAsking.value).not.toBeNull())
      answerReadAsk('always')
      await sending
      expect(assistOn('spending')).toBe(true)
    })

    it('on a no sends nothing from the books, tells the model, and does not ask again within the message', async () => {
      const model = scripted([lookup('find_records', READ_ROWS), lookup('read_figures', { app: 'spending', report: 'month', period: null }), answer('Could not read.')])
      port.current = model
      const sending = sendChatMessage('First', CONTEXT, knowledge)
      await vi.waitFor(() => expect(chatAsking.value).not.toBeNull())
      answerReadAsk('no')
      await sending
      expect(chatLines.at(-1)!.sent).toEqual([])
      expect(chatLines.at(-1)!.text).toBe('Could not read.')
      for (const request of model.requests) expect(JSON.stringify(request)).not.toContain('Corner market')
      expect(resultIn(model.requests[1]!)).toContain('did not allow')
    })

    it('ends the ask when the person stops the message, and reads nothing', async () => {
      const model = scripted([lookup('find_records', READ_ROWS), answer('Never')])
      port.current = model
      const sending = sendChatMessage('First', CONTEXT, knowledge)
      await vi.waitFor(() => expect(chatAsking.value).not.toBeNull())
      stopChatMessage()
      await sending
      expect(chatAsking.value).toBeNull()
      expect(model.requests).toHaveLength(1)
      expect(chatLines.map((line) => line.text)).toEqual(['First'])
    })

    it('shows the figure of a ref, and flags an amount no tool gave', async () => {
      allowThisChat('anthropic', 'spending')
      port.current = scripted([lookup('read_figures', { app: 'spending', report: 'month', period: '2026-10' }), answer('You spent [f1], and €4,300.00 last year.')])
      await sendChatMessage('First', CONTEXT, knowledge)
      expect(chatLines.at(-1)!.strayFigure).toBe(true)
      expect(chatFigure('f1')).toMatchObject({ cents: 64530, currency: 'EUR' })
      expect(chatFigure('f9')).toBeNull()
    })

    it('sends real names with the setting off, while the loop still cuts an IBAN', async () => {
      switchAnonymise(false)
      allowThisChat('anthropic', 'spending')
      const model = scripted([lookup('find_records', READ_ROWS), answer('One')])
      port.current = model
      await sendChatMessage('First', CONTEXT, knowledge)
      const sent = chatLines.at(-1)!.sent[0]!.text
      expect(sent).toContain('Ana Horvat')
      expect(sent).not.toContain(IBAN_OF_ANA)
      expect(sent).toBe(resultIn(model.requests[1]!))
      switchAnonymise(true)
    })

    it('forgets the aliases and the refs on a new chat', async () => {
      allowThisChat('anthropic', 'spending')
      port.current = scripted([lookup('find_records', READ_ROWS), answer('Person 1')])
      await sendChatMessage('First', CONTEXT, knowledge)
      expect(shownOnScreen('Person 1')).not.toBe('Person 1')
      clearChat()
      expect(shownOnScreen('Person 1')).toBe('Person 1')
    })

    it('says the row went only once the request left: a guarded request sent nothing', async () => {
      allowThisChat('anthropic', 'spending')
      const { guardedModel } = await import('../src/shared/ai/application/egressGuard')
      const inner = scripted([lookup('find_records', READ_ROWS), answer('Never')])
      port.current = guardedModel(inner, () => ['Corner market'])
      await sendChatMessage('First', CONTEXT, knowledge)
      expect(chatLines.at(-1)!.sent).toEqual([])
      expect(chatLines.at(-1)!.failure).toBe(words.result.holdsSecret)
      expect(inner.requests).toHaveLength(1)
    })
  })

  it('forgets everything on a new chat', async () => {
    const model = scripted([answer('One'), answer('Two')])
    port.current = model
    await sendChatMessage('First', CONTEXT, knowledge)
    clearChat()
    expect(chatLines).toEqual([])
    expect(chatSpent.value).toBeNull()
    await sendChatMessage('Again', CONTEXT, knowledge)
    expect(model.requests[1]!.turns).toHaveLength(1)
  })
})
