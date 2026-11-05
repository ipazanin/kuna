import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { CUSTOMS_TABLE } from '../src/apps/assets/carValue/domain/customsTable'
import { ONE_DAY_SETTLEMENT_FROM } from '../src/apps/investments/tax/domain/settlementDay'
import { JOPPD_CODES, TAX_RULES, rulesOf } from '../src/apps/investments/tax/domain/taxRules'
import type { RuleMark } from '../src/apps/investments/tax/domain/taxRules'
import { en } from '../src/apps/investments/tax/presentation/words'
import { LAW_README, indexedReadme } from '../scripts/law-index.mjs'
import { TAX_CLASSES } from '../src/apps/company/packs/hr-doo/preset/domain/taxClasses'
import { startingRules } from '../src/apps/company/packs/hr-doo/preset/domain/startingRules'
import { ruleValue } from '../src/apps/company/packs/hr-doo/ruleset/ruleset'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { civilDate, parseCivilDate } from '../src/shared/calendar/civilDate'
import type { VatTreatment } from '../src/apps/company/workbook/domain/vatTreatment'

const root = join(import.meta.dirname, '..')
const lawDir = join(root, 'docs/law')

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith('.md') ? [path] : []
  })
}

/** The lines of a Markdown file outside fenced code. */
function proseLines(path: string): string[] {
  let fenced = false
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => {
      if (line.startsWith('```')) {
        fenced = !fenced
        return false
      }
      return !fenced
    })
}

/** The anchor GitHub gives a heading. */
function anchorOf(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

/** The anchors GitHub gives a file's headings. */
function anchorsOf(path: string): Set<string> {
  return new Set(
    proseLines(path)
      .flatMap((line) => line.match(/^#{1,6} (.+)$/)?.slice(1) ?? [])
      .map(anchorOf),
  )
}

/** The first sentence after "Screen: " in the section under a heading, up to the next heading of any level. */
function screenSentenceOf(file: string, anchor: string): string | undefined {
  const lines = proseLines(join(lawDir, file))
  const start = lines.findIndex((line) => /^#{1,6} /.test(line) && anchorOf(line.replace(/^#+ /, '')) === anchor)
  const end = lines.findIndex((line, index) => index > start && /^#{1,6} /.test(line))
  const line = lines.slice(start + 1, end < 0 ? undefined : end).find((candidate) => candidate.includes('Screen: '))
  return line?.slice(line.indexOf('Screen: ') + 'Screen: '.length).split(/\.( |$)/)[0]
}

const cellsOf = (line: string): string[] =>
  line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim().replaceAll('`', ''))

/** The rows of the first table under a heading, keyed by the table's header. */
function tableUnder(file: string, heading: string): Record<string, string>[] {
  const lines = proseLines(join(lawDir, file))
  const start = lines.findIndex((line) => /^#{2,6} /.test(line) && line.replace(/^#+ /, '') === heading)
  expect(start, `${file} has no heading "${heading}"`).toBeGreaterThanOrEqual(0)
  const first = lines.findIndex((line, index) => index > start && line.startsWith('|'))
  const end = lines.findIndex((line, index) => index > first && !line.startsWith('|'))
  const [header, , ...rows] = lines.slice(first, end < 0 ? undefined : end).map(cellsOf)
  return rows.map((row) => Object.fromEntries(header!.map((name, index) => [name, row[index] ?? ''])))
}

function percent(cell: string | undefined): number {
  const match = cell?.match(/^(\d+)%$/)
  expect(match, `"${cell}" is not a whole percent`).not.toBeNull()
  return Number(match![1])
}

function yesNo(cell: string | undefined): boolean {
  expect(['yes', 'no']).toContain(cell)
  return cell === 'yes'
}

/** Each code under a dotted key, as the "Kuna key" column names it. */
function flatCodes(codes: object, prefix = ''): [string, string][] {
  return Object.entries(codes).flatMap(([key, code]): [string, string][] => (typeof code === 'string' ? [[`${prefix}${key}`, code]] : flatCodes(code as object, `${prefix}${key}.`)))
}

/** A share in basis points as the docs write it, such as 50%. */
function percentText(basisPoints: number): string {
  return `${basisPoints / 100}%`
}

/** The share of the VAT inside a purchase Kuna counts as input VAT for a treatment, or null for one that splits no VAT out. */
function inputVatBack(treatment: VatTreatment, on: CivilDate): number | null {
  const deduction = ruleValue('hr.vat.input-deduction', on).value
  switch (treatment) {
    case 'deductible-25':
    case 'deductible-13':
    case 'deductible-5':
      return deduction.deductibleOnBusinessPurchases.holds ? 10_000 : 0
    case 'representation':
      return deduction.representationDeductible.holds ? 10_000 : 0
    case 'car-50':
      return deduction.personalCarDeductibleShare.basisPoints
    case 'none':
    case 'reverse-charge':
    case 'foreign-vat':
      return null
  }
}

describe('law docs', () => {
  it.each(Object.entries(TAX_RULES))('ties the rule %s to a heading in docs/law', (_rule, basis) => {
    const [file, anchor] = basis.law.split('#')
    const path = join(lawDir, file!)
    expect(existsSync(path), `docs/law/${file} is missing`).toBe(true)
    expect([...anchorsOf(path)]).toContain(anchor)
  })

  const marksByHeading = Object.entries(TAX_RULES).reduce<Record<string, RuleMark[]>>((byLaw, [, basis]) => ({ ...byLaw, [basis.law]: [...(byLaw[basis.law] ?? []), basis.mark] }), {})
  it.each(Object.entries(marksByHeading))('names under %s the screen mark of each rule resting on it', (law, marks) => {
    const [file, anchor] = law.split('#')
    const sentence = screenSentenceOf(file!, anchor!)
    expect(sentence, `${law} has no "Screen:" sentence`).toBeDefined()
    const named = (Object.entries(en.marks) as [RuleMark, string][]).filter(([, label]) => sentence!.includes(label)).map(([mark]) => mark)
    expect(named.sort()).toEqual([...new Set(marks)].sort())
  })

  it('states the day each market moves to settling one business day after the trade', () => {
    const rows = tableUnder('investments/hnb-rates-and-settlement.md', 'Settlement cycles')
    expect(Object.fromEntries(rows.map((row) => [row.Currency, row['One day from']]))).toEqual(ONE_DAY_SETTLEMENT_FROM)
  })

  it('states every row of the customs table the Assets app estimates a car by', () => {
    const rows = tableUnder('assets/used-car-value.md', 'Tablica 1')
    const shareOf = (cell: string | undefined): number => {
      const match = cell?.match(/^(\d+)\.(\d{2})%$/)
      expect(match, `"${cell}" is not a percent with two decimals`).not.toBeNull()
      return Number(match![1]) * 100 + Number(match![2])
    }
    expect(rows.map((row) => ({ from: Number(row['From months']), to: Number(row['To months']), share: shareOf(row['Share left']) }))).toEqual(CUSTOMS_TABLE)
  })

  it('states the capital gains rate and surtax of every year Kuna has a row for', () => {
    const rows = tableUnder('investments/capital-gains.md', 'Rates by year')
    const years = rows.map((row) => Number(row.Year))
    for (const row of rows) {
      const { rules, ownRow } = rulesOf(Number(row.Year))
      expect(ownRow, `taxRules.ts has no row for ${row.Year}`).toBe(true)
      expect({ year: rules.year, gainsRate: rules.gainsRate, surtax: rules.surtax }).toEqual({ year: Number(row.Year), gainsRate: percent(row['Capital gains']), surtax: yesNo(row['City surtax']) })
    }
    expect(() => rulesOf(Math.min(...years) - 1)).toThrow(RangeError)
    expect(rulesOf(Math.max(...years) + 1).ownRow, 'taxRules.ts has a year the doc does not').toBe(false)
  })

  it('states the income rate and the US withholding of every year Kuna has a row for', () => {
    const rows = tableUnder('investments/foreign-capital-income.md', 'Rates by year')
    expect(rows.map((row) => Number(row.Year))).toEqual(tableUnder('investments/capital-gains.md', 'Rates by year').map((row) => Number(row.Year)))
    for (const row of rows) {
      const { rules } = rulesOf(Number(row.Year))
      expect({ incomeRate: rules.incomeRate, usWithholding: rules.usWithholding, usTreaty: rules.usTreaty }).toEqual({
        incomeRate: percent(row['Dividends and interest']),
        usWithholding: percent(row['US withholding']),
        usTreaty: yesNo(row['US treaty in force']),
      })
    }
  })

  it('states every JOPPD code Kuna writes, and no other under a Kuna key', () => {
    const rows = tableUnder('investments/joppd-for-investors.md', 'Codes').filter((row) => row['Kuna key'] !== 'none')
    expect(rows.map((row) => [row['Kuna key'], row.Code]).sort()).toEqual(flatCodes(JOPPD_CODES).sort())
  })

  it.each(markdownFiles(lawDir).map((path) => relative(root, path)))('has links in %s that reach a file and heading', (file) => {
    const path = join(root, file)
    const links = proseLines(path)
      .map((line) => line.replace(/`[^`]*`/g, ''))
      .flatMap((line) => [...line.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]!))
      .filter((link) => !/^(https?:|mailto:)/.test(link))
    for (const link of links) {
      const [target, anchor] = link.split('#')
      const linked = target === '' ? path : join(dirname(path), target!)
      expect(existsSync(linked), `${file} links to ${link}`).toBe(true)
      if (anchor !== undefined) {
        expect([...anchorsOf(linked)], `${file} links to ${link}`).toContain(anchor)
      }
    }
  })

  it('keeps the index in docs/law/README.md in step with the files, so run npm run law-index after changing one', async () => {
    expect(readFileSync(LAW_README, 'utf8')).toBe(await indexedReadme())
  })
})

describe('company law docs', () => {
  const classRows = tableUnder('company/tax-classes.md', 'Classes')
  const listed = (cell: string | undefined): string[] => (cell ?? '').split(',').map((entry) => entry.trim())

  it.each(TAX_CLASSES.map((taxClass) => [taxClass.id, taxClass.law] as const))('ties the class %s to a heading in docs/law', (_id, law) => {
    const [file, anchor] = law.split('#')
    const path = join(lawDir, file!)
    expect(existsSync(path), `docs/law/${file} is missing`).toBe(true)
    expect([...anchorsOf(path)]).toContain(anchor)
  })

  it('lists every class under "Classes" once, and nothing else', () => {
    expect(classRows.map((row) => row.Class)).toEqual(TAX_CLASSES.map((taxClass) => taxClass.id))
  })

  it.each(TAX_CLASSES.map((taxClass) => [taxClass.id, taxClass] as const))('states the add-back, input VAT, treatments and buckets of %s as the ruleset and the class have them', (id, taxClass) => {
    const row = classRows.find((candidate) => candidate.Class === id)!
    const from = parseCivilDate(row.From ?? '')
    expect(from, `"${row.From}" is not a day`).not.toBeNull()
    const addBack = taxClass.addBack === null ? 0 : ruleValue(taxClass.addBack, from!).value.addBackShare.basisPoints
    const vatBack = [...new Set(taxClass.vat.flatMap((treatment) => inputVatBack(treatment, from!) ?? []))]
    expect({
      addBack: row['CIT add-back'],
      vatBack: row['Input VAT back'],
      vat: listed(row['VAT treatments']),
      buckets: listed(row.Buckets),
    }).toEqual({
      addBack: percentText(addBack),
      vatBack: vatBack.length === 0 ? 'none' : vatBack.map(percentText).join(' or '),
      vat: taxClass.vat,
      buckets: taxClass.buckets,
    })
  })

  it('states the revenue code and model of each seeded payment as the ruleset has them on 1 January, with the category its rule files to', () => {
    const rows = tableUnder('company/state-payments.md', 'Revenue codes')
    for (const year of new Set(rows.map((row) => Number(row.Year)))) {
      const on = civilDate(year, 1, 1)
      const codes = ruleValue('hr.state.revenue-codes', on).value
      const byCode = startingRules(on).flatMap((rule) => rule.conditions.flatMap((condition) => (condition.column === 'revenue_code' ? [[condition.code, rule.category] as const] : [])))
      expect(
        rows.filter((row) => Number(row.Year) === year).map((row) => [row.Code, row.Model, row.Category]),
        String(year),
      ).toEqual(byCode.map(([code, category]) => [code, codes.model.text, category]))
      expect(byCode.map(([code]) => code)).toEqual([codes.vatCode.text, codes.profitTaxCode.text, codes.pensionPillarOneCode.text])
    }
  })
})
