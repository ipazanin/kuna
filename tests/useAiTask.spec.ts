// @vitest-environment jsdom
import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AiTask } from '../src/shared/ai/domain/aiTask'
import { switchAssist } from '../src/shared/ai/infrastructure/assistSettings'
import { resultLine, usageLine, useAiTask } from '../src/shared/ai/presentation/useAiTask'
import { storeSecret } from '../src/shared/secrets/infrastructure/browserSecrets'

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
  return Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }], usage: { input_tokens: 10, output_tokens: 5 } })
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
  const USAGE = { model: 'Opus 5.5', inputTokens: 1000, outputTokens: 16000, dollars: 0.32 }

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
})
