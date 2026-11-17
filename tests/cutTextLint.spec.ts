import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

describe('the lint rule that keeps cut text on CutText', { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const refusals = async (source: string, file = 'src/apps/planted/presentation/PlantedRows.vue') => {
    const [result] = await eslint.lintText(source, { filePath: join(root, file) })
    return (result?.messages ?? []).filter((message) => message.ruleId === 'better-tailwindcss/no-restricted-classes').map((message) => message.message)
  }
  const template = (markup: string) => `<template>\n  ${markup}\n</template>\n`
  const cutRefusals = async (source: string, file?: string) => (await refusals(source, file)).filter((message) => message.includes('CutText'))
  const windowRefusals = async (source: string, file: string) => (await refusals(source, file)).filter((message) => message.includes('follows its container'))

  it('refuses truncate, a line clamp and text-ellipsis in a class, a bound class and a ui binding', async () => {
    expect(await cutRefusals(template('<p class="truncate text-xs">A</p>'))).toHaveLength(1)
    expect(await cutRefusals(template('<p class="sm:line-clamp-2">A</p>'))).toHaveLength(1)
    expect(await cutRefusals(template("<p :class=\"wide ? 'truncate' : ''\">A</p>"))).toHaveLength(1)
    expect(await cutRefusals(template('<UInput :ui="{ base: \'text-ellipsis\' }" />'))).toHaveLength(1)
  })

  it('refuses truncate in a row built with h()', async () => {
    const source = "<script setup lang=\"ts\">\nimport { h } from 'vue'\nconst row = () => h('p', { class: 'truncate text-xs text-muted' }, 'A')\n</script>\n"

    expect(await cutRefusals(source, 'src/apps/planted/presentation/PlantedTable.vue')).toHaveLength(1)
  })

  it('refuses truncate in the shell and in shared code outside a page', async () => {
    expect(await cutRefusals(template('<span class="truncate">A</span>'), 'src/shell/ui/PlantedMenu.vue')).toHaveLength(1)
  })

  it('leaves CutText to cut, and still refuses it a class that follows the window', async () => {
    expect(await cutRefusals(template('<span class="truncate line-clamp-2">A</span>'), 'src/shared/ui/CutText.vue')).toEqual([])
    expect(await windowRefusals(template('<span class="md:grid-cols-2">A</span>'), 'src/shared/ui/CutText.vue')).toHaveLength(1)
  })

  it.each([
    'src/apps/company/settings/presentation/CategoriesEditor.vue',
    'src/apps/company/settings/presentation/GeneralSettingsForm.vue',
    'src/apps/loans/scenarios/presentation/OfferTermsFields.vue',
  ])("leaves a field's ellipsis in %s, which focus shows in full, and refuses anything else that cuts", async (file) => {
    expect(await cutRefusals(template('<UInput :ui="{ base: \'text-ellipsis\' }" />'), file)).toEqual([])
    expect(await cutRefusals(template('<span class="truncate">A</span>'), file)).toHaveLength(1)
    expect(await windowRefusals(template('<div class="md:grid-cols-2" />'), file)).toHaveLength(1)
  })

  it.each(['src/apps/company/transactions/presentation/CategoryPicker.vue', 'src/apps/company/workbook/presentation/PaymentsSelect.vue', 'src/apps/spending/statements/presentation/RuleDialog.vue'])(
    "leaves a select's trigger in %s to cut the choice its open list shows in full, and refuses an ellipsis on anything else",
    async (file) => {
      expect(await cutRefusals(template('<span class="truncate">A</span>'), file)).toEqual([])
      expect(await cutRefusals(template('<UInput :ui="{ base: \'text-ellipsis\' }" />'), file)).toHaveLength(1)
      expect(await windowRefusals(template('<div class="md:grid-cols-2" />'), file)).toHaveLength(1)
    },
  )

  it('names CutText in what it says, so a builder knows the way to cut text', async () => {
    const [message] = await cutRefusals(template('<p class="truncate">A</p>'))

    expect(message).toBe('"truncate": text that may be cut goes through CutText in src/shared/ui, which shows the full text on hover, on focus and on a long press.')
  })
})
