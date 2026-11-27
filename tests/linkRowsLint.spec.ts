import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

describe('the lint rules that keep a row that opens a page on ListRow and a link with an arrow neutral', { timeout: 120_000 }, () => {
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

  it('refuses a link that is the whole row of a list, built by hand', async () => {
    expect(await rulesBroken('<ul><li><RouterLink to="/a">A</RouterLink></li></ul>')).toContain('kuna/link-rows')
    expect(await rulesBroken('<ul><li><router-link to="/a">A</router-link></li></ul>')).toContain('kuna/link-rows')
    expect(await rulesBroken('<ul><li><ListRow to="/a" title="A" /></li></ul>')).not.toContain('kuna/link-rows')
    expect(await rulesBroken('<ul><li><p>A <RouterLink to="/a">link</RouterLink></p></li></ul>')).not.toContain('kuna/link-rows')
  })

  it("refuses a link with an arrow, such as a card's All link, that is not neutral", async () => {
    expect(await rulesBroken('<UButton to="/a" label="All" trailing-icon="i-lucide-arrow-right" variant="link" />')).toContain('kuna/all-links')
    expect(await rulesBroken('<UButton to="/a" label="All" :trailing-icon="\'i-lucide-arrow-right\'" color="primary" variant="link" />')).toContain('kuna/all-links')
    expect(await rulesBroken('<UButton to="/a" label="All" trailing-icon="i-lucide-arrow-right" color="neutral" variant="link" />')).not.toContain('kuna/all-links')
    expect(await rulesBroken('<UButton label="Continue" trailing-icon="i-lucide-arrow-right" />')).not.toContain('kuna/all-links')
  })

  it("refuses a link in a plain table row's heading cell, since the row opens its record as a RecordRow", async () => {
    expect(await rulesBroken('<table><tbody><tr><th scope="row"><DrillLink to="/a">A</DrillLink></th><td>1</td></tr></tbody></table>')).toContain('kuna/record-rows')
    expect(await rulesBroken('<table><tbody><tr><template v-if="shown"><th scope="row"><RouterLink to="/a">A</RouterLink></th></template></tr></tbody></table>')).toContain('kuna/record-rows')
  })

  it("leaves a RecordRow's heading link, a cell's own link and a link in a group's heading alone", async () => {
    expect(await rulesBroken('<table><tbody><RecordRow to="/a"><th scope="row"><DrillLink to="/a">A</DrillLink></th></RecordRow></tbody></table>')).not.toContain('kuna/record-rows')
    expect(await rulesBroken('<table><tbody><tr><th scope="row">A</th><td><DrillLink to="/a">1</DrillLink></td></tr></tbody></table>')).not.toContain('kuna/record-rows')
    expect(await rulesBroken('<table><tbody><tr><th scope="rowgroup"><DrillLink to="/a">A</DrillLink></th></tr></tbody></table>')).not.toContain('kuna/record-rows')
  })

  it('refuses a list item that opens its record only from a link on its name or a pencil button', async () => {
    expect(await rulesBroken('<ul><li><DrillLink to="/a">A</DrillLink><MoneyText :cents="1" /></li></ul>')).toContain('kuna/record-rows')
    expect(await rulesBroken('<ul><li><span>A</span><UButton icon="i-lucide-pencil" aria-label="Edit A" /><UButton icon="i-lucide-trash-2" aria-label="Remove A" /></li></ul>')).toContain(
      'kuna/record-rows',
    )
    expect(await rulesBroken('<ul><li><span>A</span><UButton :icon="\'i-lucide-square-pen\'" aria-label="Edit A" /></li></ul>')).toContain('kuna/record-rows')
    expect(await rulesBroken('<ul><li><DrillLink to="/a">A</DrillLink><UButton icon="i-lucide-pencil" aria-label="Edit A" /></li></ul>')).toContain('kuna/record-rows')
    expect(await rulesBroken('<ul><li><DrillLink :to="row.to" :label="words.openRow(row.label)">A</DrillLink><span>1</span></li></ul>')).toContain('kuna/record-rows')
    expect(await rulesBroken('<ul><li><span>A</span><ul><li><DrillLink to="/a">B</DrillLink><span>1</span></li></ul></li></ul>')).toContain('kuna/record-rows')
  })

  it("leaves a list item that opens as a whole, a figure's, a sentence's or a figure's rows' own link, repeated links and a labelled button alone", async () => {
    expect(await rulesBroken('<ul><RecordRow as="li" to="/a"><DrillLink to="/a">A</DrillLink></RecordRow></ul>')).not.toContain('kuna/record-rows')
    expect(await rulesBroken('<ul><li><ListRow to="/a" title="A" /><UButton icon="i-lucide-pencil" aria-label="Edit A" /></li></ul>')).not.toContain('kuna/record-rows')
    expect(await rulesBroken('<ul><li @click="open"><DrillLink to="/a">A</DrillLink><span>1</span></li></ul>')).not.toContain('kuna/record-rows')
    expect(await rulesBroken('<ul><li><DrillLink to="/a"><span>A</span><span>1</span></DrillLink></li></ul>')).not.toContain('kuna/record-rows')
    expect(await rulesBroken('<ul><li><span>A</span><DrillLink to="/a"><MoneyText :cents="1" /></DrillLink></li></ul>')).not.toContain('kuna/record-rows')
    expect(await rulesBroken('<ul><li><span>A</span><DrillLink to="/a"><span class="figure">3</span></DrillLink></li></ul>')).not.toContain('kuna/record-rows')
    expect(await rulesBroken('<ul><li><p>See <DrillLink to="/a" in-prose>the rows</DrillLink>.</p><span>1</span></li></ul>')).not.toContain('kuna/record-rows')
    expect(await rulesBroken('<ul><li><span v-for="row in rows" :key="row"><DrillLink :to="row">A</DrillLink></span></li></ul>')).not.toContain('kuna/record-rows')
    expect(await rulesBroken('<ul><li><DrillLink :to="step.to" :label="words.figure.openRows(step.label)">A</DrillLink><span>1</span></li></ul>')).not.toContain('kuna/record-rows')
    expect(await rulesBroken('<ul><li><span>A</span><UButton icon="i-lucide-pencil" label="Edit" /></li></ul>')).not.toContain('kuna/record-rows')
  })

  it('leaves a disclosure chevron in a button and a ListRow that opens a page alone', async () => {
    expect(await rulesBroken('<button type="button"><UIcon name="i-lucide-chevron-right" /></button>')).not.toContain('kuna/link-rows')
    expect(await rulesBroken('<ListRow to="/a" title="A" />')).not.toContain('kuna/link-rows')
  })
})
