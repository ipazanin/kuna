import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

describe('the lint rule that keeps a picker min width off a phone', { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const rulesBroken = async (template: string) => {
    const [result] = await eslint.lintText(`<template>\n  ${template}\n</template>\n`, { filePath: join(root, 'src/apps/planted/presentation/PlantedFilters.vue') })
    return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]))
  }

  it('refuses a min width of 10rem or more on every width of a select or picker, plain or bound', async () => {
    expect(await rulesBroken('<USelect v-model="a" :items="b" class="min-w-40" />')).toContain('kuna/picker-min-widths')
    expect(await rulesBroken('<USelectMenu v-model="a" :items="b" class="min-w-72" />')).toContain('kuna/picker-min-widths')
    expect(await rulesBroken('<CategoryPicker v-model="a" :categories="b" :class="c ? \'w-44\' : \'max-w-full min-w-48\'" />')).toContain('kuna/picker-min-widths')
    expect(await rulesBroken('<OptionalSelect v-model="a" :items="b" none="Not set" :search="false" class="min-w-xs" />')).toContain('kuna/picker-min-widths')
  })

  it('leaves a min width behind sm: and a narrow one alone', async () => {
    expect(await rulesBroken('<USelect v-model="a" :items="b" class="min-w-0 flex-1 sm:min-w-48" />')).not.toContain('kuna/picker-min-widths')
    expect(await rulesBroken('<AccountPicker v-model="a" :options="b" class="min-w-36" />')).not.toContain('kuna/picker-min-widths')
  })

  it('refuses the same min width on a field or plain element whose select or picker sets its width', async () => {
    expect(await rulesBroken('<UFormField label="Recipe" class="min-w-56 flex-1"><USelect v-model="a" :items="b" class="w-full" /></UFormField>')).toContain('kuna/picker-min-widths')
    expect(await rulesBroken('<UFormField label="Category" :class="c ? \'min-w-48\' : \'\'"><template #hint>d</template><CategoryPicker v-model="a" :categories="b" /></UFormField>')).toContain(
      'kuna/picker-min-widths',
    )
    expect(await rulesBroken('<div class="min-w-56"><USelect v-model="a" :items="b" class="w-full" /></div>')).toContain('kuna/picker-min-widths')
  })

  it('leaves a field without a select, a row that holds more than a select and a wrapper behind sm: alone', async () => {
    expect(await rulesBroken('<UFormField label="Name" class="min-w-56"><UInput v-model="a" /></UFormField>')).not.toContain('kuna/picker-min-widths')
    expect(await rulesBroken('<div class="flex min-w-56 gap-2"><USelect v-model="a" :items="b" /><UInput v-model="c" /></div>')).not.toContain('kuna/picker-min-widths')
    expect(await rulesBroken('<AppCard class="min-w-56"><USelect v-model="a" :items="b" /></AppCard>')).not.toContain('kuna/picker-min-widths')
    expect(await rulesBroken('<UFormField label="Recipe" class="w-full sm:w-auto sm:min-w-56 sm:flex-1"><USelect v-model="a" :items="b" class="w-full" /></UFormField>')).not.toContain(
      'kuna/picker-min-widths',
    )
  })
})
