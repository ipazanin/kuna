import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

describe('the lint rule that keeps running text on one reading width', { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const widthRefusals = async (markup: string) => {
    const [result] = await eslint.lintText(`<template>\n  ${markup}\n</template>\n`, { filePath: join(root, 'src/apps/planted/presentation/PlantedIntro.vue') })
    return (result?.messages ?? []).filter((message) => message.ruleId === 'better-tailwindcss/no-restricted-classes' && message.message.includes('max-w-prose'))
  }

  it('refuses a reading width in ch, plain and behind a variant', async () => {
    expect(await widthRefusals('<p class="max-w-[60ch] type-aside">A</p>')).toHaveLength(1)
    expect(await widthRefusals('<p class="sm:max-w-[52ch] type-aside">A</p>')).toHaveLength(1)
  })

  it('allows max-w-prose', async () => {
    expect(await widthRefusals('<p class="max-w-prose type-aside">A</p>')).toEqual([])
  })
})
