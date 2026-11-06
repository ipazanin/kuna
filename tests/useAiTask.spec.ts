// @vitest-environment jsdom
import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AiTask } from '../src/shared/ai/domain/aiTask'
import { pickModel, pickProvider, switchAssist } from '../src/shared/ai/infrastructure/assistSettings'
import { hr } from '../src/shared/ai/presentation/words'
import { resultLine, usageLine, useAiTask } from '../src/shared/ai/presentation/useAiTask'
import { storeSecret } from '../src/shared/secrets/infrastructure/browserSecrets'
import { eventsAsStream, streamResponse } from './support/sseResponse'

const TASK: AiTask<string, string> = {
  id: 'test.say',
  app: 'test',
  effort: 'low',
  system: () => [{ kind: 'text', text: 'Say it.' }],
  input: (text) => [{ kind: 'text', text }],
  output: () => ({ type: 'object', additionalProperties: false, required: [], properties: {} }),
  tools: [],
  check: (_output, input) => ({ draft: input, problems: [] }),
}

function reply(): Response {
  return streamResponse(
    eventsAsStream([
      { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 1 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '{}' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } },
      { type: 'message_stop' },
    ]),
  )
}

/** A provider that answers each request only when told to, and rejects it once it is aborted. */
function stubProvider() {
  const calls: { readonly signal: AbortSignal; readonly answer: () => void }[] = []
  vi.stubGlobal('fetch', (_input: string, init: RequestInit) => {
    const signal = init.signal!
    return new Promise<Response>((resolve, reject) => {
      calls.push({ signal, answer: () => resolve(reply()) })
      signal.addEventListener('abort', () => reject(signal.reason as Error))
    })
  })
  return calls
}

/** Lets the steps of a run before its request, which include loading the adapter, finish. */
async function requestSent(calls: readonly unknown[], count: number): Promise<void> {
  await vi.waitFor(() => expect(calls).toHaveLength(count))
}

beforeEach(() => {
  localStorage.clear()
  storeSecret('anthropic', 'made-up-anthropic-key-0042', '2026-10-30T10:00:00.000Z')
  switchAssist('test', true)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('a run from a screen', () => {
  it('shows the answer of a run left alone', async () => {
    const calls = stubProvider()
    const task = useAiTask(TASK)
    const running = task.run('first')
    expect(task.state.value.kind).toBe('running')
    await requestSent(calls, 1)
    calls[0]!.answer()
    await running
    expect(task.state.value).toMatchObject({ kind: 'done', result: { kind: 'draft', draft: 'first' } })
  })

  it('aborts on a reset and drops the late result, so it cannot show under another figure', async () => {
    const calls = stubProvider()
    const task = useAiTask(TASK)
    const running = task.run('first')
    await requestSent(calls, 1)
    task.reset()
    expect(calls[0]!.signal.aborted).toBe(true)
    expect(task.state.value).toEqual({ kind: 'idle' })
    await running
    expect(task.state.value).toEqual({ kind: 'idle' })
  })

  it('aborts the run under way on a new run, and only the new one shows', async () => {
    const calls = stubProvider()
    const task = useAiTask(TASK)
    const first = task.run('first')
    await requestSent(calls, 1)
    const second = task.run('second')
    expect(calls[0]!.signal.aborted).toBe(true)
    await first
    expect(task.state.value.kind).toBe('running')
    await requestSent(calls, 2)
    calls[1]!.answer()
    await second
    expect(task.state.value).toMatchObject({ kind: 'done', result: { draft: 'second' } })
  })

  it('aborts when its screen goes', async () => {
    const calls = stubProvider()
    const scope = effectScope()
    const task = scope.run(() => useAiTask(TASK))!
    const running = task.run('first')
    await requestSent(calls, 1)
    scope.stop()
    expect(calls[0]!.signal.aborted).toBe(true)
    await running
  })

  it('ends as failed with a plain line when the provider never answers', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const calls = stubProvider()
    const task = useAiTask(TASK)
    const running = task.run('first')
    await requestSent(calls, 1)
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    await running
    expect(task.state.value).toMatchObject({ kind: 'done', result: { kind: 'failed', reason: 'The provider did not answer within five minutes.', usage: null } })
  })

  it('ends as failed on whatever else goes wrong, such as an adapter that fails to load or a task that throws', async () => {
    stubProvider()
    const task = useAiTask({
      ...TASK,
      input() {
        throw new TypeError('Failed to fetch dynamically imported module')
      },
    })
    expect(await task.run('first')).toEqual({ kind: 'failed', reason: 'Failed to fetch dynamically imported module', usage: null })
    expect(task.state.value).toMatchObject({ kind: 'done', result: { kind: 'failed' } })
  })
})

describe('the lines of a result', () => {
  const USAGE = { model: 'Opus 5.5', inputTokens: 1000, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 16000, dollars: 0.32 }

  it('gives what a run spent with or without a draft, and nothing for a run that spent nothing', () => {
    expect(usageLine({ kind: 'cut-off', reason: '', usage: USAGE })).toContain('Opus 5.5')
    expect(usageLine({ kind: 'draft', draft: 'x', problems: [], usage: USAGE })).toContain('Opus 5.5')
    expect(usageLine({ kind: 'failed', reason: 'x', usage: null })).toBeNull()
    expect(usageLine({ kind: 'no-key' })).toBeNull()
  })

  it('words a refusal with no explanation as a whole sentence', () => {
    expect(resultLine({ kind: 'refused', reason: '', usage: USAGE })).toBe('The model declined this request.')
    expect(resultLine({ kind: 'refused', reason: 'Not this.', usage: USAGE })).toBe('The model declined this request: Not this.')
  })

  it('shows cache tokens apart only when a run used them', () => {
    expect(usageLine({ kind: 'cut-off', reason: '', usage: USAGE })).toBe('Opus 5.5, 1,000 in, 16,000 out, about $0.32')
    expect(usageLine({ kind: 'cut-off', reason: '', usage: { ...USAGE, cacheReadTokens: 3400, cacheWriteTokens: 600 } })).toBe(
      'Opus 5.5, 1,000 in, 3,400 from cache, 600 to cache, 16,000 out, about $0.32',
    )
  })

  it('says under a cent instead of rounding a small cost up', () => {
    expect(usageLine({ kind: 'cut-off', reason: '', usage: { ...USAGE, dollars: 0.001 } })).toBe('Opus 5.5, 1,000 in, 16,000 out, under $0.01')
  })

  it('says price unknown for a model with no known price', () => {
    expect(usageLine({ kind: 'cut-off', reason: '', usage: { ...USAGE, dollars: null } })).toBe('Opus 5.5, 1,000 in, 16,000 out, price unknown')
    expect(hr.usage.priceUnknown).toBe('cijena nepoznata')
  })

  it('words a task that reached its limit', () => {
    expect(resultLine({ kind: 'over-budget', reason: '', usage: USAGE })).toBe('This task reached the most one task may spend, so Kuna stopped before another request.')
  })

  it('words a request the guard stopped without saying what it found', () => {
    expect(resultLine({ kind: 'holds-secret', reason: '', usage: null })).toBe('This request holds a key or a token, so Kuna did not send it.')
  })
})

describe('a run through the door to the keys', () => {
  it('stops a request that holds another stored secret before anything leaves, and sends the same request once the secret is gone', async () => {
    const SECRET = 'made-up-price-vendor-key-1234'
    storeSecret('twelvedata', SECRET, '2026-10-30T10:00:00.000Z')
    const sent: string[] = []
    vi.stubGlobal('fetch', async (_input: string, init: RequestInit) => {
      sent.push(String(init.body))
      return reply()
    })
    const scope = effectScope()
    const run = scope.run(() => useAiTask(TASK))!

    expect(await run.run(`Note: ${SECRET}`)).toMatchObject({ kind: 'holds-secret', usage: null })
    expect(sent).toEqual([])

    storeSecret('twelvedata', null, '2026-10-30T11:00:00.000Z')
    expect(await run.run(`Note: ${SECRET}`)).toMatchObject({ kind: 'draft' })
    expect(sent).toHaveLength(1)
    scope.stop()
  })

  it('sends once on a yes with the app switched off, then is off again, also for employee data', async () => {
    const { allowOnce } = await import('../src/shared/ai/presentation/useAiTask')
    switchAssist('test', false)
    pickProvider('anthropic')
    storeSecret('anthropic', 'made-up-anthropic-key-0042', '2026-10-30T10:00:00.000Z')
    const sent: unknown[] = []
    vi.stubGlobal('fetch', async (_input: string, init: RequestInit) => {
      sent.push(init.body)
      return reply()
    })
    const scope = effectScope()
    const run = scope.run(() => useAiTask(TASK))!

    expect(await run.run('Before a yes.')).toMatchObject({ kind: 'switched-off', which: 'app' })
    expect(sent).toHaveLength(0)
    allowOnce(TASK.id)
    expect(await run.run('Once.', true)).toMatchObject({ kind: 'draft' })
    expect(sent).toHaveLength(1)
    expect(localStorage.getItem('kuna.assist.test')).toBeNull()
    expect(await run.run('Again.')).toMatchObject({ kind: 'switched-off', which: 'app' })
    expect(sent).toHaveLength(1)
    scope.stop()
  })

  it('takes back a yes no run used', async () => {
    const { allowOnce, forgetOnce } = await import('../src/shared/ai/presentation/useAiTask')
    switchAssist('test', false)
    pickProvider('anthropic')
    storeSecret('anthropic', 'made-up-anthropic-key-0042', '2026-10-30T10:00:00.000Z')
    vi.stubGlobal('fetch', async () => reply())
    const scope = effectScope()
    const run = scope.run(() => useAiTask(TASK))!
    allowOnce(TASK.id)
    forgetOnce(TASK.id)
    expect(await run.run('After a tap that sent nothing.')).toMatchObject({ kind: 'switched-off', which: 'app' })
    scope.stop()
  })

  it("runs a typed model with no price, and shows the provider's words when it refuses one", async () => {
    pickProvider('anthropic')
    pickModel('anthropic', '  claude-made-up-model ')
    const models: unknown[] = []
    vi.stubGlobal('fetch', async (_input: string, init: RequestInit) => {
      models.push((JSON.parse(String(init.body)) as { model: unknown }).model)
      return models.length === 1 ? reply() : Response.json({ type: 'error', error: { type: 'not_found_error', message: 'model: claude-made-up-model' } }, { status: 404 })
    })
    const scope = effectScope()
    const run = scope.run(() => useAiTask(TASK))!

    const worked = await run.run('Say it.')
    expect(models).toEqual(['claude-made-up-model'])
    expect(usageLine(worked)).toContain('price unknown')

    expect(resultLine(await run.run('Say it again.'))).toBe('The assistant could not answer: model: claude-made-up-model')
    scope.stop()
  })
})
