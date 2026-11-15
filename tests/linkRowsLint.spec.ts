import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

describe('the lint rule that keeps a row that opens a page on ProposalRow', { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const rulesBroken = async (template: string) => {
    const [result] = await eslint.lintText(`<template>\n  ${template}\n</template>\n`, { filePath: join(root, 'src/apps/planted/presentation/PlantedRows.vue') })
    return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]))
  }

  it('refuses an arrow drawn by hand inside a link, written plain or bound', async () => {
    expect(await rulesBroken('<RouterLink to="/a"><span>A</span><UIcon name="i-lucide-chevron-right" /></RouterLink>')).toContain('kuna/link-rows')
    expect(await rulesBroken('<router-link to="/a"><span><UIcon :name="\'i-lucide-chevron-right\'" /></span></router-link>')).toContain('kuna/link-rows')
  })

  it('leaves a disclosure chevron in a button and a ProposalRow that opens a page alone', async () => {
    expect(await rulesBroken('<button type="button"><UIcon name="i-lucide-chevron-right" /></button>')).not.toContain('kuna/link-rows')
    expect(await rulesBroken('<ProposalRow to="/a" title="A" />')).not.toContain('kuna/link-rows')
  })
})
