import type { ModelPort, ModelRequest } from './modelPort'

/** The shapes of Google's and the AI providers' keys, all starting `sk-` but Google's, each with a long tail so a sentence that names a prefix passes. */
const KEY_SHAPE = /(?<![A-Za-z0-9])(?:(?:sk-|ya29\.)[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{35})/

/** A stored value shorter than this is no key, and matching it would refuse nearly every request. */
const SHORTEST_SECRET = 8

/** A request held a stored secret or something shaped like a key. It deliberately does not say which. */
export class SecretInRequest extends Error {
  constructor() {
    super('A request holds a key or a token, so Kuna did not send it.')
    this.name = 'SecretInRequest'
  }
}

/**
 * The model behind a check of every request before it can leave the page. It reads what this page sends and nothing a
 * provider does on its own side, so a search the provider runs needs its own rule.
 */
export function guardedModel(model: ModelPort, secrets: () => readonly string[]): ModelPort {
  return {
    ...model,
    send: async (request) => {
      if (holdsSecret(model.model.name, request, secrets())) {
        throw new SecretInRequest()
      }
      return model.send(request)
    },
  }
}

function holdsSecret(modelName: string, request: ModelRequest, secrets: readonly string[]): boolean {
  const whole = JSON.stringify([modelName, request.system, request.turns, request.output, request.tools])
  return secrets.some((secret) => secret.length >= SHORTEST_SECRET && whole.includes(secret)) || readableText(modelName, request).some((text) => KEY_SHAPE.test(text))
}

/**
 * The text a shape is looked for in. A document's base64, a thinking signature and encrypted reasoning are left out,
 * as long opaque strings match these shapes by chance and would then refuse every later request of a run.
 */
function readableText(modelName: string, request: ModelRequest): readonly string[] {
  return [
    modelName,
    ...request.system.map((part) => part.text),
    JSON.stringify([request.output, request.tools]),
    ...request.turns.flatMap((turn) => {
      switch (turn.role) {
        case 'user':
          return turn.parts.flatMap((part) => (part.kind === 'text' ? [part.text] : []))
        case 'tool-results':
          return turn.results.map((result) => result.text)
        case 'assistant':
          return []
      }
    }),
  ]
}
