import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

const root = join(import.meta.dirname, '..')
const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })

async function rulesBroken(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(root, file) })
  return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]))
}

const SCREEN = 'src/apps/loans/planted/presentation/PlantedScreen.vue'
const COMPONENT = 'src/shared/ui/PlantedCard.vue'
const screenWith = (classes: string): string => `<script setup lang="ts">\n</script>\n<template><div class="${classes}"></div></template>\n`

describe('the lint rules that keep a page off the window', { timeout: 120_000 }, () => {
  it.each([
    ['a window step on a page', SCREEN, screenWith('flex lg:flex-row'), 'better-tailwindcss/no-restricted-classes'],
    ['a window step below a width', SCREEN, screenWith('max-md:hidden'), 'better-tailwindcss/no-restricted-classes'],
    ['a window step in a shared component', COMPONENT, screenWith('xl:gap-8'), 'better-tailwindcss/no-restricted-classes'],
    ['a window grid in the shell', 'src/shell/planted/PlantedFrame.vue', screenWith('grid md:grid-cols-2'), 'better-tailwindcss/no-restricted-classes'],
    [
      'a width literal in a media query',
      SCREEN,
      "<script setup lang=\"ts\">\nimport { useMediaQuery } from '../../../../shared/layout/viewport'\nconst wide = useMediaQuery('(min-width: 768px)')\n</script>\n<template><p>{{ wide }}</p></template>\n",
      'kuna/window-queries',
    ],
    [
      'a width in a media query template',
      'src/shared/planted/planted.ts',
      "import { useMediaQuery } from '../layout/viewport'\nconst edge = 768\nexport const wide = useMediaQuery(`(min-width: ${edge}px)`)\n",
      'kuna/window-queries',
    ],
  ])('refuses %s', async (_name, file, code, rule) => {
    expect(await rulesBroken(file, code)).toContain(rule)
  })

  it.each([
    ['a container step on a page', SCREEN, screenWith('flex @2xl:flex-row')],
    ['the phone step on a page', SCREEN, screenWith('flex sm:flex-row')],
    ['a window step in the shell outside a grid', 'src/shell/planted/PlantedFrame.vue', screenWith('flex lg:flex-row')],
    ['a media query on the window height', 'src/shell/planted/planted.ts', "import { useMediaQuery } from '../../shared/layout/viewport'\nexport const short = useMediaQuery('(max-height: 859px)')\n"],
  ])('allows %s', async (_name, file, code) => {
    expect(await rulesBroken(file, code)).toEqual([])
  })
})

describe('the style blocks', () => {
  it('ask about the window width only at the phone step, since a page follows the room the shell gives it', () => {
    const asked = globSync('src/**/*.vue', { cwd: root }).flatMap((file) => {
      const styles = [...readFileSync(join(root, file), 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(([, css]) => css).join('\n')
      return [...styles.matchAll(/@media[^{]*/g)]
        .map(([query]) => query.trim())
        .filter((query) => /width/.test(query) && !/^@media \((?:max-width: 639px|min-width: 640px)\)$/.test(query))
        .map((query) => `${file}: ${query}`)
    })
    expect(asked).toEqual([])
  })
})
