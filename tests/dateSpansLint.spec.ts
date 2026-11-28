import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

describe('the lint rule that words a span of two dates through the shared range labels', { timeout: 120_000 }, () => {
  const root = join(import.meta.dirname, '..')
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })
  const rulesBroken = async (source: string, file = 'src/apps/planted/presentation/words.ts') => {
    const [result] = await eslint.lintText(`${source}\n`, { filePath: join(root, file) })
    return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]))
  }

  it('refuses two date labels joined by an en dash', async () => {
    expect(await rulesBroken('export const span = (from: string, to: string) => `${monthLabel(from)} – ${monthLabel(to)}`')).toContain('kuna/date-spans')
    expect(await rulesBroken('export const span = (from: string, to: string) => `Od ${dayLabel(from)}–${dayLabel(to)}.`')).toContain('kuna/date-spans')
    expect(await rulesBroken("export const span = (from: string, to: string) => [dayLabel(from), dayLabel(to)].join(' – ')")).toContain('kuna/date-spans')
  })

  it('refuses a words builder that joins two worded dates by an en dash', async () => {
    expect(await rulesBroken('export const hr = { period: (from: string, to: string) => `${from} – ${to}` }')).toContain('kuna/date-spans')
    expect(await rulesBroken('export const hr = { span: (label: string, fromMonth: string, toMonth: string) => `${label}, ${fromMonth} – ${toMonth}` }')).toContain('kuna/date-spans')
    expect(await rulesBroken('export const hr = { owed: (first: string, last: string) => `razdoblje ${first} – ${last}` }')).toContain('kuna/date-spans')
  })

  it('refuses a hand-built span in a component script', async () => {
    const component = '<script setup lang="ts">\nconst span = `${monthLabel(first)} – ${monthLabel(last)}`\n</script>'
    expect(await rulesBroken(component, 'src/apps/planted/presentation/PlantedCard.vue')).toContain('kuna/date-spans')
  })

  it('leaves a range label, months named without a year, places, counts and two dates in a sentence alone', async () => {
    expect(await rulesBroken('export const span = (from: string, to: string) => monthRangeLabel(from, to)')).not.toContain('kuna/date-spans')
    expect(await rulesBroken('export const run = (first: string, last: string) => `${monthName(first)} – ${monthName(last)}`')).not.toContain('kuna/date-spans')
    expect(await rulesBroken("export const leg = (place: string, other: string) => [place, other].join(' – ')")).not.toContain('kuna/date-spans')
    expect(await rulesBroken('export const hr = { years: (first: number, last: number) => `${first}. – ${last}.` }')).not.toContain('kuna/date-spans')
    expect(await rulesBroken('export const hr = { odometer: (startReading: string, endReading: string) => `${startReading} – ${endReading} km` }')).not.toContain('kuna/date-spans')
    expect(await rulesBroken('export const en = { before: (date: string, newest: string) => `dated ${dayLabel(date)}, before ${dayLabel(newest)}` }')).not.toContain('kuna/date-spans')
  })

  it('leaves the shared calendar, which owns the range labels, alone', async () => {
    expect(await rulesBroken('export const span = (from: string, to: string) => `${dayLabel(from)} – ${dayLabel(to)}`', 'src/shared/calendar/planted.ts')).not.toContain('kuna/date-spans')
  })
})
