import { guardedModel } from './egressGuard'
import type { ModelPort } from './modelPort'
import { storedSecret, storedSecretChanges } from '../../secrets/infrastructure/browserSecrets'
import { modelOf } from './assistSettings'
import type { KeyTest, ProviderId, ProviderPreset } from '../domain/providerPresets'

/** The one place in the AI module that reads a key: it hands an adapter its key, and everything else only learns whether one is kept. */
export function keyKept(id: ProviderId): boolean {
  return storedSecret(id) !== null
}

/** The guarded model for the provider's key and chosen model, the fake one in the fake build, or null without a key. */
export async function modelPort(preset: ProviderPreset): Promise<ModelPort | null> {
  const key = storedSecret(preset.id)
  if (key === null) {
    return null
  }
  return guardedModel(await adapterOf(preset, key), keptSecrets)
}

async function adapterOf(preset: ProviderPreset, key: string): Promise<ModelPort> {
  const model = modelOf(preset.id)
  // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeModelPort } = await import('../infrastructure/fake/fakeModel')
    return fakeModelPort(model)
  }
  switch (preset.adapter) {
    case 'anthropic-messages': {
      const { anthropicMessages } = await import('../infrastructure/anthropicMessages')
      return anthropicMessages(key, model)
    }
    case 'openai-responses': {
      const { openAiResponses } = await import('../infrastructure/openAiResponses')
      return openAiResponses(preset.baseUrl, key, model)
    }
    case 'openrouter-chat': {
      const { openRouterChat } = await import('../infrastructure/openRouterChat')
      return openRouterChat(preset.baseUrl, key, model)
    }
  }
}

/** One cheap request with the provider's key that sends nothing from the books. The fake build takes any key. */
export async function testProviderKey(preset: ProviderPreset, key: string): Promise<KeyTest> {
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeKeyTest } = await import('../infrastructure/fake/fakeModel')
    return fakeKeyTest(preset, modelOf(preset.id))
  }
  if (preset.keyTestUrl === null) {
    const { testAnthropicKey } = await import('../infrastructure/anthropicMessages')
    return testAnthropicKey(key, modelOf(preset.id).id)
  }
  const { bearerHeaders, keyTestOf } = await import('../infrastructure/providerFetch')
  return keyTestOf({ address: preset.keyTestUrl, method: 'GET', headers: bearerHeaders(key), key })
}

/** Every secret kept in this browser, read at each send, so a key saved a moment ago counts. */
function keptSecrets(): readonly string[] {
  return Object.values(storedSecretChanges()).flatMap((change) => (change.key === null ? [] : [change.key]))
}
