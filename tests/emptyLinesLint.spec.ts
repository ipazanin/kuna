import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

describe('the lint rule that keeps an empty list in a card on EmptyState with line', { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const rulesBroken = async (template: string) => {
    const [result] = await eslint.lintText(`<template>\n  ${template}\n</template>\n`, { filePath: join(root, 'src/apps/planted/presentation/PlantedCard.vue') })
    return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]))
  }

  it('refuses a hand-built line in a card on an empty list or set', async () => {
    expect(await rulesBroken('<AppCard title="a"><p v-if="rows.length === 0" class="px-5 py-8 type-aside">none</p><ul v-else /></AppCard>')).toContain('kuna/empty-lines')
    expect(await rulesBroken('<AppCard title="a"><ul v-if="a" /><p v-else-if="kept.size === 0" class="type-aside">none</p></AppCard>')).toContain('kuna/empty-lines')
    expect(await rulesBroken('<AppCard title="a"><p v-if="rows.length === 0 && other.length === 0" class="type-aside">none</p></AppCard>')).toContain('kuna/empty-lines')
  })

  it('refuses a hand-built line one wrapper down, in a div or a template of the card', async () => {
    expect(await rulesBroken('<AppCard title="a"><div class="px-4"><p v-if="rows.length === 0" class="type-aside">none</p><ul v-else /></div></AppCard>')).toContain('kuna/empty-lines')
    expect(await rulesBroken('<AppCard title="a"><template v-if="ready"><p v-if="rows.length === 0" class="type-aside">none</p></template></AppCard>')).toContain('kuna/empty-lines')
  })

  it('refuses a v-else line after a list shown while it has rows', async () => {
    expect(await rulesBroken('<AppCard title="a"><ul v-if="rows.length > 0"><li /></ul><p v-else class="type-aside">none</p></AppCard>')).toContain('kuna/empty-lines')
    expect(await rulesBroken('<AppCard title="a"><div><FactGrid v-if="facts.length > 0" /><p v-else class="type-body">none</p></div></AppCard>')).toContain('kuna/empty-lines')
  })

  it('refuses a line on a negated length', async () => {
    expect(await rulesBroken('<AppCard title="a"><p v-if="!rows.length" class="type-aside">none</p></AppCard>')).toContain('kuna/empty-lines')
    expect(await rulesBroken('<AppCard title="a"><div><p v-if="!kept.size" class="type-aside">none</p></div></AppCard>')).toContain('kuna/empty-lines')
  })

  it('leaves EmptyState with line, a line outside a card and a line inside a section of a card alone', async () => {
    expect(await rulesBroken('<AppCard title="a"><EmptyState v-if="rows.length === 0" line title="none" /></AppCard>')).not.toContain('kuna/empty-lines')
    expect(await rulesBroken('<p v-if="rows.length === 0" class="type-aside">none</p>')).not.toContain('kuna/empty-lines')
    expect(await rulesBroken('<AppCard title="a"><section><h3>b</h3><p v-if="rows.length === 0" class="type-aside">none</p></section></AppCard>')).not.toContain('kuna/empty-lines')
    expect(await rulesBroken('<AppCard title="a"><p v-if="rows.length > 0" class="type-caption">some</p></AppCard>')).not.toContain('kuna/empty-lines')
    expect(await rulesBroken('<AppCard title="a"><div><section><p v-if="!rows.length" class="type-aside">none</p></section></div></AppCard>')).not.toContain('kuna/empty-lines')
    expect(await rulesBroken('<AppCard title="a"><section><ul v-if="rows.length > 0" /><p v-else class="type-aside">none</p></section></AppCard>')).not.toContain('kuna/empty-lines')
    expect(await rulesBroken('<AppCard title="a"><ul v-if="ready" /><p v-else class="type-aside">loading</p></AppCard>')).not.toContain('kuna/empty-lines')
    expect(await rulesBroken('<AppCard title="a"><div><h3>b</h3><ul v-if="rows.length > 0" /><p v-else class="type-aside">none</p></div></AppCard>')).not.toContain('kuna/empty-lines')
  })
})
