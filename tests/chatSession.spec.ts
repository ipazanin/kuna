// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Catalogue } from '../src/shared/ai/application/catalogue'
import type { ModelPort, ModelReply, ModelRequest } from '../src/shared/ai/application/modelPort'

const port = vi.hoisted(() => ({ current: null as ModelPort | null }))
vi.mock('../src/shared/ai/infrastructure/modelAccess', () => ({ modelPort: async () => port.current, keyKept: () => true }))
vi.mock('../src/shared/secrets/presentation/pageSecrets', async () => {
  const { ref } = await import('vue')
  return { useSecretsChanged: () => ref(0) }
})

const { chatLines, chatSpent, chatStatus, clearChat, sendChatMessage, stopChatMessage } = await import('../src/shared/ai/presentation/chatSession')
const { pickProvider, pickModel } = await import('../src/shared/ai/infrastructure/assistSettings')
const { words } = await import('../src/shared/ai/presentation/words')

const CATALOGUE: Catalogue = { system: 'Be Kuna.', pages: new Map([['spending', 'The Spending page.']]), routes: new Map([['/spending', 'Spending: Overview']]) }
const knowledge = async (): Promise<Catalogue> => CATALOGUE
const TOKENS = { input: 1000, cacheRead: 0, cacheWrite: 0, output: 1000 }
const CONTEXT = { app: 'Spending', screen: 'Entries', path: '/spending/transactions', tag: null }

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
