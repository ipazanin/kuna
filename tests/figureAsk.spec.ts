// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { figureTraceOf } from '../src/apps/company/packs/hr-doo/assistant/buildUpRead'
import { dividendCapacity } from '../src/apps/company/packs/hr-doo/domain/dividend/dividendCapacity'
import { forecastYear } from '../src/apps/company/packs/hr-doo/domain/forecast/forecastYear'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import type { HrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import { figureAsked } from '../src/apps/company/packs/hr-doo/presentation/figureAsk'
import { comparedScenarios, payState } from '../src/apps/company/packs/hr-doo/presentation/payScenarios/payScenariosView'
import { figureDetail } from '../src/apps/company/packs/hr-doo/presentation/tracedFigureView'
import { closedYearView } from '../src/apps/company/packs/hr-doo/presentation/yearEnd/closedYearView'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { readBuildUp } from '../src/shared/ai/application/chatReads'
import type { FigureTrace } from '../src/shared/ai/domain/chatElement'
import type { ChatBuildUp } from '../src/shared/ai/domain/chatRefs'
import { figuresIn } from '../src/shared/ai/domain/writtenFigures'
import { companyReadsOf, fakeCompanyBooks } from './fixtures/companyChatBooks'
import { civil } from './fixtures/ledger'
import { steadyStudio } from './fixtures/steadyStudio'

const WORKBOOK = steadyStudio()
const FIGURE = dividendCapacity(2026, forecastYear(WORKBOOK, 2026, civil('2026-10-19')), WORKBOOK).distributable
const NO_LINK = () => null

function buildUpOf(subtitle: string, employees = false): ChatBuildUp {
  const { about } = figureAsked(figureDetail(FIGURE, subtitle, [subtitle], NO_LINK, employees))
  if (about.kind !== 'build-up') throw new Error(`asked about a ${about.kind}`)
  return about
}

/** The arguments of each call to the function in a source file, by its balanced brackets. */
function callsIn(source: string, name: string): string[] {
  return [...source.matchAll(new RegExp(`\\b${name}\\(`, 'g'))].flatMap((match) => {
    if (source.slice(0, match.index).trimEnd().endsWith('function')) return []
    let depth = 0
    for (let at = match.index + name.length; at < source.length; at += 1) {
      if ('([{'.includes(source[at]!)) depth += 1
      if (')]}'.includes(source[at]!)) depth -= 1
      if (depth === 0) return [source.slice(match.index + name.length + 1, at)]
    }
    return []
  })
}

/** The fake company the browser build seeds, with the staff of the fake set named. */
function fakeBooks(staff: 'one-employee' | 'five-employees'): HrDooWorkbook {
  const document = fakeWorkbookDocument('2026-01-01T00:00:00.000Z', 'browser', fakeStaffOf(staff))
  return hrDooWorkbook(readDocument({ id: 'fake', source: 'browser', title: 'Fake workbook', syncedAt: '2026-01-01T00:00:00.000Z' }, document).workbook)
}

function labelsIn(trace: FigureTrace): string[] {
  return [trace.label, ...trace.steps.flatMap(labelsIn)]
}

describe('asking the chat about a figure on the page', () => {
  it("tags Company's build-up of the figure as the chat may hold it, with what the screen says it is of", () => {
    const asked = figureAsked(figureDetail(FIGURE, 'Scenario A, as the app works it out.', ['Scenario A'], NO_LINK))
    expect(asked.about).toEqual({ kind: 'build-up', app: 'company', trace: figureTraceOf(FIGURE), subtitle: 'Scenario A, as the app works it out.', employees: false })
  })

  it("names it by its title and what tells it apart, with no amount and none of the dialog's sentence", () => {
    const asked = figureAsked(figureDetail(FIGURE, 'Alex Example in Sep 2026, gross to net as the app works it out.', ['Alex Example', 'Sep 2026'], NO_LINK, true))
    expect(asked.label).toBe(`${FIGURE.label}, Alex Example, Sep 2026`)
    expect(figuresIn(asked.label)).toEqual([])
  })

  it('tells the same figure apart under two subtitles, so only the one asked takes the highlight', () => {
    const first = figureAsked(figureDetail(FIGURE, 'Scenario A', ['Scenario A'], NO_LINK))
    const second = figureAsked(figureDetail(FIGURE, 'Scenario B', ['Scenario B'], NO_LINK))
    expect(first.key).not.toBe(second.key)
  })

  it('reads the build-up the tag holds, by one ref for as long as the same tag stays', async () => {
    const reads = companyReadsOf(fakeCompanyBooks())
    const buildUp = buildUpOf('Scenario A')
    const ref = reads.refs.buildUpRef(buildUp)
    expect(reads.refs.buildUpRef(buildUp)).toBe(ref)
    const answer = await readBuildUp(ref, reads)
    expect(answer.isError).toBe(false)
    expect(JSON.parse(answer.text)).toMatchObject({ source: 'company/build-up', of: 'Scenario A', figure: { label: FIGURE.label } })
  })

  it("keeps an employee's pay figure home while Anonymise is on and asks to turn it off, and reads it once it is off", async () => {
    const buildUp = buildUpOf('Net pay of Ana Horvat, Sep 2026', true)
    const on = companyReadsOf(fakeCompanyBooks())
    const refused = await readBuildUp(on.refs.buildUpRef(buildUp), on)
    expect(refused.isError).toBe(true)
    expect(refused.text).toContain('turn Anonymise off')
    expect(refused.text).not.toContain('Horvat')
    const off = companyReadsOf(fakeCompanyBooks(), { anonymising: () => false })
    expect((await readBuildUp(off.refs.buildUpRef(buildUp), off)).isError).toBe(false)
  })

  it('marks every figure the salaries tab opens as naming employees, so Anonymise keeps it on the device', () => {
    const view = readFileSync(join(import.meta.dirname, '..', 'src/apps/company/packs/hr-doo/presentation/salaries/salariesView.ts'), 'utf8')
    const calls = callsIn(view, 'figureDetail')
    expect(calls.length).toBe(5)
    expect(calls.filter((call) => !/,\s*true\s*,?\s*$/.test(call))).toEqual([])
  })
})

describe("the staff's pay inside a scenario's or a year end's figures", () => {
  const staffed = fakeBooks('five-employees')
  const alone = fakeBooks('one-employee')

  it("counts every employee's salaries in the scenarios' company figures and cells, so they are marked while others are paid", () => {
    const pay = payState(staffed, 2027, civil('2026-11-07'))
    if (pay.state !== 'ready') throw new Error(`the pay tab is ${pay.state}`)
    expect(pay.staffPay).toBe(true)
    expect(labelsIn(figureTraceOf(pay.figures.company.profitBeforeOwnerPay)).some((label) => label.startsWith('Salary net'))).toBe(true)
    const chosen = pay.figures.entries.map((entry) => entry.scenario.slug)
    const { lines } = comparedScenarios(pay.figures, chosen, chosen[0]!, NO_LINK, pay.staffPay)
    const cells = lines.flatMap((line) => line.cells)
    expect(cells.length).toBeGreaterThan(0)
    expect(cells.filter((cell) => !cell.detail.employees)).toEqual([])
  })

  it('leaves them unmarked when the owner is the only one paid', () => {
    const pay = payState(alone, 2027, civil('2026-11-07'))
    if (pay.state !== 'ready') throw new Error(`the pay tab is ${pay.state}`)
    expect(pay.staffPay).toBe(false)
    const chosen = pay.figures.entries.map((entry) => entry.scenario.slug)
    expect(comparedScenarios(pay.figures, chosen, chosen[0]!, NO_LINK, pay.staffPay).lines.flatMap((line) => line.cells.filter((cell) => cell.detail.employees))).toEqual([])
  })

  it("counts the personnel costs in a year end's open items, so they are marked while others are paid", () => {
    const staffedItems = closedYearView(staffed, 2025, NO_LINK, {}).openItems.flatMap((item) => (item.detail === null ? [] : [item.detail]))
    expect(staffedItems.some((detail) => labelsIn(figureTraceOf(detail.figure)).includes('Personnel costs'))).toBe(true)
    expect(staffedItems.filter((detail) => !detail.employees)).toEqual([])
    const aloneItems = closedYearView(alone, 2025, NO_LINK, {}).openItems.flatMap((item) => (item.detail === null ? [] : [item.detail]))
    expect(aloneItems.length).toBeGreaterThan(0)
    expect(aloneItems.filter((detail) => detail.employees)).toEqual([])
  })
})
