import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

const OPERATIONS_FILE = 'src/apps/planted/assistant/operations/plantedOperations.ts'

const KEPT_BESIDE = `export function plantedWork(): object {
  let last = 0
  return { plan: () => (last = 1), card: () => last }
}
`

const RETURNED = `export function plantedWork(): object {
  return { plan: () => 1, card: (_checked: unknown, _books: unknown, plan: number) => plan }
}
`

const TYPED_REASONS = `export const typed = { kind: 'refused', reason: 'The file changed since.' }
export const templated = (name: string) => ({ kind: 'refused', reason: \`\${name} changed since.\` })
`

const WORDED_REASONS = `declare const words: { changed: string; running: string; note: string }
export const worded = { kind: 'refused', reason: words.changed }
export const joined = { kind: 'refused', reason: \`\${words.running}. \${words.note}\` }
`

describe("the lint rules on an app's chat operations", { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const rulesBroken = async (code: string) => {
    const [result] = await eslint.lintText(code, { filePath: join(root, OPERATIONS_FILE) })
    return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]))
  }

  it('refuse a value kept beside the proposal work, and leave a work that hands its plan to the card alone', async () => {
    expect(await rulesBroken(KEPT_BESIDE)).toContain('kuna/proposal-work')
    expect(await rulesBroken(RETURNED)).not.toContain('kuna/proposal-work')
  })

  it("refuse a card's reason typed as a sentence, and leave one built from words alone", async () => {
    expect((await rulesBroken(TYPED_REASONS)).filter((rule) => rule === 'kuna/card-reasons')).toHaveLength(2)
    expect(await rulesBroken(WORDED_REASONS)).not.toContain('kuna/card-reasons')
  })
})
