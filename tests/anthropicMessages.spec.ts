import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelRequest } from '../src/shared/ai/application/modelPort'
import { ModelRequestFailed } from '../src/shared/ai/application/modelPort'
import { runModelLoop } from '../src/shared/ai/application/runModelLoop'
import type { StrictSchema } from '../src/shared/ai/domain/strictSchema'
import { anthropicMessages, testAnthropicKey } from '../src/shared/ai/infrastructure/anthropicMessages'
import type { ModelChoice } from '../src/shared/ai/domain/providerPresets'
import { eventsAsStream, streamCutByAbort, streamFixture, streamResponse } from './support/sseResponse'

const KEY = 'made-up-anthropic-key-0042'
const SONNET_PRICE = { inputPerMillion: 2, cacheReadPerMillion: 0.1, cacheWritePerMillion: 2.5, outputPerMillion: 10 }
const SONNET: ModelChoice = { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', price: SONNET_PRICE }

interface SentRequest {
  readonly url: string
  readonly method: string
  readonly headers: Readonly<Record<string, string>>
  readonly body: Record<string, unknown>
}

function stubFetch(...answers: Response[]): SentRequest[] {
  const requests: SentRequest[] = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
    requests.push({ url: input, method: init.method ?? 'GET', headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) as Record<string, unknown> })
    const answer = answers.shift()
    if (answer === undefined) throw new Error('The test sent more requests than it answers.')
    return answer
  })
  return requests
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const RULE_INPUT: StrictSchema = { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false }

const THINKING_BLOCK = { type: 'thinking', thinking: '', signature: 'EqQBCkgIBhABGAIiQGQ2made-up-signature' }

const TOOL_USE_CONTENT = [
  THINKING_BLOCK,
  { type: 'text', text: 'I will look up both rules.' },
  { type: 'tool_use', id: 'toolu_01A9q4Rm', name: 'rule', input: { id: 'pdv-25' } },
  { type: 'tool_use', id: 'toolu_01B7xKp2', name: 'rule', input: { id: 'pdv-13' } },
]

const USAGE = { input_tokens: 412, cache_creation_input_tokens: 1800, cache_read_input_tokens: 0, output_tokens: 96 }
const TOKENS = { input: 412, cacheRead: 0, cacheWrite: 1800, output: 96 }

/** The stream Anthropic sends for a message of these blocks, one piece of each at a time. */
function message(fields: { readonly content: readonly Record<string, unknown>[]; readonly stop_reason: string; readonly stop_details?: unknown; readonly usage?: Record<string, number> }): Response {
  const usage = fields.usage ?? USAGE
  return streamResponse(
    eventsAsStream([
      { type: 'message_start', message: { id: 'msg_01MadeUp', type: 'message', role: 'assistant', content: [], model: 'claude-sonnet-5-5', usage: { ...usage, output_tokens: 1 } } },
      { type: 'ping' },
      ...fields.content.flatMap((block, index) => blockEvents(block, index)),
      { type: 'message_delta', delta: { stop_reason: fields.stop_reason, stop_sequence: null, stop_details: fields.stop_details ?? null }, usage: { output_tokens: usage.output_tokens } },
      { type: 'message_stop' },
    ]),
  )
}

function blockEvents(block: Record<string, unknown>, index: number): { readonly type: string; readonly [field: string]: unknown }[] {
  const pieces = {
    text: [{ type: 'text_delta', text: block['text'] }],
    thinking: [{ type: 'signature_delta', signature: block['signature'] }],
    tool_use: [{ type: 'input_json_delta', partial_json: JSON.stringify(block['input']) }],
  }[String(block['type'])]
  const started = block['type'] === 'text' ? { type: 'text', text: '' } : block['type'] === 'thinking' ? { type: 'thinking', thinking: '' } : { ...block, input: {} }
  return [{ type: 'content_block_start', index, content_block: started }, ...(pieces ?? []).map((delta) => ({ type: 'content_block_delta', index, delta })), { type: 'content_block_stop', index }]
}

function request(fields: Partial<ModelRequest> = {}): ModelRequest {
  return {
    system: [
      { kind: 'text', text: 'You sort bank rows into categories.' },
      { kind: 'text', text: 'Answer with the category only.' },
    ],
    turns: [{ role: 'user', parts: [{ kind: 'text', text: 'Row 4: Tisak, 3.20 EUR' }] }],
    tools: [],
    effort: 'low',
    ...fields,
  }
}

describe('the Anthropic Messages request', () => {
  it('posts to the Messages API with the key, the version and the header for calls from a browser', async () => {
    const requests = stubFetch(message({ content: [{ type: 'text', text: '{"category":"office"}' }], stop_reason: 'end_turn' }))

    await anthropicMessages(KEY, SONNET).send(request())

    expect(requests[0]!.url).toBe('https://api.anthropic.com/v1/messages')
    expect(requests[0]!.method).toBe('POST')
    expect(requests[0]!.headers).toEqual({
      'content-type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2026-10-21',
      'anthropic-dangerous-direct-browser-access': 'true',
    })
  })

  it('sends the effort, and no sampling, thinking, tools or beta', async () => {
    const requests = stubFetch(message({ content: [{ type: 'text', text: '{"category":"office"}' }], stop_reason: 'end_turn' }))

    await anthropicMessages(KEY, SONNET).send(request())

    const body = requests[0]!.body
    expect(body.model).toBe('claude-sonnet-5-5')
    expect(body.max_tokens).toBe(16000)
    expect(body.output_config).toEqual({ effort: 'low' })
    expect(body.stream).toBe(true)
    expect(Object.keys(body).sort()).toEqual(['max_tokens', 'messages', 'model', 'output_config', 'stream', 'system'])
    expect(Object.keys(requests[0]!.headers)).not.toContain('anthropic-beta')
  })

  it('marks only the last system block for the cache', async () => {
    const requests = stubFetch(message({ content: [{ type: 'text', text: '{"category":"office"}' }], stop_reason: 'end_turn' }))

    await anthropicMessages(KEY, SONNET).send(request())

    expect(requests[0]!.body.system).toEqual([
      { type: 'text', text: 'You sort bank rows into categories.' },
      { type: 'text', text: 'Answer with the category only.', cache_control: { type: 'ephemeral' } },
    ])
  })

  it('sends each tool as a strict tool with an automatic choice, and no server tool', async () => {
    const requests = stubFetch(message({ content: [{ type: 'text', text: '{"category":"office"}' }], stop_reason: 'end_turn' }))

    await anthropicMessages(KEY, SONNET).send(request({ tools: [{ name: 'rule', title: 'Read a rule', readOnly: true, description: 'Reads one rule by its id.', input: RULE_INPUT }] }))

    expect(requests[0]!.body.tools).toEqual([{ name: 'rule', description: 'Reads one rule by its id.', input_schema: RULE_INPUT, strict: true }])
    expect(requests[0]!.body.tool_choice).toEqual({ type: 'auto' })
  })

  it('turns the parts of a user turn into text, document and image blocks in their order', async () => {
    const requests = stubFetch(message({ content: [{ type: 'text', text: '{"category":"office"}' }], stop_reason: 'end_turn' }))

    await anthropicMessages(KEY, SONNET).send(
      request({
        turns: [
          {
            role: 'user',
            parts: [
              { kind: 'text', text: 'Read this offer.' },
              { kind: 'pdf', base64: 'JVBERi0xLjcK', name: 'offer.pdf' },
              { kind: 'image', base64: '/9j/4AAQSkZJRg==', mediaType: 'image/jpeg', width: 1120, height: 1600 },
            ],
          },
        ],
      }),
    )

    expect(requests[0]!.body.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Read this offer.' },
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0xLjcK' }, title: 'offer.pdf' },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/4AAQSkZJRg==' }, cache_control: { type: 'ephemeral' } },
        ],
      },
    ])
  })

  it('sends an assistant turn back exactly as it came, thinking included, and the results of one round in one user message', async () => {
    const requests = stubFetch(message({ content: [{ type: 'text', text: '{"category":"office"}' }], stop_reason: 'end_turn' }))

    await anthropicMessages(KEY, SONNET).send(
      request({
        turns: [
          { role: 'user', parts: [{ kind: 'text', text: 'Which rate applies?' }] },
          { role: 'assistant', calls: [], raw: TOOL_USE_CONTENT },
          {
            role: 'tool-results',
            results: [
              { callId: 'toolu_01A9q4Rm', text: 'PDV is 25 percent.', parts: [], isError: false },
              { callId: 'toolu_01B7xKp2', text: 'There is no rule pdv-13.', parts: [], isError: true },
            ],
          },
        ],
      }),
    )

    const sent = requests[0]!.body.messages as unknown[]
    expect(sent).toHaveLength(3)
    expect(sent[1]).toEqual({ role: 'assistant', content: TOOL_USE_CONTENT })
    expect(sent[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'toolu_01A9q4Rm', content: 'PDV is 25 percent.', is_error: false },
        { type: 'tool_result', tool_use_id: 'toolu_01B7xKp2', content: 'There is no rule pdv-13.', is_error: true, cache_control: { type: 'ephemeral' } },
      ],
    })
  })

  it('sends a tool result with a photo or a PDF as a list, its envelope first, and one with text only as a string', async () => {
    const requests = stubFetch(message({ content: [{ type: 'text', text: 'Read.' }], stop_reason: 'end_turn' }))

    await anthropicMessages(KEY, SONNET).send(
      request({
        turns: [
          { role: 'user', parts: [{ kind: 'text', text: 'Read my receipt and the offer.' }] },
          { role: 'assistant', calls: [], raw: TOOL_USE_CONTENT },
          {
            role: 'tool-results',
            results: [
              {
                callId: 'toolu_01A9q4Rm',
                text: '{"id":"a1","kind":"photo"}',
                parts: [{ kind: 'image', base64: '/9j/4AAQSkZJRg==', mediaType: 'image/jpeg', width: 1120, height: 1600 }],
                isError: false,
              },
              { callId: 'toolu_01B7xKp2', text: '{"id":"a2","kind":"pdf"}', parts: [{ kind: 'pdf', base64: 'JVBERi0xLjcK', name: 'a2' }], isError: false },
              { callId: 'toolu_01C3mWq9', text: 'There is no attachment a3.', parts: [], isError: true },
            ],
          },
        ],
      }),
    )

    expect((requests[0]!.body.messages as unknown[])[2]).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_01A9q4Rm',
          content: [
            { type: 'text', text: '{"id":"a1","kind":"photo"}' },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/4AAQSkZJRg==' } },
          ],
          is_error: false,
        },
        {
          type: 'tool_result',
          tool_use_id: 'toolu_01B7xKp2',
          content: [
            { type: 'text', text: '{"id":"a2","kind":"pdf"}' },
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0xLjcK' }, title: 'a2' },
          ],
          is_error: false,
        },
        { type: 'tool_result', tool_use_id: 'toolu_01C3mWq9', content: 'There is no attachment a3.', is_error: true, cache_control: { type: 'ephemeral' } },
      ],
    })
  })

  it('sends no empty text block beside a photo, which Anthropic refuses', async () => {
    const requests = stubFetch(message({ content: [{ type: 'text', text: 'Read.' }], stop_reason: 'end_turn' }))

    await anthropicMessages(KEY, SONNET).send(
      request({
        turns: [
          { role: 'user', parts: [{ kind: 'text', text: 'Read my receipt.' }] },
          { role: 'assistant', calls: [], raw: TOOL_USE_CONTENT },
          {
            role: 'tool-results',
            results: [{ callId: 'toolu_01A9q4Rm', text: '', parts: [{ kind: 'image', base64: '/9j/4AAQSkZJRg==', mediaType: 'image/jpeg', width: 1120, height: 1600 }], isError: false }],
          },
        ],
      }),
    )

    expect((requests[0]!.body.messages as { content: { content: unknown }[] }[])[2]!.content[0]!.content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/4AAQSkZJRg==' } },
    ])
  })
})

describe('the Anthropic Messages reply', () => {
  it('reads an end_turn as the answer from its text blocks, with fresh, cache read and cache write tokens apart', async () => {
    stubFetch(
      message({
        content: [THINKING_BLOCK, { type: 'text', text: '{"category":' }, { type: 'text', text: '"office"}' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 40, cache_creation_input_tokens: 1200, cache_read_input_tokens: 3000, output_tokens: 18 },
      }),
    )

    expect(await anthropicMessages(KEY, SONNET).send(request())).toMatchObject({ kind: 'answer', text: '{"category":"office"}', tokens: { input: 40, cacheRead: 3000, cacheWrite: 1200, output: 18 } })
  })

  it('reads a tool_use as the calls to run, keeping the whole content to send back', async () => {
    stubFetch(message({ content: TOOL_USE_CONTENT, stop_reason: 'tool_use' }))

    expect(await anthropicMessages(KEY, SONNET).send(request())).toEqual({
      kind: 'tool-calls',
      calls: [
        { id: 'toolu_01A9q4Rm', name: 'rule', args: { id: 'pdv-25' } },
        { id: 'toolu_01B7xKp2', name: 'rule', args: { id: 'pdv-13' } },
      ],
      raw: TOOL_USE_CONTENT,
      tokens: TOKENS,
    })
  })

  it('reads a refusal with its explanation, before it reads any content', async () => {
    stubFetch(
      message({
        content: [],
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber', explanation: 'This request looks like it asks for help with malware.' },
      }),
    )

    expect(await anthropicMessages(KEY, SONNET).send(request())).toEqual({
      kind: 'refused',
      reason: 'This request looks like it asks for help with malware.',
      tokens: TOKENS,
    })
  })

  it('reads a refusal without details as one with an empty reason', async () => {
    stubFetch(message({ content: [], stop_reason: 'refusal', stop_details: null }))

    expect(await anthropicMessages(KEY, SONNET).send(request())).toMatchObject({ kind: 'refused', reason: '' })
  })

  it('reads max_tokens and a full context window as an answer cut off', async () => {
    stubFetch(
      message({ content: [{ type: 'text', text: '{"category":"off' }], stop_reason: 'max_tokens' }),
      message({ content: [{ type: 'text', text: '{"cat' }], stop_reason: 'model_context_window_exceeded' }),
    )
    const model = anthropicMessages(KEY, SONNET)

    expect(await model.send(request())).toEqual({ kind: 'cut-off', tokens: TOKENS })
    expect(await model.send(request())).toMatchObject({ kind: 'cut-off' })
  })

  it('fails on a stop reason it does not know', async () => {
    stubFetch(message({ content: [], stop_reason: 'pause_turn' }))

    await expect(anthropicMessages(KEY, SONNET).send(request())).rejects.toMatchObject({ name: 'ModelRequestFailed', status: 200 })
  })
})

describe('an Anthropic Messages request that fails', () => {
  it('reports a refused key with the message from the error body', async () => {
    stubFetch(
      Response.json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' }, request_id: 'req_011CgifHEAe5J2jo5cY7L5SC' }, { status: 401, statusText: 'Unauthorized' }),
    )

    const failure = await anthropicMessages(KEY, SONNET)
      .send(request())
      .catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ModelRequestFailed)
    expect(failure).toMatchObject({ status: 401, message: 'invalid x-api-key' })
  })

  it('reports an overloaded provider with its status and message', async () => {
    stubFetch(Response.json({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' }, request_id: 'req_011CgjQ2b8wL' }, { status: 529 }))

    await expect(anthropicMessages(KEY, SONNET).send(request())).rejects.toMatchObject({ name: 'ModelRequestFailed', status: 529, message: 'Overloaded' })
  })

  it('falls back to the status text when the error body is not JSON', async () => {
    stubFetch(new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }))

    await expect(anthropicMessages(KEY, SONNET).send(request())).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' })
  })

  it('reports a request that never reached the provider with status 0', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))

    await expect(anthropicMessages(KEY, SONNET).send(request())).rejects.toMatchObject({ name: 'ModelRequestFailed', status: 0, message: 'Failed to fetch' })
  })
})

describe('the Anthropic key test', () => {
  it('counts the tokens of one word with the same headers, and nothing from the books', async () => {
    const requests = stubFetch(Response.json({ input_tokens: 8 }))

    expect(await testAnthropicKey(KEY, 'claude-haiku-5-5')).toEqual({ kind: 'works' })
    expect(requests[0]!.url).toBe('https://api.anthropic.com/v1/messages/count_tokens')
    expect(requests[0]!.method).toBe('POST')
    expect(requests[0]!.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(requests[0]!.headers['x-api-key']).toBe(KEY)
    expect(requests[0]!.body).toEqual({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'Hi' }] })
  })

  it('says a key Anthropic turns away is refused', async () => {
    stubFetch(
      Response.json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, { status: 401 }),
      Response.json({ type: 'error', error: { type: 'permission_error', message: 'This key cannot use this model.' } }, { status: 403 }),
    )

    expect(await testAnthropicKey(KEY, 'claude-haiku-5-5')).toEqual({ kind: 'refused' })
    expect(await testAnthropicKey(KEY, 'claude-haiku-5-5')).toEqual({ kind: 'refused' })
  })

  it('says the test failed, with the reason, on any other status or when Anthropic cannot be reached', async () => {
    stubFetch(Response.json({ type: 'error', error: { type: 'rate_limit_error', message: 'Number of requests has exceeded your rate limit.' } }, { status: 429 }))

    expect(await testAnthropicKey(KEY, 'claude-haiku-5-5')).toEqual({ kind: 'failed', reason: 'Number of requests has exceeded your rate limit.' })

    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))
    expect(await testAnthropicKey(KEY, 'claude-haiku-5-5')).toEqual({ kind: 'failed', reason: 'Failed to fetch' })
  })
})

describe('a model loop over the Anthropic adapter', () => {
  function askedOver(question: string) {
    return runModelLoop({
      model: anthropicMessages(KEY, SONNET),
      system: [{ kind: 'text', text: 'You answer which VAT rate applies, citing the rule.' }],
      turns: [{ role: 'user', parts: [{ kind: 'text', text: question }] }],
      tools: [{ name: 'rule', title: 'Read a rule', readOnly: true, description: 'Reads one rule by its id.', input: RULE_INPUT }],
      runTool: async () => ({ text: 'Rule pdv-25: the standard rate is 25 percent.', parts: [], isError: false }),
      effort: 'medium',
      rounds: 6,
    })
  }

  it('runs one tool round, then gives the answer with the usage of both requests', async () => {
    const firstContent = [THINKING_BLOCK, { type: 'tool_use', id: 'toolu_01A9q4Rm', name: 'rule', input: { id: 'pdv-25' } }]
    const requests = stubFetch(
      message({ content: firstContent, stop_reason: 'tool_use', usage: { input_tokens: 300, cache_creation_input_tokens: 1700, cache_read_input_tokens: 0, output_tokens: 80 } }),
      message({
        content: [THINKING_BLOCK, { type: 'text', text: 'The standard rate of 25 percent applies, by rule pdv-25.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 120, cache_creation_input_tokens: 0, cache_read_input_tokens: 1700, output_tokens: 20 },
      }),
    )

    const result = await askedOver('Which VAT rate applies to office chairs?')

    expect(result).toMatchObject({
      kind: 'answer',
      text: 'The standard rate of 25 percent applies, by rule pdv-25.',
      usage: {
        model: 'Sonnet 5.5',
        inputTokens: 420,
        cacheReadTokens: 1700,
        cacheWriteTokens: 1700,
        outputTokens: 100,
        // 420 fresh at $2, 1,700 read at $0.10, 1,700 written at $2.50 and 100 out at $10 per million.
        dollars: (420 * 2 + 1700 * 0.1 + 1700 * 2.5 + 100 * 10) / 1_000_000,
      },
    })
    expect(requests).toHaveLength(2)
    expect(requests[1]!.body.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Which VAT rate applies to office chairs?' }] },
      { role: 'assistant', content: firstContent },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'toolu_01A9q4Rm', content: 'Rule pdv-25: the standard rate is 25 percent.', is_error: false, cache_control: { type: 'ephemeral' } }],
      },
    ])
  })
})

describe('a stream that goes wrong', () => {
  function sendFixture(name: string): Promise<unknown> {
    stubFetch(streamResponse(streamFixture(`anthropic/${name}`)))
    return anthropicMessages(KEY, SONNET)
      .send(request())
      .catch((error: unknown) => error)
  }

  const STARTED = { input: 412, cacheRead: 3000, cacheWrite: 1800, output: 1 }

  it('fails a stream cut mid-way, keeping the tokens so far and running no half-written tool', async () => {
    const failure = await sendFixture('cut-midway')
    expect(failure).toBeInstanceOf(ModelRequestFailed)
    expect(failure).toMatchObject({ message: 'The stream ended before the answer did.', tokens: STARTED })
  })

  it('fails on overloaded_error mid-stream with its message and the tokens so far', async () => {
    expect(await sendFixture('overloaded')).toMatchObject({ name: 'ModelRequestFailed', status: 200, message: 'Overloaded', tokens: STARTED })
  })

  it('fails on a stop reason it does not know and keeps the tokens', async () => {
    const failure = await sendFixture('unknown-stop')
    expect(failure).toMatchObject({ status: 200, tokens: { ...STARTED, output: 7 } })
    expect((failure as Error).message).toContain('a_made_up_stop_reason')
  })

  it('fails on an event that is not JSON', async () => {
    stubFetch(streamResponse('event: ping\ndata: {not json\n\n'))
    await expect(anthropicMessages(KEY, SONNET).send(request())).rejects.toMatchObject({ name: 'ModelRequestFailed', message: 'The provider sent an event that is not JSON.' })
  })

  it('fails on a stream that says nothing of usage', async () => {
    stubFetch(streamResponse(eventsAsStream([{ type: 'message_start' }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }, { type: 'message_stop' }])))
    await expect(anthropicMessages(KEY, SONNET).send(request())).rejects.toBeInstanceOf(ModelRequestFailed)
  })

  it('fails as a failed request on events with no body', async () => {
    stubFetch(
      streamResponse(
        eventsAsStream([
          { type: 'content_block_start', index: 0 },
          { type: 'content_block_delta', index: 0 },
          { type: 'content_block_delta', index: 9, delta: { type: 'text_delta', text: 'x' } },
        ]),
      ),
    )
    await expect(anthropicMessages(KEY, SONNET).send(request())).rejects.toBeInstanceOf(ModelRequestFailed)
  })

  it('cuts the key out of what the provider says back', async () => {
    stubFetch(streamResponse(eventsAsStream([{ type: 'error', error: { message: `Bad key ${KEY}` } }])))
    const failure = await anthropicMessages(KEY, SONNET)
      .send(request())
      .catch((error: unknown) => error)
    expect((failure as Error).message).toBe('Bad key [key]')
    stubFetch(Response.json({ error: { message: `Bad key ${KEY}` } }, { status: 401 }))
    expect(await testAnthropicKey(KEY, 'claude-sonnet-5-5')).toEqual({ kind: 'refused' })
    stubFetch(Response.json({ error: { message: `Odd key ${KEY}` } }, { status: 400 }))
    expect(await testAnthropicKey(KEY, 'claude-sonnet-5-5')).toEqual({ kind: 'failed', reason: 'Odd key [key]' })
  })

  it('never puts the key in the address or the body', async () => {
    const requests = stubFetch(streamResponse(streamFixture('anthropic/answer')))
    await anthropicMessages(KEY, SONNET).send(request())
    expect(requests[0]!.url).not.toContain(KEY)
    expect(JSON.stringify(requests[0]!.body)).not.toContain(KEY)
  })

  it("shows the provider's words when it refuses a model, on a run and on a Test", async () => {
    const refusal = { type: 'error', error: { type: 'not_found_error', message: 'model: claude-made-up-model' } }
    stubFetch(Response.json(refusal, { status: 404 }))
    const typed: ModelChoice = { id: 'claude-made-up-model', name: 'claude-made-up-model', price: null }
    await expect(anthropicMessages(KEY, typed).send(request())).rejects.toMatchObject({ status: 404, message: 'model: claude-made-up-model' })
    stubFetch(Response.json(refusal, { status: 404 }))
    expect(await testAnthropicKey(KEY, typed.id)).toEqual({ kind: 'failed', reason: 'model: claude-made-up-model' })
  })
})

describe('a whole stream', () => {
  it('adds up in any chunks, a character split across two among them, and says its text as it comes', async () => {
    for (const chunkBytes of [1, 7, 4096]) {
      stubFetch(streamResponse(streamFixture('anthropic/answer'), chunkBytes))
      const deltas: string[] = []
      const reply = await anthropicMessages(KEY, SONNET).send(request({ onDelta: (text) => deltas.push(text) }))
      expect(reply).toMatchObject({ kind: 'answer', text: '{"category":"uredski pribor č"}', tokens: { input: 412, cacheRead: 3000, cacheWrite: 1800, output: 18 } })
      expect(deltas.join('')).toBe('{"category":"uredski pribor č"}')
    }
  })

  it('keeps every block as it came to send back, skips events it does not know, and calls only the client tool', async () => {
    stubFetch(streamResponse(streamFixture('anthropic/tool-round')))
    const reply = await anthropicMessages(KEY, SONNET).send(request())
    expect(reply).toMatchObject({ kind: 'tool-calls', calls: [{ id: 'toolu_made_up_1', name: 'rule', args: { id: 'pdv-25' } }], tokens: { output: 89 } })
    expect(reply.kind === 'tool-calls' && reply.raw).toEqual([
      { type: 'thinking', thinking: 'I need the rule.', signature: 'made-up-signature-AIzaMadeUpMadeUpMadeUpMadeUpMadeUpMadeUpMade' },
      { type: 'text', text: 'I will look it up.' },
      { type: 'made_up_server_block', id: 'srv_made_up', input: { query: 'a made-up query' } },
      { type: 'tool_use', id: 'toolu_made_up_1', name: 'rule', input: { id: 'pdv-25' } },
    ])
  })

  it('keeps the counts from the start of a stream when a later usage leaves them null', async () => {
    stubFetch(
      streamResponse(
        eventsAsStream([
          { type: 'message_start', message: { usage: { input_tokens: 412, cache_creation_input_tokens: 700, cache_read_input_tokens: 5000, output_tokens: 1 } } },
          { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '{}' } },
          { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { input_tokens: null, cache_creation_input_tokens: null, cache_read_input_tokens: null, output_tokens: 42 } },
          { type: 'message_stop' },
        ]),
      ),
    )
    expect(await anthropicMessages(KEY, SONNET).send(request())).toMatchObject({ kind: 'answer', tokens: { input: 412, cacheRead: 5000, cacheWrite: 700, output: 42 } })
  })

  it('hands a tool input that is not JSON to the schema check, and still sends the block back as an object', async () => {
    stubFetch(
      streamResponse(
        eventsAsStream([
          { type: 'message_start', message: { usage: USAGE } },
          { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_made_up_2', name: 'rule', input: {} } },
          { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"id":' } },
          { type: 'content_block_stop', index: 0 },
          { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
          { type: 'message_stop' },
        ]),
      ),
    )
    expect(await anthropicMessages(KEY, SONNET).send(request())).toMatchObject({ kind: 'tool-calls', calls: [{ args: { not_json: '{"id":' } }] })
  })
})

describe('an aborted Messages request', () => {
  it('hands fetch the signal, and fails with the reason it was aborted for', async () => {
    vi.stubGlobal('fetch', (_input: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal)
      return new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason as Error))
      })
    })
    const controller = new AbortController()
    const sending = anthropicMessages(KEY, SONNET).send(request({ signal: controller.signal }))
    controller.abort(new Error('Too slow.'))
    await expect(sending).rejects.toMatchObject({ status: 0, message: 'Too slow.' })
  })

  it('fails with the reason it was aborted for when the abort cuts a stream under way, keeping the tokens so far', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', async () => streamCutByAbort(streamFixture('anthropic/cut-midway').split('event: content_block_start')[0]!, controller.signal))
    const sending = anthropicMessages(KEY, SONNET).send(request({ signal: controller.signal }))
    setTimeout(() => controller.abort(new Error('Too slow.')), 10)
    await expect(sending).rejects.toMatchObject({ status: 0, message: 'Too slow.', tokens: { input: 412, cacheRead: 3000, cacheWrite: 1800, output: 1 } })
  })
})

describe('the cache breakpoint on the tail of a chat', () => {
  afterEach(() => vi.unstubAllGlobals())

  const answerStream = (): Response =>
    streamResponse(
      eventsAsStream([
        { type: 'message_start', message: { usage: { input_tokens: 1 } } },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } },
        { type: 'message_stop' },
      ]),
    )
  const lastBlock = (body: Record<string, unknown>) => (body['messages'] as { content: Record<string, unknown>[] }[]).at(-1)!.content.at(-1)!

  it('sits on the last block of a person’s turn or a tool result, and on no earlier one', async () => {
    const requests = stubFetch(answerStream(), answerStream())
    const model = anthropicMessages(KEY, SONNET)
    const base = { system: [{ kind: 'text' as const, text: 'Be Kuna.' }], tools: [], effort: 'low' as const }
    await model.send({ ...base, turns: [{ role: 'user', parts: [{ kind: 'text', text: 'One' }] }] })
    expect(lastBlock(requests[0]!.body)['cache_control']).toEqual({ type: 'ephemeral' })
    await model.send({
      ...base,
      turns: [
        { role: 'user', parts: [{ kind: 'text', text: 'One' }] },
        { role: 'assistant', calls: [], raw: [{ type: 'text', text: 'Two' }] },
        { role: 'tool-results', results: [{ callId: 'a', text: 'Three', parts: [], isError: false }] },
      ],
    })
    const messages = requests[1]!.body['messages'] as { content: Record<string, unknown>[] }[]
    expect(messages[0]!.content[0]!['cache_control']).toBeUndefined()
    expect(lastBlock(requests[1]!.body)['cache_control']).toEqual({ type: 'ephemeral' })
  })
})
