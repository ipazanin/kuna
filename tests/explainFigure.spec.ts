import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { runTask } from '../src/shared/ai/application/runTask'
import type { ModelPort, ModelRequest } from '../src/shared/ai/application/modelPort'
import type { AiTextPart } from '../src/shared/ai/domain/aiTask'
import { citedInputOf, explainFigure } from '../src/apps/company/packs/hr-doo/assist/application/explainFigure'
import { drillToTransactions } from '../src/apps/company/filters/domain/drillTarget'
import { dividendCapacity } from '../src/apps/company/packs/hr-doo/domain/dividend/dividendCapacity'
import { forecastYear } from '../src/apps/company/packs/hr-doo/domain/forecast/forecastYear'
import { sourcesCheckedSince } from '../src/apps/company/packs/hr-doo/ruleset/ruleset'
import { NAMES_A_PARTY } from '../src/apps/company/packs/hr-doo/ruleset/tracedFigure'
import type { TracedFigure } from '../src/apps/company/packs/hr-doo/ruleset/tracedFigure'
import { payScenarios } from '../src/apps/company/packs/hr-doo/domain/scenarios/payScenarios'
import { director } from './fixtures/employees'
import { exampleStudio } from './fixtures/exampleStudio'
import { civil } from './fixtures/ledger'
import { invoiceOf, planRow } from './fixtures/billingPlan'
import { STEADY_ROWS, steadyStudio } from './fixtures/steadyStudio'

const workbook = steadyStudio()
const FIGURE = dividendCapacity(2026, forecastYear(workbook, 2026, civil('2026-10-19')), workbook).distributable
const INPUT = { figure: FIGURE, subtitle: 'Dividend for 2026' }

function sentText(): string {
  return explainFigure
    .input(INPUT)
    .map((part) => (part as AiTextPart).text)
    .join('\n')
}

function nodes(figure: TracedFigure, ref = 'f'): [string, TracedFigure][] {
  return [[ref, figure], ...figure.steps.flatMap((step, index) => nodes(step, `${ref}.${index}`))]
}

function isRow(figure: TracedFigure): boolean {
  const amount = figure.drill?.filters.amount
  return amount !== undefined && amount.min === amount.max
}

function withoutRows(figure: TracedFigure): TracedFigure {
  return { ...figure, steps: figure.steps.filter((step) => !isRow(step)).map(withoutRows) }
}

function answering(answer: unknown): ModelPort & { readonly sent: ModelRequest[] } {
  const sent: ModelRequest[] = []
  return {
    sent,
    readsPdf: true,
    model: { name: 'Sonnet 5.5', price: { inputPerMillion: 2, cacheReadPerMillion: 0.1, cacheWritePerMillion: 2.5, outputPerMillion: 10 } },
    async send(request) {
      sent.push(request)
      return { kind: 'answer', text: JSON.stringify(answer), raw: null, tokens: { input: 6000, cacheRead: 0, cacheWrite: 0, output: 1500 } }
    },
  }
}

/** Every traced figure anywhere in what a forecast returns, each with its steps. */
function figuresWithin(value: unknown, seen = new Set<unknown>()): TracedFigure[] {
  if (typeof value !== 'object' || value === null || seen.has(value)) return []
  seen.add(value)
  const found = 'steps' in value && 'label' in value ? [value as TracedFigure] : []
  const inner = value instanceof Map ? [...value.values()] : Object.values(value)
  return [...found, ...inner.flatMap((entry) => figuresWithin(entry, seen))]
}

describe('what Explain sends for a figure', () => {
  it('carries the upper steps of the tree with their refs and amounts', () => {
    const tree = JSON.parse(sentText().split('\n')[1]!)
    const sent: [string, string][] = []
    const walk = (node: { ref: string; amount: string; steps: unknown[] }) => {
      sent.push([node.ref, node.amount])
      node.steps.forEach((step) => walk(step as typeof node))
    }
    walk(tree)
    const all = new Map(nodes(withoutRows(FIGURE)).map(([ref, node]) => [ref, (node.amount / 100).toFixed(2)]))
    expect(sent.length).toBeGreaterThan(1)
    expect(sent.filter(([ref, amount]) => all.get(ref) !== amount)).toEqual([])
  })

  it("carries every cited rule's terms, sources and confidence, and the day the rules were checked", () => {
    const rules = JSON.parse(/Rules:\n(.*)\n/.exec(sentText())![1]!) as { id: string; terms: object | null; sources: unknown[]; confidence: string }[]
    const cited = new Set(nodes(withoutRows(FIGURE)).flatMap(([, node]) => node.rules.map((citation) => citation.ruleId)))
    expect(new Set(rules.map((rule) => rule.id))).toEqual(cited)
    expect(rules.every((rule) => rule.terms !== null && rule.sources.length > 0 && rule.confidence !== '')).toBe(true)
    expect(sentText()).toContain(`sources were last checked on ${sourcesCheckedSince()}`)
  })

  it('sends no ledger row behind the figure', () => {
    const text = sentText()
    for (const row of STEADY_ROWS) {
      if (row.description) expect(text).not.toContain(row.description)
      if (row.iban) expect(text).not.toContain(row.iban)
      if (row.counterparty) expect(text).not.toContain(row.counterparty)
    }
    expect(text).not.toContain('drill')
    // Each fixture row carries a statement reference, which only a ledger row would bring.
    expect(text).not.toMatch(/REF-\d/)
  })

  it('leaves out a row-level step and counts it on the step above', () => {
    const row = { ...FIGURE, label: 'Ana Horvat on', drill: drillToTransactions({ amount: { min: FIGURE.amount, max: FIGURE.amount } }), steps: [] }
    const sum = { ...FIGURE, label: 'Costs', steps: [row, { ...row, label: 'Kept', drill: null }] }
    const text = explainFigure
      .input({ figure: sum, subtitle: 'x' })
      .map((part) => (part as AiTextPart).text)
      .join('\n')
    expect(text).not.toContain('Ana Horvat')
    const tree = JSON.parse(text.split('\n')[1]!)
    expect(tree.stepsLeftOut).toBe(1)
    expect(tree.steps.map((step: { label: string }) => step.label)).toEqual(['Kept'])
    expect(citedInputOf({ figure: sum, subtitle: 'x' }).figures.has('f.1')).toBe(false)
  })

  it('stays within the cap on the largest figures of the Pay tab, with whole levels sent', () => {
    const owner = director()
    const { company, marginal } = payScenarios(exampleStudio({ employees: [owner], director: owner }), 2026, civil('2026-10-19'))
    const figures = [company.cashBeforeOwnerPay, company.profitBeforeOwnerPay, company.retainedBroughtIn, company.ownerPayInForecast, ...marginal.map((route) => route.net)]
    expect(nodes(company.cashBeforeOwnerPay).length).toBeGreaterThan(1000)
    for (const figure of figures) {
      const text = explainFigure
        .input({ figure, subtitle: 'x' })
        .map((part) => (part as AiTextPart).text)
        .join('\n')
      // The model loop counts three characters a token, so this is 30,000 tokens against a task's cap of 100,000 a request.
      expect(text.length).toBeLessThan(90_000)
      expect(citedInputOf({ figure, subtitle: 'x' }).figures.size).toBeLessThanOrEqual(300)
    }
  })

  it("checks the answer against the tree's refs and amounts and the cited rules", async () => {
    const [ruleId] = citedInputOf(INPUT).sources
    const total = (Math.abs(FIGURE.amount) / 100).toFixed(2)
    const result = await runTask(explainFigure, INPUT, {
      model: answering({
        parts: [
          { text: `It comes to ${total}.`, sources: [ruleId], figures: ['f'] },
          { text: 'Made up.', sources: ['hr.made.up'], figures: [] },
        ],
        ownKnowledge: null,
      }),
      appOn: true,
      employees: { sends: false, anonymising: true },
    })
    expect(result).toMatchObject({ kind: 'draft', draft: { parts: [{ figures: [{ ref: 'f', cents: FIGURE.amount }], strayFigure: false }], partlyUnchecked: true } })
  })

  it('sends nothing for a salary figure while Anonymise is on', async () => {
    const model = answering({ parts: [], ownKnowledge: null })
    expect(await runTask(explainFigure, INPUT, { model, appOn: true, employees: { sends: true, anonymising: true } })).toEqual({ kind: 'switched-off', which: 'employees' })
    expect(model.sent).toEqual([])
  })

  it('marks every figure the salaries tab opens as naming employees, so Anonymise keeps it on the device', () => {
    const view = readFileSync(join(import.meta.dirname, '..', 'src/apps/company/packs/hr-doo/presentation/salaries/salariesView.ts'), 'utf8')
    const calls = view.match(/figureDetail\([^\n]*\)/g) ?? []
    expect(calls.length).toBe(5)
    expect(calls.filter((call) => !call.endsWith(', true)'))).toEqual([])
  })

  it("takes the amounts and rates its own labels and subtitle write out as Kuna's", () => {
    const figure = { ...FIGURE, label: 'Income tax at 33%, over 1.234,56 EUR', steps: [] }
    const sent = citedInputOf({ figure, subtitle: 'Limit of 900,00 €' })
    expect(sent.rates.has(3300)).toBe(true)
    expect(sent.amounts.has(123456)).toBe(true)
    expect(sent.amounts.has(90000)).toBe(true)
  })

  describe('a step that names a client or an invoice item', () => {
    const CLIENT = 'Northwind Analytics'
    const ITEM = 'Plane Tickets'
    const owner = director()
    const books = exampleStudio({
      employees: [owner],
      director: owner,
      clients: [{ slug: 'north', name: CLIENT, ibans: [], invoicing: {} }] as never,
      billingPlan: [planRow(ITEM, '2026-11-15', 1000), planRow(ITEM, '2026-03-15', 1000)],
      invoices: [invoiceOf('7-2026', 1000, '2026-06-30')],
    })
    const { company } = payScenarios(books, 2026, civil('2026-10-19'))
    const year = forecastYear(books, 2026, civil('2026-10-19'))

    function explained(figure: TracedFigure): string {
      return explainFigure
        .input({ figure, subtitle: 'x' })
        .map((part) => (part as AiTextPart).text)
        .join('\n')
    }

    it('is marked wherever a forecast makes it', () => {
      const named = figuresWithin(year).filter((figure) => figure.label.includes(CLIENT) || figure.label.includes(ITEM))
      expect(named.some((figure) => figure.label.endsWith('billable'))).toBe(true)
      expect(named.some((figure) => !figure.label.endsWith('billable'))).toBe(true)
      expect(named.filter((figure) => figure[NAMES_A_PARTY] !== true).map((figure) => figure.label)).toEqual([])
    })

    it('stays home and is counted on the step above', () => {
      const [billable] = nodes(company.profitBeforeOwnerPay).filter(([, node]) => node.label.includes(CLIENT))
      const step = billable![1]
      const sum = { ...FIGURE, label: 'Planned revenue', drill: null, steps: [step, { ...step, label: 'Kept', [NAMES_A_PARTY]: undefined }] } as TracedFigure
      const text = explained(sum)
      expect(text).not.toContain(CLIENT)
      expect(text).not.toContain(ITEM)
      const tree = JSON.parse(text.split('\n')[1]!)
      expect(tree.stepsLeftOut).toBe(1)
      expect(tree.steps.map((sent: { label: string }) => sent.label)).toEqual(['Kept'])
    })

    it('does not reach the largest figures on small books', () => {
      for (const figure of [company.profitBeforeOwnerPay, company.cashBeforeOwnerPay]) {
        expect(explained(figure)).not.toContain(CLIENT)
      }
    })

    it('keeps its mark out of what the figure digest and JSON read', () => {
      const [billable] = nodes(company.profitBeforeOwnerPay).filter(([, node]) => node.label.includes(CLIENT))
      const step = billable![1]
      expect(step[NAMES_A_PARTY]).toBe(true)
      expect(Object.keys(step).sort()).toEqual(['amount', 'basis', 'drill', 'label', 'on', 'rules', 'steps'])
      expect({ ...step }[NAMES_A_PARTY]).toBe(true)
    })
  })
})
