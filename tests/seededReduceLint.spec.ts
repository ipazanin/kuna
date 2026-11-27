import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

describe('the lint rule that gives every reduce a starting value', { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const rulesBroken = async (code: string) => {
    const [result] = await eslint.lintText(code, { filePath: join(root, 'src/shared/planted/planted.ts') })
    return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]))
  }

  it('refuses reduce and reduceRight with no starting value, which throw on an empty list', async () => {
    expect(await rulesBroken('export const last = (days: readonly string[]): string => days.reduce((latest, day) => (day > latest ? day : latest))\n')).toContain('kuna/seeded-reduce')
    expect(await rulesBroken('export const joined = (parts: readonly string[]): string => parts.reduceRight((all, part) => `${all} ${part}`)\n')).toContain('kuna/seeded-reduce')
  })

  it('refuses reduce seeded with the first element, or a field of it, which throws on an empty list too', async () => {
    expect(await rulesBroken('export const most = (counts: readonly number[]): number => counts.reduce((largest, count) => Math.max(largest, count), counts[0]!)\n')).toContain('kuna/seeded-reduce')
    expect(
      await rulesBroken('export const newest = (rows: readonly { readonly date: string }[]): string => rows.reduce((latest, row) => (row.date > latest ? row.date : latest), rows[0]!.date)\n'),
    ).toContain('kuna/seeded-reduce')
  })

  it('allows reduce with a starting value', async () => {
    expect(await rulesBroken('export const total = (amounts: readonly number[]): number => amounts.reduce((sum, amount) => sum + amount, 0)\n')).not.toContain('kuna/seeded-reduce')
  })
})
