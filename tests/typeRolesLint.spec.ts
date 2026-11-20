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

describe('the lint rule that takes text size and ink from the type roles', { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const roleRefusals = async (template: string, script = '', file = 'src/apps/planted/presentation/PlantedRow.vue') => {
    const source = `${script === '' ? '' : `<script setup lang="ts">\nimport { h } from 'vue'\n${script}\n</script>\n\n`}<template>\n  ${template}\n</template>\n`
    const [result] = await eslint.lintText(source, { filePath: join(root, file) })
    return (result?.messages ?? []).filter((message) => message.ruleId === 'kuna/type-roles')
  }

  it.each([
    'text-xs text-muted',
    'text-sm text-toned',
    'text-sm font-medium text-highlighted',
    'text-xs font-medium text-muted',
    'text-sm text-muted',
    'text-sm text-highlighted',
    'text-sm text-default',
    'text-xs text-dimmed',
  ])('refuses %s in a class', async (pair) => {
    expect(await roleRefusals(`<p class="${pair}">A</p>`)).toHaveLength(1)
  })

  it('refuses a pair in a bound class and in an h() class', async () => {
    expect(await roleRefusals(`<p :class="quiet ? 'text-sm text-muted' : 'type-row-title'">A</p>`)).toHaveLength(1)
    expect(await roleRefusals('<p>A</p>', "const caption = () => h('span', { class: 'text-xs text-muted' }, 'A')")).toHaveLength(1)
  })

  it('refuses a pair split over class and a bound class', async () => {
    expect(await roleRefusals(`<p class="text-sm" :class="quiet ? 'text-muted' : 'text-highlighted'">A</p>`)).toHaveLength(1)
  })

  it('refuses a pair in a ui string', async () => {
    expect(await roleRefusals(`<UFormField :ui="{ label: 'text-sm font-medium text-highlighted' }" />`)).toHaveLength(1)
  })

  it('refuses a size behind a variant beside an ink', async () => {
    expect(await roleRefusals('<p class="sm:text-sm text-muted">A</p>', '', 'src/shared/ui/PlantedRow.vue')).toHaveLength(1)
  })

  it('refuses a role beside an ink or a raw size', async () => {
    expect(await roleRefusals('<p class="type-body text-muted">A</p>')).toHaveLength(1)
    expect(await roleRefusals('<p class="type-caption text-base">A</p>')).toHaveLength(1)
  })

  it('allows a weight beside a role, a tone beside a role and a hover ink beside a role', async () => {
    expect(await roleRefusals('<p class="font-normal type-caption">A</p>')).toEqual([])
    expect(await roleRefusals('<p class="type-caption text-warning">A</p>')).toEqual([])
    expect(await roleRefusals('<a class="type-aside group-hover:text-toned">A</a>')).toEqual([])
  })

  it('allows text-base with an ink, which no role covers', async () => {
    expect(await roleRefusals('<p class="text-base text-toned">A</p>')).toEqual([])
  })

  it('refuses text-xs or text-sm alone outside src/shared/ui', async () => {
    expect(await roleRefusals('<p class="text-sm">A</p>')).toHaveLength(1)
    expect(await roleRefusals('<p class="text-xs text-warning">A</p>')).toHaveLength(1)
  })

  it('allows text-xs or text-sm alone or beside a tone inside src/shared/ui', async () => {
    expect(await roleRefusals('<p class="text-sm">A</p>', '', 'src/shared/ui/PlantedRow.vue')).toEqual([])
    expect(await roleRefusals('<p class="text-xs text-warning">A</p>', '', 'src/shared/ui/PlantedRow.vue')).toEqual([])
  })
})
