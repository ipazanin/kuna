import type { ModelPort, ModelReply } from '../../application/modelPort'
import type { KeyTest, ModelChoice, ProviderPreset } from '../../domain/providerPresets'
import { fakeChatReply } from './fakeChatReply'

/**
 * How the fake model answers, as `?ai=` names it: `ok` with a good answer, `refused` with a refusal, `cut-off` at the
 * length limit, `invented-figure` with an answer that holds an amount Kuna did not send, and `key-refused` turning away
 * every key on a Test. Without it, `ok`.
 */
export type FakeAiVariant = 'ok' | 'refused' | 'cut-off' | 'invented-figure' | 'key-refused'

export function fakeAiVariant(): FakeAiVariant {
  const variant = new URLSearchParams(window.location.search).get('ai')
  return variant === 'refused' || variant === 'cut-off' || variant === 'invented-figure' || variant === 'key-refused' ? variant : 'ok'
}

const TOKENS = { input: 812, cacheRead: 3400, cacheWrite: 600, output: 1190 }

/** The fake build's model for the chat, which never leaves the page. It answers after a short pause, as a real one would. */
export function fakeModelPort(model: ModelChoice): ModelPort {
  return {
    model,
    readsPdf: true,
    async send(request): Promise<ModelReply> {
      await new Promise((resolve) => setTimeout(resolve, 300))
      const variant = fakeAiVariant()
      if (variant === 'refused') {
        return { kind: 'refused', reason: 'The request looks like it asks for something the model does not do.', tokens: TOKENS }
      }
      if (variant === 'cut-off') {
        return { kind: 'cut-off', tokens: TOKENS }
      }
      return fakeChatReply(request, TOKENS, variant === 'invented-figure')
    },
  }
}

/** The fake build's Test of a key, which takes any key unless told otherwise and, as Anthropic's does, turns away a model no preset lists. */
export async function fakeKeyTest(preset: ProviderPreset, model: ModelChoice): Promise<KeyTest> {
  if (fakeAiVariant() === 'key-refused') return { kind: 'refused' }
  return preset.models.some((listed) => listed.id === model.id) ? { kind: 'works' } : { kind: 'failed', reason: `model: ${model.id}` }
}
