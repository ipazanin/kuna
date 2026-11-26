import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

describe('the lint rule that keeps a source handover warning on SourceHandoverAlert', { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const rulesBroken = async (template: string, file = 'src/apps/planted/presentation/PlantedDialog.vue') => {
    const [result] = await eslint.lintText(`<template>\n  ${template}\n</template>\n`, { filePath: join(root, file) })
    return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]))
  }

  it('refuses an alert with a handover test id, written plain or bound', async () => {
    expect(await rulesBroken('<UAlert color="warning" title="a" data-testid="planted-account-handover" />')).toContain('kuna/handover-alerts')
    expect(await rulesBroken(`<UAlert color="warning" title="a" :data-testid="'planted-handover'" />`)).toContain('kuna/handover-alerts')
    expect(await rulesBroken('<u-alert color="warning" title="a" data-testid="account-handover" />')).toContain('kuna/handover-alerts')
  })

  it('leaves another alert, SourceHandoverAlert and the shared component itself alone', async () => {
    expect(await rulesBroken('<UAlert color="warning" title="a" data-testid="planted-account-cutover" />')).not.toContain('kuna/handover-alerts')
    expect(await rulesBroken('<SourceHandoverAlert :handover="a" data-testid="planted-account-handover" />')).not.toContain('kuna/handover-alerts')
    expect(await rulesBroken('<UAlert color="warning" title="a" data-testid="account-handover" />', 'src/shared/ui/SourceHandoverAlert.vue')).not.toContain('kuna/handover-alerts')
  })
})
