import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ModelRequest } from '../src/shared/ai/application/modelPort'
import { ModelRequestFailed } from '../src/shared/ai/application/modelPort'
import { runTask } from '../src/shared/ai/application/runTask'
import type { AiTask } from '../src/shared/ai/domain/aiTask'
import type { StrictSchema } from '../src/shared/ai/domain/strictSchema'
import { openAiResponses } from '../src/shared/ai/infrastructure/openAiResponses'
import type { ModelChoice } from '../src/shared/ai/domain/providerPresets'
import { eventsAsStream, streamCutByAbort, streamFixture, streamResponse } from './support/sseResponse'

const KEY = 'made-up-openai-key-0042'
const BASE_URL = 'https://api.openai.com/v1'
const SOL: ModelChoice = { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', price: { inputPerMillion: 2, cacheReadPerMillion: 0.1, cacheWritePerMillion: 2.5, outputPerMillion: 10 } }
const CATEGORY_SCHEMA: StrictSchema = { type: 'object', properties: { category: { type: 'string', enum: ['office', 'travel'] } }, required: ['category'], additionalProperties: false }
const RULE_INPUT: StrictSchema = { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false }
const TOKENS = { input: 400, cacheRead: 3000, cacheWrite: 1800, output: 96 }

interface SentRequest {
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
  readonly body: Record<string, unknown>
}

function stubFetch(...answers: Response[]): SentRequest[] {
  const requests: SentRequest[] = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
    requests.push({ url: input, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) as Record<string, unknown> })
    const answer = answers.shift()
    if (answer === undefined) throw new Error('The test sent more requests than it answers.')
    return answer
  })
  return requests
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function request(fields: Partial<ModelRequest> = {}): ModelRequest {
  return {
    system: [
      { kind: 'text', text: 'You sort bank rows into categories.' },
      { kind: 'text', text: 'Answer with the category only.' },
    ],
    turns: [{ role: 'user', parts: [{ kind: 'text', text: 'Row 4: Tisak, 3.20 EUR' }] }],
    output: CATEGORY_SCHEMA,
    tools: [],
    effort: 'low',
    ...fields,
  }
}

function sendFixture(name: string, fields: Partial<ModelRequest> = {}): Promise<unknown> {
  stubFetch(streamResponse(streamFixture(`openai/${name}`)))
  return openAiResponses(BASE_URL, KEY, SOL)
    .send(request(fields))
    .catch((error: unknown) => error)
}

describe('the Responses request', () => {
  it('posts to the Responses API with the bearer key, keeps nothing at OpenAI and streams', async () => {
    const requests = stubFetch(streamResponse(streamFixture('openai/answer')))
    await openAiResponses(BASE_URL, KEY, SOL).send(request())

    expect(requests[0]!.url).toBe('https://api.openai.com/v1/responses')
    expect(requests[0]!.url).not.toContain(KEY)
    expect(requests[0]!.headers).toEqual({ authorization: `Bearer ${KEY}`, 'content-type': 'application/json' })
    expect(requests[0]!.body).toEqual({
      model: 'gpt-6.1-sol',
      store: false,
      stream: true,
      max_output_tokens: 16000,
      reasoning: { effort: 'low' },
      instructions: 'You sort bank rows into categories.\n\nAnswer with the category only.',
      input: [{ role: 'user', content: [{ type: 'input_text', text: 'Row 4: Tisak, 3.20 EUR' }] }],
      text: { format: { type: 'json_schema', name: 'answer', strict: true, schema: CATEGORY_SCHEMA } },
    })
  })

  it('sends tools at the top level of each definition, strict, with an automatic choice and the schema beside them', async () => {
    const requests = stubFetch(streamResponse(streamFixture('openai/answer')))
    await openAiResponses(BASE_URL, KEY, SOL).send(request({ tools: [{ name: 'rule', description: 'Reads one rule by its id.', input: RULE_INPUT }] }))

    expect(requests[0]!.body.tools).toEqual([{ type: 'function', name: 'rule', description: 'Reads one rule by its id.', parameters: RULE_INPUT, strict: true }])
    expect(requests[0]!.body.tool_choice).toBe('auto')
    expect(requests[0]!.body.text).toBeDefined()
  })

  it('sends a PDF as a file part and a photo as an image part', async () => {
    const requests = stubFetch(streamResponse(streamFixture('openai/answer')))
    await openAiResponses(BASE_URL, KEY, SOL).send(
      request({
        turns: [
          {
            role: 'user',
            parts: [
              { kind: 'pdf', base64: 'JVBERi0xLjcK', name: 'offer.pdf' },
              { kind: 'image', base64: '/9j/4AAQSkZJRg==', mediaType: 'image/jpeg', width: 1120, height: 1600 },
            ],
          },
        ],
      }),
    )
    expect(requests[0]!.body.input).toEqual([
      {
        role: 'user',
        content: [
          { type: 'input_file', filename: 'offer.pdf', file_data: 'data:application/pdf;base64,JVBERi0xLjcK' },
          { type: 'input_image', image_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' },
        ],
      },
    ])
  })

  it('sends a tool output with a photo or a PDF as a list, its envelope first, and one with text only as a string', async () => {
    const requests = stubFetch(streamResponse(streamFixture('openai/answer')))
    await openAiResponses(BASE_URL, KEY, SOL).send(
      request({
        turns: [
          { role: 'user', parts: [{ kind: 'text', text: 'Read my receipt and the offer.' }] },
          { role: 'assistant', calls: [], raw: [] },
          {
            role: 'tool-results',
            results: [
              { callId: 'call_a1', text: '{"id":"a1","kind":"photo"}', parts: [{ kind: 'image', base64: '/9j/4AAQSkZJRg==', mediaType: 'image/jpeg', width: 1120, height: 1600 }], isError: false },
              { callId: 'call_a2', text: '{"id":"a2","kind":"pdf"}', parts: [{ kind: 'pdf', base64: 'JVBERi0xLjcK', name: 'a2' }], isError: false },
              { callId: 'call_a3', text: 'There is no attachment a3.', parts: [], isError: true },
            ],
          },
        ],
      }),
    )
    expect((requests[0]!.body.input as unknown[]).slice(1)).toEqual([
      {
        type: 'function_call_output',
        call_id: 'call_a1',
        output: [
          { type: 'input_text', text: '{"id":"a1","kind":"photo"}' },
          { type: 'input_image', image_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' },
        ],
      },
      {
        type: 'function_call_output',
        call_id: 'call_a2',
        output: [
          { type: 'input_text', text: '{"id":"a2","kind":"pdf"}' },
          { type: 'input_file', filename: 'a2', file_data: 'data:application/pdf;base64,JVBERi0xLjcK' },
        ],
      },
      { type: 'function_call_output', call_id: 'call_a3', output: 'Error: There is no attachment a3.' },
    ])
  })

  it('asks for no format when a request asks for no schema', async () => {
    const requests = stubFetch(streamResponse(streamFixture('openai/answer')))
    await openAiResponses(BASE_URL, KEY, SOL).send(request({ output: null }))
    expect(requests[0]!.body.text).toBeUndefined()
  })
})

describe('the Responses stream', () => {
  it('reads the answer in any chunks, with its text as it comes and each input token in one part', async () => {
    for (const chunkBytes of [1, 7, 4096]) {
      stubFetch(streamResponse(streamFixture('openai/answer'), chunkBytes))
      const deltas: string[] = []
      const reply = await openAiResponses(BASE_URL, KEY, SOL).send(request({ onDelta: (text) => deltas.push(text) }))
      expect(reply).toMatchObject({ kind: 'answer', text: '{"category":"office"}', tokens: TOKENS })
      expect(deltas.join('')).toBe('{"category":"office"}')
    }
  })

  it('reads the calls to run, by their call id, skips events it does not know, and keeps every item to send back', async () => {
    const reply = await sendFixture('tool-round')
    expect(reply).toMatchObject({ kind: 'tool-calls', calls: [{ id: 'call_made_up_1', name: 'rule', args: { id: 'pdv-25' } }], tokens: TOKENS })
    expect((reply as { raw: { type: string }[] }).raw.map((item) => item.type)).toEqual(['reasoning', 'made_up_server_call', 'function_call'])
  })

  it('streams none of a commentary message to the screen', async () => {
    const usage = { input_tokens: 10, output_tokens: 5 }
    const commentary = { id: 'msg_commentary', type: 'message', phase: 'commentary', role: 'assistant', content: [{ type: 'output_text', text: 'Let me think.' }] }
    const final = { id: 'msg_final', type: 'message', phase: 'final_answer', role: 'assistant', content: [{ type: 'output_text', text: 'Done.' }] }
    stubFetch(
      streamResponse(
        eventsAsStream([
          { type: 'response.output_item.added', item: commentary },
          { type: 'response.output_text.delta', item_id: 'msg_commentary', delta: 'Let me think.' },
          { type: 'response.output_item.added', item: final },
          { type: 'response.output_text.delta', item_id: 'msg_final', delta: 'Done.' },
          { type: 'response.completed', response: { output: [commentary, final], usage } },
        ]),
      ),
    )
    const heard: string[] = []
    await openAiResponses(BASE_URL, KEY, SOL).send(request({ onDelta: (text) => heard.push(text) }))
    expect(heard).toEqual(['Done.'])
  })

  it('leaves commentary out of the answer and keeps it to send back, with an answer read whole', async () => {
    const usage = { input_tokens: 10, output_tokens: 5 }
    const commentary = { type: 'message', phase: 'commentary', role: 'assistant', content: [{ type: 'output_text', text: 'Let me think.' }] }
    const final = { type: 'message', phase: 'final_answer', role: 'assistant', content: [{ type: 'output_text', text: '{"category":"office"}' }] }
    stubFetch(streamResponse(eventsAsStream([{ type: 'response.completed', response: { output: [commentary, final], usage } }])))
    const reply = await openAiResponses(BASE_URL, KEY, SOL).send(request())
    expect(reply).toMatchObject({ kind: 'answer', text: '{"category":"office"}', raw: [commentary, final] })
  })

  it('reads a refusal with its words', async () => {
    expect(await sendFixture('refusal')).toEqual({ kind: 'refused', reason: 'A made-up refusal', tokens: TOKENS })
  })

  it('reads the length limit as an answer cut off and a content filter as refused, with no usage in either', async () => {
    const none = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }
    expect(await sendFixture('incomplete-max-output')).toEqual({ kind: 'cut-off', tokens: none })
    expect(await sendFixture('incomplete-content-filter')).toEqual({ kind: 'refused', reason: 'content_filter', tokens: none })
  })

  it.each([
    ['a stream cut mid-way', 'cut-midway', 'The stream ended before the answer did.'],
    ['an error event', 'error-event', 'A made-up overload message'],
    ['a failed response', 'failed', 'The model failed to generate a response.'],
    ['a stop reason it does not know', 'incomplete-unknown-reason', 'OpenAI stopped for a reason Kuna does not know: a_made_up_reason'],
  ])('fails on %s', async (_what, fixture, message) => {
    const failure = await sendFixture(fixture)
    expect(failure).toBeInstanceOf(ModelRequestFailed)
    expect(failure).toMatchObject({ message })
  })

  it.each(['response.completed', 'response.incomplete', 'response.failed'])('fails as a failed request on a %s event with no response', async (type) => {
    stubFetch(streamResponse(eventsAsStream([{ type }])))
    await expect(openAiResponses(BASE_URL, KEY, SOL).send(request())).rejects.toBeInstanceOf(ModelRequestFailed)
  })

  it('reports a model the provider refuses in its own words', async () => {
    stubFetch(Response.json({ error: { message: "The model 'made-up' does not exist", code: 'model_not_found' } }, { status: 404 }))
    await expect(openAiResponses(BASE_URL, KEY, SOL).send(request())).rejects.toMatchObject({ status: 404, message: "The model 'made-up' does not exist" })
  })

  it('cuts the key out of what the provider says back', async () => {
    stubFetch(Response.json({ error: { message: `Incorrect key ${KEY}` } }, { status: 401 }))
    await expect(openAiResponses(BASE_URL, KEY, SOL).send(request())).rejects.toMatchObject({ status: 401, message: 'Incorrect key [key]' })
  })

  it('fails with the reason it was aborted for when the abort cuts a stream under way', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', async () => streamCutByAbort(streamFixture('openai/cut-midway').split('event: response.output_text.delta')[0]!, controller.signal))
    const sending = openAiResponses(BASE_URL, KEY, SOL).send(request({ signal: controller.signal }))
    setTimeout(() => controller.abort(new Error('Too slow.')), 10)
    await expect(sending).rejects.toMatchObject({ status: 0, message: 'Too slow.' })
  })
})

describe('a task run over the Responses adapter', () => {
  const ANSWER_SCHEMA: StrictSchema = { type: 'object', properties: { category: { type: 'string', enum: ['office', 'travel'] } }, required: ['category'], additionalProperties: false }
  const task: AiTask<string, { readonly category: string }> = {
    id: 'company.category',
    app: 'company',
    effort: 'medium',
    system: () => [{ kind: 'text', text: 'You pick a category.' }],
    input: (question) => [{ kind: 'text', text: question }],
    output: () => ANSWER_SCHEMA,
    tools: [{ name: 'rule', description: 'Reads one rule by its id.', input: RULE_INPUT, run: async () => ({ text: 'Rule pdv-25.', sources: ['pdv-25'], figures: [] }) }],
    check: (output) => ({ draft: output as { category: string }, problems: [] }),
  }
  const ports = { model: openAiResponses(BASE_URL, KEY, SOL), appOn: true, employees: { sends: false, anonymising: true } }

  it('replays every item of the last reply, encrypted reasoning first, then the tool output, with nothing kept at OpenAI', async () => {
    const requests = stubFetch(streamResponse(streamFixture('openai/tool-round')), streamResponse(streamFixture('openai/answer')))
    const result = await runTask(task, 'Which category?', ports)

    expect(result).toEqual({
      kind: 'draft',
      draft: { category: 'office' },
      problems: [],
      usage: {
        model: 'GPT-6.1 Sol',
        inputTokens: 800,
        cacheReadTokens: 6000,
        cacheWriteTokens: 3600,
        outputTokens: 192,
        dollars: (800 * 2 + 6000 * 0.1 + 3600 * 2.5 + 192 * 10) / 1_000_000,
      },
    })
    expect(requests[1]!.body.store).toBe(false)
    expect(requests[1]!.body.previous_response_id).toBeUndefined()
    expect(requests[1]!.body.input).toEqual([
      { role: 'user', content: [{ type: 'input_text', text: 'Which category?' }] },
      { id: 'rs_made_up', type: 'reasoning', summary: [], encrypted_content: 'made-up-encrypted-AIzaMadeUpMadeUpMadeUpMadeUpMadeUpMadeUpMade' },
      { id: 'srv_made_up', type: 'made_up_server_call', status: 'completed' },
      { id: 'fc_made_up', type: 'function_call', status: 'completed', call_id: 'call_made_up_1', name: 'rule', arguments: '{"id":"pdv-25"}' },
      { type: 'function_call_output', call_id: 'call_made_up_1', output: 'Rule pdv-25.' },
    ])
  })

  it('gives an answer off the schema as a failure with the usage', async () => {
    stubFetch(streamResponse(streamFixture('openai/off-schema')))
    expect(await runTask(task, 'Which category?', ports)).toMatchObject({ kind: 'failed', reason: 'category is not one of the allowed values', usage: { inputTokens: 400 } })
  })
})
