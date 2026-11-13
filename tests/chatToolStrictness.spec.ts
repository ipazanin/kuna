import { afterEach, describe, expect, it, vi } from 'vitest'

import { CHAT_TOOLS } from '../src/shared/ai/application/chatTools'
import type { ModelPort, ModelTool } from '../src/shared/ai/application/modelPort'
import { PROVIDER_PRESETS, presetOf } from '../src/shared/ai/domain/providerPresets'
import { anthropicMessages } from '../src/shared/ai/infrastructure/anthropicMessages'
import { openAiResponses } from '../src/shared/ai/infrastructure/openAiResponses'
import { openRouterChat } from '../src/shared/ai/infrastructure/openRouterChat'

type Schema = Readonly<Record<string, unknown>>

afterEach(() => {
  vi.unstubAllGlobals()
})

/** What an adapter sends with the chat's tools or others, caught before it leaves and answered with an error. */
async function sentRequest(port: ModelPort, tools: readonly ModelTool[]): Promise<{ readonly headers: Readonly<Record<string, string>>; readonly body: Readonly<Record<string, unknown>> }> {
  const requests: { readonly headers: Readonly<Record<string, string>>; readonly body: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', async (_address: string, init: RequestInit) => {
    requests.push({ headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) as Record<string, unknown> })
    return Response.json({ error: { message: 'Not sent anywhere.' } }, { status: 400 })
  })
  await expect(port.send({ system: [], turns: [{ role: 'user', parts: [{ kind: 'text', text: 'Hi' }] }], tools, effort: 'low' })).rejects.toThrow()
  return requests[0]!
}

/** Each tool's schema as the adapter wrote it into its body, with whether it asked for strict mode. */
type SentTool = { readonly name: string; readonly strict: unknown; readonly schema: Schema }

const ADAPTERS: readonly { readonly provider: string; readonly tools: (tools?: readonly ModelTool[]) => Promise<readonly SentTool[]> }[] = [
  {
    provider: 'anthropic',
    tools: async (tools = CHAT_TOOLS) =>
      ((await sentRequest(anthropicMessages('made-up-key', presetOf('anthropic').models[0]!), tools)).body.tools as Schema[]).map((tool) => ({
        name: String(tool['name']),
        strict: tool['strict'],
        schema: tool['input_schema'] as Schema,
      })),
  },
  {
    provider: 'openai',
    tools: async (tools = CHAT_TOOLS) =>
      ((await sentRequest(openAiResponses(presetOf('openai').baseUrl, 'made-up-key', presetOf('openai').models[0]!), tools)).body.tools as Schema[]).map((tool) => ({
        name: String(tool['name']),
        strict: tool['strict'],
        schema: tool['parameters'] as Schema,
      })),
  },
  {
    provider: 'openrouter',
    tools: async (tools = CHAT_TOOLS) =>
      ((await sentRequest(openRouterChat(presetOf('openrouter').baseUrl, 'made-up-key', presetOf('openrouter').models[0]!), tools)).body.tools as Schema[]).map((tool) => {
        const called = tool['function'] as Schema
        return { name: String(called['name']), strict: called['strict'], schema: called['parameters'] as Schema }
      }),
  },
]

/** Every schema in a tree, each with how many objects deep it sits, the root object counting as one. */
function nodesOf(schema: Schema, depth = schema['type'] === 'object' ? 1 : 0): readonly { readonly node: Schema; readonly depth: number }[] {
  const below = [
    ...Object.values((schema['properties'] ?? {}) as Readonly<Record<string, Schema>>),
    ...(schema['items'] === undefined ? [] : [schema['items'] as Schema]),
    ...((schema['anyOf'] ?? []) as Schema[]),
  ]
  return [{ node: schema, depth }, ...below.flatMap((child) => nodesOf(child, child['type'] === 'object' ? depth + 1 : depth))]
}

const isUnion = (node: Schema): boolean => Array.isArray(node['type']) || node['anyOf'] !== undefined

/**
 * What strict mode takes in one schema, in the rules both companies state for it. Each object sets additionalProperties
 * to false and lists every property as required. A field that may be null is a type list of one type and null. Enums
 * hold strings, numbers, booleans or null. No keyword outside the subset both support, and none OpenAI refuses.
 */
function schemaProblems(schema: Schema): readonly string[] {
  const keywords = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'description'])
  const refusedByOpenAi = new Set(['allOf', 'not', 'dependentRequired', 'dependentSchemas', 'if', 'then', 'else'])
  if (schema['type'] !== 'object' || schema['anyOf'] !== undefined) return ['the root is not an object']
  return nodesOf(schema).flatMap(({ node }) => {
    const problems: string[] = []
    for (const keyword of Object.keys(node)) {
      if (!keywords.has(keyword) || refusedByOpenAi.has(keyword)) problems.push(`${keyword} is outside the strict subset`)
    }
    if (node['type'] === 'object') {
      if (node['additionalProperties'] !== false) problems.push('an object allows more properties')
      const properties = Object.keys(node['properties'] as Schema)
      const required = node['required'] as readonly string[]
      if (properties.length !== required.length || properties.some((property) => !required.includes(property)))
        problems.push(`an object leaves ${properties.filter((property) => !required.includes(property)).join(', ')} optional`)
    }
    if (Array.isArray(node['type'])) {
      const types = node['type'] as readonly string[]
      if (types.length !== 2 || !types.includes('null')) problems.push(`a type list ${types.join(', ')} is not one type and null`)
    }
    const values = (node['enum'] ?? []) as readonly unknown[]
    if (values.some((value) => value !== null && !['string', 'number', 'boolean'].includes(typeof value))) problems.push('an enum holds a value that is not a string, a number, a boolean or null')
    return problems
  })
}

/** What OpenAI's strict mode caps in one schema: 10 levels of objects, 5000 properties, 1000 enum values, and 120,000 characters of property names and enum values. */
function openAiCaps(schema: Schema): { readonly depth: number; readonly properties: number; readonly enumValues: number; readonly characters: number } {
  const nodes = nodesOf(schema)
  const names = nodes.flatMap(({ node }) => Object.keys((node['properties'] ?? {}) as Schema))
  const values = nodes.flatMap(({ node }) => ((node['enum'] ?? []) as readonly unknown[]).map((value) => String(value)))
  return {
    depth: Math.max(...nodes.map(({ depth }) => depth)),
    properties: names.length,
    enumValues: values.length,
    characters: [...names, ...values].reduce((total, text) => total + text.length, 0),
  }
}

/**
 * What Anthropic says grows the grammar it compiles from a request's strict tools, counted across all of them: the tools,
 * the optional parameters and the parameters with a type list or anyOf, each with a stated cap, and the objects nested
 * below a tool's input, its properties and its enum values, which have none.
 */
type GrammarDrivers = Readonly<Record<'tools' | 'optional' | 'unions' | 'nestedObjects' | 'properties' | 'enumValues', number>>

function grammarDrivers(sent: readonly SentTool[]): GrammarDrivers {
  const strict = sent.filter((tool) => tool.strict === true)
  const nodes = strict.flatMap(({ schema }) => nodesOf(schema))
  const objects = nodes.filter(({ node }) => node['type'] === 'object')
  const properties = objects.flatMap(({ node }) => Object.keys(node['properties'] as Schema).map((property) => ({ property, required: node['required'] as readonly string[] })))
  return {
    tools: strict.length,
    optional: properties.filter(({ property, required }) => !required.includes(property)).length,
    unions: nodes.filter(({ node }) => isUnion(node)).length,
    nestedObjects: objects.filter(({ depth }) => depth > 1).length,
    properties: properties.length,
    enumValues: nodes.reduce((total, { node }) => total + ((node['enum'] ?? []) as readonly unknown[]).length, 0),
  }
}

/**
 * Anthropic refused the nine tools sent strict, which held 9 tools, 13 unions, 6 nested objects, 52 properties and 10
 * enum values with none optional, as the grammar they compiled to was too large, though each stated cap held. It names no
 * figure for that limit, so each driver gets a third of what the refused request held.
 */
const GRAMMAR_BUDGET: GrammarDrivers = { tools: 3, optional: 0, unions: 4, nestedObjects: 2, properties: 17, enumValues: 3 }

/** The drivers a request holds more of than the budget allows. */
function overBudget(drivers: GrammarDrivers): readonly string[] {
  return Object.entries(GRAMMAR_BUDGET)
    .filter(([driver, most]) => drivers[driver as keyof GrammarDrivers] > most)
    .map(([driver]) => driver)
}

describe('the chat’s tools in each AI company’s strict mode', () => {
  it('has an adapter for every provider Kuna offers', () => {
    expect(ADAPTERS.map((adapter) => adapter.provider)).toEqual(PROVIDER_PRESETS.map((preset) => preset.id))
  })

  it('makes strict only the tool whose input becomes a change', () => {
    expect(CHAT_TOOLS.filter((tool) => tool.strict).map((tool) => tool.name)).toEqual(['propose_changes'])
  })

  it.each(ADAPTERS)('sends each tool strict or not as it says, in the subset both companies take: $provider', async ({ tools }) => {
    const sent = await tools()
    // OpenAI's Responses makes a tool strict when it can unless the request says false, so each tool says which.
    expect(sent.map((tool) => [tool.name, tool.strict])).toEqual(CHAT_TOOLS.map((tool) => [tool.name, tool.strict]))
    expect(Object.fromEntries(sent.map((tool) => [tool.name, schemaProblems(tool.schema)]))).toEqual(Object.fromEntries(sent.map((tool) => [tool.name, []])))
  })

  it.each(ADAPTERS)('keeps each schema inside what OpenAI caps, which OpenRouter may route to: $provider', async ({ tools }) => {
    for (const { schema } of await tools()) {
      const caps = openAiCaps(schema)
      expect(caps.depth).toBeLessThanOrEqual(10)
      expect(caps.properties).toBeLessThanOrEqual(5000)
      expect(caps.enumValues).toBeLessThanOrEqual(1000)
      expect(caps.characters).toBeLessThanOrEqual(120_000)
    }
  })

  it.each(ADAPTERS)('keeps a request inside what Anthropic caps, which OpenRouter may route to: $provider', async ({ tools }) => {
    const drivers = grammarDrivers(await tools())
    expect(drivers.tools).toBeLessThanOrEqual(20)
    expect(drivers.optional).toBeLessThanOrEqual(24)
    expect(drivers.unions).toBeLessThanOrEqual(16)
  })

  it.each(ADAPTERS)('keeps the strict tools of a request well under the grammar Anthropic refused: $provider', async ({ tools }) => {
    expect(overBudget(grammarDrivers(await tools()))).toEqual([])
  })

  // OpenRouter strips strict from a Claude model's tools without Anthropic's beta header, and the header means nothing to another company's model.
  it.each(presetOf('openrouter').models)('asks OpenRouter for strict tools exactly when $id gets one and is a Claude model', async (model) => {
    const headerWith = async (tools: readonly ModelTool[]): Promise<string | undefined> =>
      (await sentRequest(openRouterChat(presetOf('openrouter').baseUrl, 'made-up-key', model), tools)).headers['x-anthropic-beta']
    expect(await headerWith(CHAT_TOOLS)).toBe(model.id.startsWith('anthropic/') ? 'structured-outputs-2025-11-13' : undefined)
    expect(await headerWith(CHAT_TOOLS.map((tool) => ({ ...tool, strict: false })))).toBeUndefined()
  })

  it('would have stopped the request Anthropic refused, with every tool strict', async () => {
    const refused = grammarDrivers(await ADAPTERS[0]!.tools(CHAT_TOOLS.map((tool) => ({ ...tool, strict: true }))))
    expect(overBudget(refused)).toEqual(['tools', 'unions', 'nestedObjects', 'properties', 'enumValues'])
  })
})
