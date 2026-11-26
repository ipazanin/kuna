import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig, optionalSelectsAllowed } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

describe('the lint rule that keeps a select whose field may stay empty on OptionalSelect', { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const planted = 'src/apps/planted/presentation/PlantedField.vue'
  const messagesOf = async (linter: ESLint, source: string, file: string) => {
    const [result] = await linter.lintText(source, { filePath: join(root, file) })
    return (result?.messages ?? []).filter((message) => message.ruleId === 'kuna/optional-selects')
  }
  const rulesBroken = async (template: string, file = planted) => ((await messagesOf(eslint, `<template>\n  ${template}\n</template>\n`, file)).length > 0 ? ['kuna/optional-selects'] : [])
  const scriptBroken = async (script: string) => (await messagesOf(eslint, `<script setup lang="ts">\n${script}\n</script>\n`, planted)).length > 0

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

  it('refuses a bound select with a placeholder and no error to show, alone or in a field without one', async () => {
    expect(await rulesBroken('<USelect v-model="form.kind" :items="b" :placeholder="words.pick" />')).toContain('kuna/optional-selects')
    expect(await rulesBroken('<UFormField label="Kind"><USelectMenu :model-value="kind" :items="b" placeholder="Pick one" /></UFormField>')).toContain('kuna/optional-selects')
  })

  it('leaves a placeholder select that shows its error, picks many or is bound to nothing', async () => {
    expect(await rulesBroken('<UFormField :error="errors.kind"><USelect v-model="kind" :items="b" :placeholder="words.pick" /></UFormField>')).not.toContain('kuna/optional-selects')
    expect(await rulesBroken('<USelect v-model="kind" :items="b" :placeholder="words.pick" :color="wrong ? \'error\' : \'neutral\'" />')).not.toContain('kuna/optional-selects')
    expect(await rulesBroken('<USelectMenu v-model="labels" :items="b" multiple :placeholder="words.pick" />')).not.toContain('kuna/optional-selects')
    expect(await rulesBroken('<USelect :items="b" :placeholder="words.pick" @update:model-value="add" />')).not.toContain('kuna/optional-selects')
  })

  it('refuses a list that starts with a hand-made row for empty, flat or in groups', async () => {
    expect(await scriptBroken("const items = [{ label: words.notSet, value: 'none' }, ...rest]")).toBe(true)
    expect(await scriptBroken('const items = [[{ value: NONE, label: words.dialog.noCategory }], rest]')).toBe(true)
    expect(await rulesBroken('<USelect v-model="a" :items="[{ label: words.none, value: \'-\' }, ...b]" />')).toContain('kuna/optional-selects')
  })

  it('leaves a later row for empty and a badge that reads as none', async () => {
    expect(await scriptBroken('const items = [...rest, { label: words.noEvent, value: OUT }]')).toBe(false)
    expect(await scriptBroken("const badges = [{ label: words.noRule, color: 'info' }]")).toBe(false)
    expect(await scriptBroken("const items = [{ label: words.nothing, value: 'x' }]")).toBe(false)
  })

  it('lets a select through by the name its allowlist gives it, in that file only', async () => {
    const template = '<template>\n  <USelect v-model="recipeChoice" :items="b" :placeholder="words.pick" data-testid="recipe-choice" />\n</template>\n'
    expect(await messagesOf(eslint, template, 'src/apps/company/imports/presentation/ImportPanel.vue')).toEqual([])
    expect(await messagesOf(eslint, template, planted)).toHaveLength(1)
  })

  it('allows only selects the rule still finds, so a fixed one leaves the allowlist', async () => {
    const unallowed = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: [...kunaConfig(baseline), { files: ['src/**/*.{ts,vue}'], rules: { 'kuna/optional-selects': ['error', { allowed: {} }] } }],
    })
    const stale = []
    for (const [file, names] of Object.entries(optionalSelectsAllowed)) {
      const [result] = await unallowed.lintFiles([join(root, file)])
      const found = (result?.messages ?? []).filter((message) => message.ruleId === 'kuna/optional-selects').map((message) => message.message)
      stale.push(...Object.keys(names).flatMap((name) => (found.some((message) => message.includes(`allow "${name}"`)) ? [] : [`${file}: ${name}`])))
    }
    expect(stale).toEqual([])
  })
})
