import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

describe("the lint rule that words Spending's write refusals in the person's language", { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const rulesBroken = async (file: string, source: string) => {
    const [result] = await eslint.lintText(source, { filePath: join(root, file) })
    return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]))
  }

  it("refuses a refusal written as a string or a template in Spending's writes", async () => {
    expect(await rulesBroken('src/apps/spending/planted/application/plantedWrites.ts', "export function planted(): void {\n  throw new Error('A planted refusal.')\n}\n")).toContain(
      'kuna/worded-refusals',
    )
    expect(await rulesBroken('src/apps/spending/planted/application/plantedWrites.ts', 'export function planted(name: string): void {\n  throw new Error(`${name} is planted.`)\n}\n')).toContain(
      'kuna/worded-refusals',
    )
  })

  it('lets a refusal read from words, and leaves other files alone', async () => {
    expect(
      await rulesBroken(
        'src/apps/spending/planted/application/plantedWrites.ts',
        "import { words } from '../domain/words'\n\nexport function planted(): void {\n  throw new Error(words.planted)\n}\n",
      ),
    ).not.toContain('kuna/worded-refusals')
    expect(await rulesBroken('src/apps/spending/planted/application/plantedFlow.ts', "export function planted(): void {\n  throw new Error('A planted refusal.')\n}\n")).not.toContain(
      'kuna/worded-refusals',
    )
  })
})
