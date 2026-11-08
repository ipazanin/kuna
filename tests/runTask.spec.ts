import { describe, expect, it } from 'vitest'

import { MAX_REQUEST_TOKENS, MAX_RUN_TOKENS, MAX_TOOL_ROUNDS, runTask } from '../src/shared/ai/application/runTask'
import type { RunPorts } from '../src/shared/ai/application/runTask'
import { ModelRequestFailed } from '../src/shared/ai/application/modelPort'
import { runModelLoop } from '../src/shared/ai/application/runModelLoop'
import type { ModelPort, ModelReply, ModelRequest } from '../src/shared/ai/application/modelPort'
import type { AiPart, AiTask, AiTool } from '../src/shared/ai/domain/aiTask'
import type { StrictSchema } from '../src/shared/ai/domain/strictSchema'

const OUTPUT: StrictSchema = { type: 'object', additionalProperties: false, required: ['label'], properties: { label: { type: 'string', enum: ['software', 'travel'] } } }
const TOKENS = { input: 1000, cacheRead: 0, cacheWrite: 0, output: 200 }
const SONNET = { name: 'Sonnet 5.5', price: { inputPerMillion: 2, cacheReadPerMillion: 0.1, cacheWritePerMillion: 2.5, outputPerMillion: 10 } }

const LOOKUP: AiTool = {
  name: 'lookup',
  description: 'Looks one thing up.',
  input: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' } } },
  async run(args) {
    const { id } = args as { id: string }
    if (id === 'missing') throw new RangeError('Nothing is called missing.')
    return { text: `Rule ${id}, paid to HR1210010051863000160.`, sources: [id], figures: [] }
  },
}

function taskOf(parts: readonly AiPart[], tools: readonly AiTool[] = []): AiTask<null, { readonly label: string; readonly sources: readonly string[] }> {
  return {
    id: 'test.label',
    app: 'test',
    effort: 'low',
    system: () => [{ kind: 'text', text: 'Label the row. The owner OIB is 12345678903.' }],
    input: () => parts,
    output: () => OUTPUT,
    tools,
    check(output, _input, log) {
      const { label } = output as { label: string }
      return { draft: { label, sources: log.answers.flatMap((answer) => answer.sources) }, problems: label === 'travel' ? ['Travel needs a receipt.'] : [] }
    },
  }
}

/** A model that answers each request with the next reply, noting what it was sent. */
function modelOf(replies: readonly ModelReply[], readsPdf = true): ModelPort & { readonly sent: ModelRequest[] } {
  const sent: ModelRequest[] = []
  return {
    sent,
    readsPdf,
    model: SONNET,
    async send(request) {
      sent.push(structuredClone(request))
      const reply = replies[sent.length - 1]
      if (reply === undefined) throw new Error('the model was asked once too often')
      return reply
    },
  }
}

function portsOf(model: ModelPort | null, change: Partial<RunPorts> = {}): RunPorts {
  return { model, appOn: true, employees: { sends: false, anonymising: true }, ...change }
}

const answer = (label: string): ModelReply => ({ kind: 'answer', text: JSON.stringify({ label }), raw: null, tokens: TOKENS })
const ROW: AiPart = { kind: 'text', text: 'GITHUB INC, card, from HR12 1001 0051 8630 0016 0, OIB 98765432106' }

describe('a run of a task', () => {
  it('masks every text part it built and the system prompt, and leaves a PDF part as it is', async () => {
    const pdf: AiPart = { kind: 'pdf', base64: 'JVBERi0xLjQK', name: 'offer.pdf' }
    const model = modelOf([answer('software')])

    const result = await runTask(taskOf([pdf, ROW]), null, portsOf(model))

    expect(result).toMatchObject({ kind: 'draft', draft: { label: 'software' }, problems: [] })
    const [request] = model.sent
    expect(request!.turns).toEqual([{ role: 'user', parts: [pdf, { kind: 'text', text: 'GITHUB INC, card, from HR•• ••••0160, OIB [OIB]' }] }])
    expect(request!.system).toEqual([{ kind: 'text', text: 'Label the row. The owner OIB is [OIB].' }])
    expect(request!.effort).toBe('low')
    expect(request!.output).toEqual(OUTPUT)
  })

  it('gives the usage of every request with its cost at the list price', async () => {
    const result = await runTask(taskOf([ROW]), null, portsOf(modelOf([answer('software')])))
    expect(result).toMatchObject({ usage: { model: 'Sonnet 5.5', inputTokens: 1000, outputTokens: 200, dollars: 0.004 } })
  })

  it("passes the task's own problems with its draft", async () => {
    expect(await runTask(taskOf([ROW]), null, portsOf(modelOf([answer('travel')])))).toMatchObject({ kind: 'draft', problems: ['Travel needs a receipt.'] })
  })

  it('fails an answer off the schema, or not JSON, with what is wrong and no draft', async () => {
    expect(await runTask(taskOf([ROW]), null, portsOf(modelOf([answer('groceries')])))).toMatchObject({ kind: 'failed', reason: 'label is not one of the allowed values' })
    expect(await runTask(taskOf([ROW]), null, portsOf(modelOf([{ kind: 'answer', text: '{"label":"software","extra":1}', raw: null, tokens: TOKENS }])))).toMatchObject({
      kind: 'failed',
      reason: 'extra is not asked for',
    })
    expect(await runTask(taskOf([ROW]), null, portsOf(modelOf([{ kind: 'answer', text: 'Sure! Software.', raw: null, tokens: TOKENS }])))).toMatchObject({
      kind: 'failed',
      reason: 'The answer is not JSON.',
    })
  })

  it('turns a refusal and a cut-off into their own results', async () => {
    expect(await runTask(taskOf([ROW]), null, portsOf(modelOf([{ kind: 'refused', reason: 'Not this one.', tokens: TOKENS }])))).toMatchObject({ kind: 'refused', reason: 'Not this one.' })
    expect(await runTask(taskOf([ROW]), null, portsOf(modelOf([{ kind: 'cut-off', tokens: TOKENS }])))).toMatchObject({ kind: 'cut-off' })
  })

  it('turns a provider error into a failure with its message', async () => {
    const model: ModelPort = { ...modelOf([]), send: () => Promise.reject(new ModelRequestFailed(529, 'Overloaded')) }
    expect(await runTask(taskOf([ROW]), null, portsOf(model))).toEqual({ kind: 'failed', reason: 'Overloaded', usage: null })
  })
})

describe('a run that sends nothing', () => {
  it('sends nothing while the app is switched off', async () => {
    const model = modelOf([answer('software')])
    expect(await runTask(taskOf([ROW]), null, portsOf(model, { appOn: false }))).toEqual({ kind: 'switched-off', which: 'app' })
    expect(model.sent).toEqual([])
  })

  it('sends nothing about employees while Anonymise is on, and sends it once Anonymise is off', async () => {
    const model = modelOf([answer('software')])
    expect(await runTask(taskOf([ROW]), null, portsOf(model, { employees: { sends: true, anonymising: true } }))).toEqual({ kind: 'switched-off', which: 'employees' })
    expect(model.sent).toEqual([])
    expect(await runTask(taskOf([ROW]), null, portsOf(model, { employees: { sends: true, anonymising: false } }))).toMatchObject({ kind: 'draft' })
  })

  it('sends nothing without a key', async () => {
    expect(await runTask(taskOf([ROW]), null, portsOf(null))).toEqual({ kind: 'no-key' })
  })

  it('sends no PDF to a provider that does not read one', async () => {
    const model = modelOf([answer('software')], false)
    expect(await runTask(taskOf([{ kind: 'pdf', base64: 'JVBERi0xLjQK', name: 'offer.pdf' }]), null, portsOf(model))).toEqual({ kind: 'no-pdf' })
    expect(model.sent).toEqual([])
  })

  it('stops before a request that would pass the input cap', async () => {
    const model = modelOf([answer('software')])
    const long: AiPart = { kind: 'text', text: 'x'.repeat(MAX_REQUEST_TOKENS * 3) }
    expect(await runTask(taskOf([long]), null, portsOf(model))).toEqual({ kind: 'too-long', reason: String(MAX_REQUEST_TOKENS), usage: null })
    expect(model.sent).toEqual([])
  })
})

describe('the tool rounds of a run', () => {
  const calls = (...ids: string[]): ModelReply => ({
    kind: 'tool-calls',
    calls: ids.map((id, index) => ({ id: `call-${index}`, name: 'lookup', args: { id } })),
    raw: { made: 'by the adapter' },
    tokens: TOKENS,
  })

  it("sends the results of one turn back in one message, masked, after the model's own turn, and gives the check what the tools returned", async () => {
    const model = modelOf([calls('hr.vat.rates', 'missing'), answer('software')])

    const result = await runTask(taskOf([ROW], [LOOKUP]), null, portsOf(model))

    expect(result).toMatchObject({ kind: 'draft', draft: { label: 'software', sources: ['hr.vat.rates'] }, usage: { inputTokens: 2000, outputTokens: 400 } })
    expect(model.sent[0]!.tools).toEqual([{ name: 'lookup', description: 'Looks one thing up.', input: LOOKUP.input }])
    expect(model.sent[1]!.turns.slice(1)).toEqual([
      { role: 'assistant', calls: [expect.objectContaining({ id: 'call-0' }), expect.objectContaining({ id: 'call-1' })], raw: { made: 'by the adapter' } },
      {
        role: 'tool-results',
        results: [
          { callId: 'call-0', text: 'Rule hr.vat.rates, paid to HR•• ••••0160.', parts: [], isError: false },
          { callId: 'call-1', text: 'Nothing is called missing.', parts: [], isError: true },
        ],
      },
    ])
  })

  it('answers an unknown tool and arguments off its schema as tool errors, which the model may then mend', async () => {
    const model = modelOf([
      {
        kind: 'tool-calls',
        calls: [
          { id: 'a', name: 'web_search', args: {} },
          { id: 'b', name: 'lookup', args: { id: 7 } },
        ],
        raw: null,
        tokens: TOKENS,
      },
      answer('software'),
    ])
    await runTask(taskOf([ROW], [LOOKUP]), null, portsOf(model))
    expect(model.sent[1]!.turns[2]).toEqual({
      role: 'tool-results',
      results: [
        { callId: 'a', text: 'There is no tool named web_search.', parts: [], isError: true },
        { callId: 'b', text: 'id is not text', parts: [], isError: true },
      ],
    })
  })

  it(`stops after ${MAX_TOOL_ROUNDS} rounds of lookups`, async () => {
    const model = modelOf(Array.from({ length: MAX_TOOL_ROUNDS + 1 }, () => calls('hr.vat.rates')))
    expect(await runTask(taskOf([ROW], [LOOKUP]), null, portsOf(model))).toMatchObject({ kind: 'failed', reason: `more than ${MAX_TOOL_ROUNDS} rounds of lookups` })
    expect(model.sent).toHaveLength(MAX_TOOL_ROUNDS + 1)
  })

  it('counts one request against the cap and not the whole run, so cached tokens read again and again do not stop it', async () => {
    const cached: ModelReply = {
      kind: 'tool-calls',
      calls: [{ id: 'a', name: 'lookup', args: { id: 'hr.vat.rates' } }],
      raw: null,
      tokens: { input: 1000, cacheRead: 45_000, cacheWrite: 0, output: 100 },
    }
    const model = modelOf([cached, cached, cached, answer('software')])
    // Three requests of 46,000 add up to 138,000, which the old sum over a run would have stopped.
    expect(await runTask(taskOf([ROW], [LOOKUP]), null, portsOf(model))).toMatchObject({ kind: 'draft', usage: { inputTokens: 4000, cacheReadTokens: 135_000 } })
    expect(model.sent).toHaveLength(4)
  })

  it('stops a run away tool loop on the dearest model well under several dollars, with each kind of token at its real weight', async () => {
    // Every reply at the 16,000 output limit, priced as GPT-6 Astra.
    const round: ModelReply = {
      kind: 'tool-calls',
      calls: [{ id: 'a', name: 'lookup', args: { id: 'hr.vat.rates' } }],
      raw: null,
      tokens: { input: 19_000, cacheRead: 0, cacheWrite: 0, output: 16_000 },
    }
    const astra = {
      ...modelOf(Array.from({ length: MAX_TOOL_ROUNDS + 1 }, () => round)),
      model: { name: 'GPT-6 Astra', price: { inputPerMillion: 10, cacheReadPerMillion: 1, cacheWritePerMillion: 12.5, outputPerMillion: 50 } },
    }
    const result = await runTask(taskOf([ROW], [LOOKUP]), null, portsOf(astra))
    // One request weighs 19,000 + 5 x 16,000 = 99,000, so a second one goes and a third does not.
    expect(result).toMatchObject({ kind: 'over-budget', usage: { outputTokens: 32_000 } })
    expect(result.kind === 'over-budget' && result.usage!.dollars).toBeLessThan(3)
    expect(astra.sent).toHaveLength(2)
  })

  it('lets a run go on while cached reads are all it spends', async () => {
    // 200,000 tokens read from the cache weigh 20,000, far under the limit.
    const cached: ModelReply = { kind: 'tool-calls', calls: [{ id: 'a', name: 'lookup', args: { id: 'hr.vat.rates' } }], raw: null, tokens: { input: 0, cacheRead: 40_000, cacheWrite: 0, output: 0 } }
    const model = modelOf([cached, cached, cached, cached, cached, answer('software')])
    expect(MAX_RUN_TOKENS).toBe(100_000)
    expect(await runTask(taskOf([ROW], [LOOKUP]), null, portsOf(model))).toMatchObject({ kind: 'draft' })
  })

  it('stops a loop before a request whose prompt, cached tokens included, has reached the cap', async () => {
    const heavy: ModelReply = {
      kind: 'tool-calls',
      calls: [{ id: 'a', name: 'lookup', args: { id: 'hr.vat.rates' } }],
      raw: null,
      tokens: { input: 1000, cacheRead: 99_500, cacheWrite: 0, output: 100 },
    }
    const model = modelOf([heavy, answer('software')])
    expect(await runTask(taskOf([ROW], [LOOKUP]), null, portsOf(model))).toMatchObject({ kind: 'too-long', reason: String(MAX_REQUEST_TOKENS), usage: { cacheReadTokens: 99_500 } })
    expect(model.sent).toHaveLength(1)
  })

  it('prices each kind of token at its own rate, and gives no price for a model with none', async () => {
    const tokens = { input: 1000, cacheRead: 10_000, cacheWrite: 2000, output: 500 }
    const answered: ModelReply = { kind: 'answer', text: JSON.stringify({ label: 'software' }), raw: null, tokens }
    // 1,000 at $2, 10,000 at $0.10, 2,000 at $2.50 and 500 at $10 per million.
    expect(await runTask(taskOf([ROW]), null, portsOf(modelOf([answered])))).toMatchObject({ usage: { dollars: (2000 + 1000 + 5000 + 5000) / 1_000_000 } })
    const unpriced = { ...modelOf([answered]), model: { name: 'made-up-model', price: null } }
    expect(await runTask(taskOf([ROW]), null, portsOf(unpriced))).toMatchObject({ usage: { model: 'made-up-model', inputTokens: 1000, dollars: null } })
  })

  it('hands back the turns a chat keeps, ending with the whole assistant turn, and passes the pieces of the text along', async () => {
    const seen: unknown[] = []
    const model: ModelPort = {
      readsPdf: true,
      model: SONNET,
      async send(request) {
        seen.push(request.output, request.onDelta)
        return { kind: 'answer', text: 'Plain words.', raw: [{ type: 'text', text: 'Plain words.' }], tokens: TOKENS }
      },
    }
    const onDelta = (): void => undefined
    const end = await runModelLoop({
      model,
      system: [],
      turns: [{ role: 'user', parts: [{ kind: 'text', text: 'Account HR1210010051863000160?' }] }],
      output: null,
      tools: [],
      runTool: () => Promise.reject(new Error('no tool here')),
      effort: 'low',
      onDelta,
      limits: { rounds: 1, requestTokens: 1000, runTokens: 1000 },
    })
    expect(seen).toEqual([null, onDelta])
    expect(end).toMatchObject({ kind: 'answer', text: 'Plain words.' })
    expect(end.kind === 'answer' && end.turns).toEqual([
      { role: 'user', parts: [{ kind: 'text', text: 'Account HR•• ••••0160?' }] },
      { role: 'assistant', calls: [], raw: [{ type: 'text', text: 'Plain words.' }] },
    ])
  })

  it('passes its signal to the model on each request', async () => {
    const seen: (AbortSignal | undefined)[] = []
    const model: ModelPort = {
      readsPdf: true,
      model: SONNET,
      async send(request) {
        seen.push(request.signal)
        return answer('software')
      },
    }
    const { signal } = new AbortController()
    await runTask(taskOf([ROW]), null, { ...portsOf(model), signal })
    expect(seen).toEqual([signal])
  })

  it('counts the tokens a failure spent, with those of the requests before it', async () => {
    const model: ModelPort = {
      readsPdf: true,
      model: SONNET,
      async send() {
        throw new ModelRequestFailed(200, 'It stopped for a reason Kuna does not know.', { input: 500, cacheRead: 0, cacheWrite: 0, output: 100 })
      },
    }
    expect(await runTask(taskOf([ROW]), null, portsOf(model))).toMatchObject({ kind: 'failed', usage: { inputTokens: 500, outputTokens: 100 } })
  })
})
