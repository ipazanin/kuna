import type { ModelPort, ModelReply, ModelRequest } from '../../application/modelPort'
import type { KeyTest, ModelChoice } from '../providerPresets'

/**
 * How the fake model answers, as `?ai=` names it: `ok` with a good answer, `refused` with a refusal, `cut-off` at the
 * length limit, and `invented-figure` with an answer that holds an amount Kuna did not send. Without it, `ok`.
 */
export type FakeAiVariant = 'ok' | 'refused' | 'cut-off' | 'invented-figure'

/** The fake build's answer to one task: the JSON its answer holds, built from the request, or another reply for a variant. */
export type FakeAnswer = (request: ModelRequest, variant: FakeAiVariant) => unknown

const answers = new Map<string, FakeAnswer>()

/** Lets an app's fake seed say how the fake model answers one of its tasks. */
export function registerFakeAnswer(taskId: string, answer: FakeAnswer): void {
  answers.set(taskId, answer)
}

export function fakeAiVariant(): FakeAiVariant {
  const variant = new URLSearchParams(window.location.search).get('ai')
  return variant === 'refused' || variant === 'cut-off' || variant === 'invented-figure' ? variant : 'ok'
}

const TOKENS = { input: 4812, output: 1190 }

/** The fake build's model for one task, which never leaves the page. It answers after a short pause, as a real one would. */
export function fakeModelPort(taskId: string, model: ModelChoice): ModelPort {
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
      const answer = answers.get(taskId)
      if (answer === undefined) {
        throw new Error(`The fake model has no answer for ${taskId}.`)
      }
      return { kind: 'answer', text: JSON.stringify(answer(request, variant)), tokens: TOKENS }
    },
  }
}

/** The fake build's Test of a key, which takes any key. */
export async function fakeKeyTest(): Promise<KeyTest> {
  return { kind: 'works' }
}
