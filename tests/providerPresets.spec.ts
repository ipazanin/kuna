import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { PROVIDER_PRESETS, modelChoice, presetOf, turnsOnWebSearch } from '../src/shared/ai/domain/providerPresets'
import { PRICE_VENDORS } from '../src/apps/investments/prices/infrastructure/vendors/priceVendors'

describe('the AI providers', () => {
  it("lets the page reach every provider's origin, which the CSP of index.html lists", () => {
    const policy = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    const connect = /connect-src ([^;]*);/.exec(policy)?.[1]?.split(' ') ?? []
    for (const preset of PROVIDER_PRESETS) {
      expect(connect).toContain(new URL(preset.baseUrl).origin)
    }
  })

  it('defaults each provider to a model of its own list, Sonnet 5.5 on Anthropic and GPT-6.1 Sol on OpenAI', () => {
    for (const preset of PROVIDER_PRESETS) {
      expect(preset.models.map((model) => model.id)).toContain(preset.defaultModel)
    }
    expect(presetOf('anthropic').defaultModel).toBe('claude-sonnet-5-5')
    expect(presetOf('openai').defaultModel).toBe('gpt-6.1-sol')
  })

  it('takes a listed model with its price, a typed one with none, and the default for no model at all', () => {
    expect(modelChoice(presetOf('anthropic'), 'claude-opus-5-5')).toMatchObject({ name: 'Opus 5.5', price: { inputPerMillion: 4 } })
    expect(modelChoice(presetOf('anthropic'), 'claude-made-up-model')).toEqual({ id: 'claude-made-up-model', name: 'claude-made-up-model', price: null })
    expect(modelChoice(presetOf('anthropic'), null).id).toBe('claude-sonnet-5-5')
  })

  it.each(['anthropic/claude-sonnet-5-5:online', 'made-up/model:online:free', ' made-up/model:ONLINE '])('refuses %s, whose id turns on web search, and runs the default instead', (id) => {
    expect(turnsOnWebSearch(id)).toBe(true)
    expect(modelChoice(presetOf('openrouter'), id).id).toBe('anthropic/claude-sonnet-5-5')
  })

  it('leaves an id alone that only looks like it', () => {
    expect(turnsOnWebSearch('made-up/online-model')).toBe(false)
    expect(modelChoice(presetOf('openrouter'), 'made-up/online-model').id).toBe('made-up/online-model')
  })

  it('keeps the provider ids apart from the price vendor ids, since both name keys in one secrets file', () => {
    const vendors = new Set(PRICE_VENDORS.map((vendor) => vendor.id))
    expect(PROVIDER_PRESETS.filter((preset) => vendors.has(preset.id))).toEqual([])
  })

  it('tests an OpenRouter key against the key itself, since its list of models answers any key, and each test address is one the CSP allows', () => {
    expect(presetOf('openrouter').keyTestUrl).toBe('https://openrouter.ai/api/v1/key')
    for (const preset of PROVIDER_PRESETS) {
      if (preset.keyTestUrl !== null) expect(new URL(preset.keyTestUrl).origin).toBe(new URL(preset.baseUrl).origin)
    }
  })

  it('offers no model that searches the web', () => {
    expect(PROVIDER_PRESETS.flatMap((preset) => preset.models).filter((model) => /online|search/.test(model.id))).toEqual([])
  })
})
