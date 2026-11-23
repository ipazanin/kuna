import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

describe('the lint rule that keeps clearing a select on OptionalSelect', { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const rulesBroken = async (template: string, file = 'src/apps/planted/presentation/PlantedField.vue') => {
    const [result] = await eslint.lintText(`<template>\n  ${template}\n</template>\n`, { filePath: join(root, file) })
    return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]))
  }

  it('refuses a clear button on a select, written plain or bound', async () => {
    expect(await rulesBroken('<USelect v-model="a" :items="b" clear />')).toContain('kuna/optional-selects')
    expect(await rulesBroken('<USelectMenu v-model="a" :items="b" :clear="true" />')).toContain('kuna/optional-selects')
    expect(await rulesBroken('<u-select-menu v-model="a" :items="b" clear />')).toContain('kuna/optional-selects')
  })

  it('leaves a select with no clear button and OptionalSelect itself alone', async () => {
    expect(await rulesBroken('<USelectMenu v-model="a" :items="b" />')).not.toContain('kuna/optional-selects')
    expect(await rulesBroken('<OptionalSelect v-model="a" :items="b" none="Not set" :search="false" />')).not.toContain('kuna/optional-selects')
    expect(await rulesBroken('<USelectMenu v-model="a" :items="b" :clear="{}" />', 'src/shared/ui/OptionalSelect.vue')).not.toContain('kuna/optional-selects')
  })
})
