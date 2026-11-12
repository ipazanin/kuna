import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

describe('the lint rule that keeps local storage behind the helper', { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const rulesBroken = async (file: string) => {
    const [result] = await eslint.lintText("export const kept = (): string | null => localStorage.getItem('kuna.planted')\n", { filePath: join(root, file) })
    return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]))
  }

  it('refuses local storage outside the helper, and leaves the helper alone', async () => {
    expect(await rulesBroken('src/shared/planted/planted.ts')).toContain('kuna/device-storage')
    expect(await rulesBroken('src/shared/device/deviceChoice.ts')).not.toContain('kuna/device-storage')
  })
})
