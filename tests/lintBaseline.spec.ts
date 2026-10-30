import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

type List = keyof typeof baseline

const root = join(import.meta.dirname, '..')
const lists = Object.keys(baseline) as List[]
const unexempted = kunaConfig(Object.fromEntries(lists.map((list) => [list, []])))

/** The rules a list exempts its files from, read from the config entry it feeds. */
function rulesOf(list: List): string[] {
  const entry = unexempted.find((candidate) => candidate.name === `kuna/baseline-${list}`)
  return Object.keys(entry?.rules ?? {})
}

describe('lint baseline', () => {
  it.each(lists)('names only files that exist in %s', (list) => {
    expect(baseline[list].filter((file) => !existsSync(join(root, file)))).toEqual([])
  })

  it.each(lists)('names each file once and in order in %s', (list) => {
    expect(baseline[list]).toEqual([...new Set(baseline[list])].sort())
  })

  it('names only files that still break the rule they are exempt from', async () => {
    const files = [...new Set(lists.flatMap((list) => baseline[list]))].filter((file) => existsSync(join(root, file)))
    const results = await new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: unexempted }).lintFiles(files)
    const broken = new Map(results.map((result) => [relative(root, result.filePath), new Set(result.messages.map((message) => message.ruleId))]))

    const unneeded = Object.fromEntries(lists.map((list) => [list, baseline[list].filter((file) => broken.has(file) && !rulesOf(list).some((rule) => broken.get(file)?.has(rule)))]))

    expect(unneeded).toEqual(Object.fromEntries(lists.map((list) => [list, []])))
  }, 120_000)
})
