import { describe, expect, it } from 'vitest'

import { drillToTransactions } from '../src/apps/company/filters/domain/drillTarget'
import { HR_DOO_TRACE_RULES, figureTraceOf, stepsByRef } from '../src/apps/company/packs/hr-doo/assistant/buildUpRead'
import { dividendCapacity } from '../src/apps/company/packs/hr-doo/domain/dividend/dividendCapacity'
import { forecastYear } from '../src/apps/company/packs/hr-doo/domain/forecast/forecastYear'
import { payScenarios } from '../src/apps/company/packs/hr-doo/domain/scenarios/payScenarios'
import { RULES, citedVersion, sourcesCheckedSince } from '../src/apps/company/packs/hr-doo/ruleset/ruleset'
import { NAMES_A_PARTY } from '../src/apps/company/packs/hr-doo/ruleset/tracedFigure'
import type { TracedFigure } from '../src/apps/company/packs/hr-doo/ruleset/tracedFigure'
import type { FigureTrace } from '../src/shared/ai/domain/chatElement'
import { director } from './fixtures/employees'
import { exampleStudio } from './fixtures/exampleStudio'
import { civil } from './fixtures/ledger'
import { steadyStudio } from './fixtures/steadyStudio'

const WORKBOOK = steadyStudio()
const DIVIDEND = dividendCapacity(2026, forecastYear(WORKBOOK, 2026, civil('2026-10-19')), WORKBOOK).distributable

function eachStep(trace: FigureTrace): FigureTrace[] {
  return stepsByRef(trace).map(([, step]) => step)
}

/** A sum over one ledger row, a step naming a client, and a step that does neither. */
function sumWithParties(): TracedFigure {
  const row = { ...DIVIDEND, label: 'Ana Horvat on', drill: drillToTransactions({ amount: { min: DIVIDEND.amount, max: DIVIDEND.amount } }), steps: [] }
  const client = { ...DIVIDEND, label: 'Example Client Ltd', drill: null, steps: [], [NAMES_A_PARTY]: true as const }
  return { ...DIVIDEND, label: 'Costs', steps: [row, client, { ...row, label: 'Kept', drill: null }] }
}

describe("a figure's build-up as the chat holds it", () => {
  it('leaves out a step for one row and a step that names a party, and counts both on the step above', () => {
    const trace = figureTraceOf(sumWithParties())
    expect(trace.steps.map((step) => step.label)).toEqual(['Kept'])
    expect(trace.stepsLeftOut).toBe(2)
    expect(JSON.stringify(trace)).not.toMatch(/Ana Horvat|Example Client/)
  })

  it('keeps no drill, so no ledger filter reaches the chat', () => {
    const trace = figureTraceOf(DIVIDEND)
    expect(JSON.stringify(trace)).not.toContain('drill')
    expect(eachStep(trace).every((step) => Object.keys(step).sort().join() === 'amount,basis,label,on,rules,steps,stepsLeftOut')).toBe(true)
  })

  it('keeps each amount and day as computed', () => {
    const trace = figureTraceOf(DIVIDEND)
    expect(trace.amount).toBe(DIVIDEND.amount)
    expect(trace.on).toBe(DIVIDEND.on)
  })

  it('goes down only in whole levels that fit in 300 steps, and counts what it cut', () => {
    const owner = director()
    const { company } = payScenarios(exampleStudio({ employees: [owner], director: owner }), 2026, civil('2026-10-19'))
    const trace = figureTraceOf(company.cashBeforeOwnerPay)
    expect(eachStep(trace).length).toBeLessThanOrEqual(300)
    expect(eachStep(trace).some((step) => step.stepsLeftOut > 0)).toBe(true)
  })

  it('cites each rule by an id the ruleset holds and the first day of the version it rests on', () => {
    const cited = eachStep(figureTraceOf(DIVIDEND)).flatMap((step) => step.rules)
    expect(cited.length).toBeGreaterThan(0)
    expect(cited.filter((citation) => citedVersion(citation.id, citation.validFrom) === null)).toEqual([])
    expect(cited.every((citation) => RULES.some((rule) => rule.id === citation.id))).toBe(true)
  })
})

describe('the rules behind a build-up', () => {
  it('gives each step a ref by its place in the tree, the figure first', () => {
    const trace = figureTraceOf(sumWithParties())
    expect(stepsByRef(trace).map(([ref]) => ref)).toEqual(['f', 'f.0'])
  })

  it('gives each cited version once, with its terms, sources and confidence', () => {
    const trace = figureTraceOf(DIVIDEND)
    const versions = HR_DOO_TRACE_RULES.versionsOf(trace) as readonly { id: string; validFrom: string; terms: object | null; sources: unknown[]; confidence: string }[]
    const cited = new Set(eachStep(trace).flatMap((step) => step.rules.map((citation) => `${citation.id} ${citation.validFrom}`)))
    expect(versions.map((version) => `${version.id} ${version.validFrom}`)).toEqual([...cited])
    expect(versions.every((version) => version.terms !== null && version.sources.length > 0 && version.confidence !== '')).toBe(true)
  })

  it('sends a long table as its size alone', () => {
    const localRates = {
      label: 'Local income tax',
      on: null,
      amount: DIVIDEND.amount,
      basis: 'assumption',
      rules: [{ id: 'hr.pit.local-rates', validFrom: RULES.find((rule) => rule.id === 'hr.pit.local-rates')!.versions[0]!.validFrom }],
      steps: [],
      stepsLeftOut: 0,
    }
    const text = JSON.stringify(HR_DOO_TRACE_RULES.versionsOf(localRates))
    expect(text).toContain('"leftOut":true')
    expect(text.length).toBeLessThan(20_000)
  })

  it('says when the rules were last checked', () => {
    expect(HR_DOO_TRACE_RULES.checkedSince).toBe(sourcesCheckedSince())
  })
})
