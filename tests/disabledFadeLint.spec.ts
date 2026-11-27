import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

describe('the lint rule that leaves the disabled fade to the button theme', { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const fadeRefusals = async (markup: string, file = 'src/apps/planted/presentation/PlantedRows.vue') => {
    const [result] = await eslint.lintText(`<template>\n  ${markup}\n</template>\n`, { filePath: join(root, file) })
    return (result?.messages ?? []).filter((message) => message.ruleId === 'better-tailwindcss/no-restricted-classes' && message.message.includes('fades the same way'))
  }

  it('refuses a disabled opacity in a class, a bound class and a ui binding, in an app and in a shared component', async () => {
    expect(await fadeRefusals('<UButton class="size-11 disabled:opacity-40" />')).toHaveLength(1)
    expect(await fadeRefusals('<UButton :class="{ \'aria-disabled:opacity-60\': quiet }" />')).toHaveLength(1)
    expect(await fadeRefusals('<UButton :ui="{ base: \'data-disabled:opacity-30\' }" />')).toHaveLength(1)
    expect(await fadeRefusals('<UButton class="sm:disabled:opacity-40" />', 'src/shared/ui/PlantedButtons.vue')).toHaveLength(1)
  })

  it('leaves an opacity that does not follow disabled', async () => {
    expect(await fadeRefusals('<span class="opacity-70 disabled:cursor-not-allowed">A</span>')).toEqual([])
  })
})
