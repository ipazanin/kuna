import { afterEach, describe, expect, it, vi } from 'vitest'

import { CHAT_TOOLS } from '../src/shared/ai/application/chatTools'
import type { ModelPort } from '../src/shared/ai/application/modelPort'
import { PROVIDER_PRESETS, presetOf } from '../src/shared/ai/domain/providerPresets'
import { anthropicMessages } from '../src/shared/ai/infrastructure/anthropicMessages'
import { openAiResponses } from '../src/shared/ai/infrastructure/openAiResponses'
import { openRouterChat } from '../src/shared/ai/infrastructure/openRouterChat'

type Schema = Readonly<Record<string, unknown>>

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The body each adapter sends with every chat tool, caught before it leaves and answered with an error. */
async function sentBody(port: ModelPort): Promise<Readonly<Record<string, unknown>>> {
  const bodies: Record<string, unknown>[] = []
  vi.stubGlobal('fetch', async (_address: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
    return Response.json({ error: { message: 'Not sent anywhere.' } }, { status: 400 })
  })
  await expect(port.send({ system: [], turns: [{ role: 'user', parts: [{ kind: 'text', text: 'Hi' }] }], tools: CHAT_TOOLS, effort: 'low' })).rejects.toThrow()
  return bodies[0]!
}

/** Each tool's schema as the adapter wrote it into its body, with whether it asked for strict mode. */
type SentTool = { readonly name: string; readonly strict: unknown; readonly schema: Schema }

const ADAPTERS: readonly { readonly provider: string; readonly tools: () => Promise<readonly SentTool[]> }[] = [
  {
    provider: 'anthropic',
    tools: async () =>
      ((await sentBody(anthropicMessages('made-up-key', presetOf('anthropic').models[0]!))).tools as Schema[]).map((tool) => ({
        name: String(tool['name']),
        strict: tool['strict'],
        schema: tool['input_schema'] as Schema,
      })),
  },
  {
    provider: 'openai',
    tools: async () =>
      ((await sentBody(openAiResponses(presetOf('openai').baseUrl, 'made-up-key', presetOf('openai').models[0]!))).tools as Schema[]).map((tool) => ({
        name: String(tool['name']),
        strict: tool['strict'],
        schema: tool['parameters'] as Schema,
      })),
  },
  {
    provider: 'openrouter',
    tools: async () =>
      ((await sentBody(openRouterChat(presetOf('openrouter').baseUrl, 'made-up-key', presetOf('openrouter').models[0]!))).tools as Schema[]).map((tool) => {
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

describe('the chat’s tools in each AI company’s strict mode', () => {
  it('has an adapter for every provider Kuna offers', () => {
    expect(ADAPTERS.map((adapter) => adapter.provider)).toEqual(PROVIDER_PRESETS.map((preset) => preset.id))
  })

  it.each(ADAPTERS)('sends every tool strict, in the subset both companies take: $provider', async ({ tools }) => {
    const sent = await tools()
    expect(sent.map((tool) => tool.name)).toEqual(CHAT_TOOLS.map((tool) => tool.name))
    expect(sent.filter((tool) => tool.strict !== true).map((tool) => tool.name)).toEqual([])
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
    const sent = await tools()
    const nodes = sent.flatMap(({ schema }) => nodesOf(schema).map(({ node }) => node))
    const optional = nodes
      .filter((node) => node['type'] === 'object')
      .flatMap((node) => Object.keys(node['properties'] as Schema).filter((property) => !(node['required'] as readonly string[]).includes(property)))
    expect(sent.length).toBeLessThanOrEqual(20)
    expect(optional.length).toBeLessThanOrEqual(24)
    // A nullable field is a union, and a request takes 16 across its strict tools.
    expect(nodes.filter(isUnion).length).toBeLessThanOrEqual(16)
  })
})
