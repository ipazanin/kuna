import { join } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { kunaConfig } from '../eslint.config.js'
import baseline from '../scripts/lint-baseline.json'

const root = join(import.meta.dirname, '..')
const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: kunaConfig(baseline) })

async function rulesBroken(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(root, file) })
  return (result?.messages ?? []).flatMap((message) => (message.ruleId?.startsWith('kuna/') ? [message.ruleId] : []))
}

const DOMAIN = 'src/apps/loans/planted/domain/planted.ts'
const SCREEN = 'src/apps/loans/planted/presentation/Planted.vue'
const WORDS = 'src/apps/loans/planted/presentation/words.ts'
const FLOWS = 'scripts/support/plantedFlows.mjs'

describe('money, domain and note lint rules', { timeout: 120_000 }, () => {
  it.each([
    ['a cast', DOMAIN, 'export const a = 1 as Money', 'kuna/money-casts'],
    ['a cast to an account amount', DOMAIN, 'export const a = 1 as AccountMoney', 'kuna/money-casts'],
    ['a cast through unknown', DOMAIN, 'export const a = 1 as unknown as Percent', 'kuna/money-casts'],
    ['a cast to a nullable brand', DOMAIN, 'export const a = 1 as Share | null', 'kuna/money-casts'],
    ['a cast to a list of a brand', DOMAIN, 'export const a = [] as Decimal[]', 'kuna/money-casts'],
    ['a cast in a script block', SCREEN, '<script setup lang="ts">\nconst a = 1 as Money\n</script>\n<template><p>{{ a }}</p></template>', 'kuna/money-casts'],
    ['a cast in a template', SCREEN, '<script setup lang="ts">\nconst a = 1\n</script>\n<template><p>{{ a as Money }}</p></template>', 'kuna/money-casts'],
    ['a division by 100', DOMAIN, 'export const a = (b: number) => b / 100', 'kuna/money-scale'],
    ['a multiplication by 100', DOMAIN, 'export const a = (b: number) => b * 100', 'kuna/money-scale'],
    ['100 on the left', DOMAIN, 'export const a = (b: number) => 100 * b', 'kuna/money-scale'],
    ['a division by 10,000', DOMAIN, 'export const a = (b: number) => b / 10_000', 'kuna/money-scale'],
    ['a bigint scale', DOMAIN, 'export const a = (b: bigint) => b * 100n', 'kuna/money-scale'],
    ['a scaling assignment', DOMAIN, 'export function a(b: number) {\n  b /= 100\n  return b\n}', 'kuna/money-scale'],
    ['a copy of the constant', DOMAIN, 'export const WHOLE = 10_000', 'kuna/money-scale'],
    ['a scale in a template', SCREEN, '<script setup lang="ts">\nconst a = 1\n</script>\n<template><p>{{ a * 100 }}</p></template>', 'kuna/money-scale'],
    ['Math.round', DOMAIN, 'export const a = (b: number) => Math.round(b)', 'kuna/domain-rounding'],
    ['Math.round in a ruleset', 'src/apps/company/packs/planted/ruleset/planted.ts', 'export const a = (b: number) => Math.round(b)', 'kuna/domain-rounding'],
    ['a words import in domain code', DOMAIN, "import { words } from './words'", 'kuna/domain-words'],
    ['a words import from another feature', DOMAIN, "import { words } from '../../shared/text/words'", 'kuna/domain-words'],
    ['a class', DOMAIN, 'export class Loan {}', 'kuna/domain-classes'],
    ['a class expression', DOMAIN, 'export const Loan = class {}', 'kuna/domain-classes'],
    ['a text colour on a figure with a tone', SCREEN, '<template><MoneyText :cents="a" tone="flow" class="font-medium text-highlighted" /></template>', 'kuna/money-tone-colours'],
    ['a text colour on an account figure with a bound tone', SCREEN, '<template><AccountMoneyText :cents="a" currency="EUR" :tone="t" class="text-error" /></template>', 'kuna/money-tone-colours'],
    ['a scroll then a shot', FLOWS, "export async function a(page, shoot) {\n  await page.$eval('#a', (element) => element.scrollIntoView())\n  await shoot('a')\n}", 'kuna/shoot-at'],
    [
      'a scroll, a wait, an inspection and a shot',
      FLOWS,
      "export async function a(page, shoot, inspect) {\n  await row.scrollIntoView()\n  await delay(300)\n  await inspect?.('a row')\n  await shoot('a')\n}",
      'kuna/shoot-at',
    ],
    ['a worded date under another name', WORDS, 'export const en = { paidIn: (when: string) => `Paid in ${when}` }', 'kuna/date-parameters'],
    ['an untyped date of a Croatian builder', WORDS, 'export const hr = { since: (startDate, payMonth) => `${startDate} ${payMonth}`, run: (dates) => dates }', 'kuna/date-parameters'],
    ['a warning icon drawn by hand', SCREEN, '<template><p><UIcon name="i-lucide-triangle-alert" />Late</p></template>', 'kuna/note-lines'],
    ['a success icon before words', SCREEN, '<template><p><UIcon name="i-lucide-circle-check" /><span>Done</span></p></template>', 'kuna/note-lines'],
    ['a tone icon taken from TONE_ICONS before words', SCREEN, '<template><p><UIcon :name="TONE_ICONS.error" />{{ a }}</p></template>', 'kuna/note-lines'],
    ['a warning icon picked by a condition', SCREEN, "<template><p><UIcon :name=\"a ? 'i-lucide-triangle-alert' : 'i-lucide-check'\" />Late</p></template>", 'kuna/note-lines'],
  ])('refuses %s', async (_name, file, code, rule) => {
    expect(await rulesBroken(file, code)).toContain(rule)
  })

  it.each([
    ['a cast in the owner', 'src/shared/money/planted.ts', 'export const a = 1 as Money'],
    ['scaling in the owner', 'src/shared/money/planted.ts', 'export const a = (b: number) => b / 100'],
    ['scaling in a chart', 'src/shared/charts/planted.ts', 'export const a = (b: number) => b * 100'],
    ['scaling in a fake seed', 'src/apps/loans/workbook/infrastructure/fake/planted.ts', 'export const a = (b: number) => b / 100'],
    ['another multiplier', DOMAIN, 'export const a = (b: number) => b * 1000'],
    ['a rule row at 100%', 'src/apps/company/packs/planted/ruleset/rules/planted.ts', 'export const a = basisPoints(10_000)'],
    ['a duration of ten seconds', DOMAIN, 'export const UNDO_DURATION = 10_000'],
    ['Math.round on a screen', 'src/apps/loans/planted/presentation/planted.ts', 'export const a = (b: number) => Math.round(b)'],
    ['a words import beside a screen', 'src/apps/loans/planted/presentation/planted.ts', "import { words } from './words'"],
    ['an import of a file that only ends in words', DOMAIN, "import { swords } from './swords'"],
    ['an Error subclass', DOMAIN, 'export class Refused extends Error {}'],
    ['a class on a screen', 'src/apps/loans/planted/presentation/planted.ts', 'export class Loan {}'],
    ['a text colour on a figure with no tone', SCREEN, '<template><MoneyText :cents="a" class="text-muted" /></template>'],
    ['a size on a figure with a tone', SCREEN, '<template><MoneyText :cents="a" tone="flow" class="text-sm font-medium" /></template>'],
    ['a scroll before a tap and then a shot', FLOWS, "export async function a(page, shoot) {\n  await row.scrollIntoView()\n  await row.tap()\n  await shoot('a')\n}"],
    ['a worded date named for one', WORDS, 'export const en = { paidIn: (period: string, dueDay: string | null, since = "") => `${period} ${dueDay} ${since}` }'],
    ['a day number, a count and a typed date', WORDS, 'export const en = { mealsOn: (dayNumber: number, daysCount: string, bought: CivilDate) => `${dayNumber} ${daysCount} ${bought}` }'],
    ['a warning icon on an alert', SCREEN, '<template><UAlert icon="i-lucide-triangle-alert" title="Late" /></template>'],
    ['another icon drawn by hand', SCREEN, '<template><p><UIcon name="i-lucide-link" />Late</p></template>'],
    [
      'a mark beside a figure with words only for a screen reader',
      SCREEN,
      '<template><span><UIcon :name="TONE_ICONS.warning" /><span class="sr-only">Warning</span><span class="figure">1</span></span></template>',
    ],
  ])('allows %s', async (_name, file, code) => {
    expect(await rulesBroken(file, code)).toEqual([])
  })
})
