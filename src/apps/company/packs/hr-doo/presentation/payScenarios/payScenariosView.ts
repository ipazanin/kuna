import type { RouteLocationRaw } from 'vue-router'

import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import type { DrillTarget } from '../../../../filters/domain/drillTarget'
import type { HrDooWorkbook } from '../../domain/hrDooPart'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { Money } from '../../../../../../shared/money/money'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { payScenarios } from '../../domain/scenarios/payScenarios'
import type { PayScenarios } from '../../domain/scenarios/payScenarios'
import type { ScenarioNote, ScenarioOutcome, ScenarioWarning } from '../../domain/scenarios/scenarioOutcome'
import { figureDetail } from '../tracedFigureView'
import type { FigureDetail } from '../tracedFigureView'

/** The pay scenarios of a year, the fact their figures wait for and where it is set, or why they could not be worked out. */
export type PayState =
  | { readonly state: 'needs'; readonly need: string; readonly why: string; readonly action: { readonly label: string; readonly to: RouteLocationRaw } }
  | { readonly state: 'failed'; readonly failure: string }
  | { readonly state: 'ready'; readonly figures: PayScenarios }

export function payState(workbook: HrDooWorkbook, year: number, asOf: CivilDate): PayState {
  if (workbook.companyFacts.companyRegistered === null) {
    return {
      state: 'needs',
      need: 'hr_company_registered',
      why: 'The tax periods and the corporate tax count from the day the company was registered.',
      action: { label: 'Set it on Settings', to: { path: '/settings', hash: '#company-registered' } },
    }
  }
  const employees = { path: '/company/salaries', hash: '#employee-rows' }
  if (workbook.director === null) {
    return {
      state: 'needs',
      need: 'a director on the employees tab',
      why: "The director's row holds where you live, pillar II and your dependants, which the salary of each scenario is worked out on.",
      action: { label: 'Add it on Salaries', to: employees },
    }
  }
  if (workbook.director.residenceCity === '') {
    return { state: 'needs', need: "the director's city", why: 'Your city of residence sets the income tax rates of the salary.', action: { label: 'Set it on Salaries', to: employees } }
  }
  try {
    return { state: 'ready', figures: payScenarios(workbook, year, asOf) }
  } catch (failure) {
    if (failure instanceof RangeError) {
      return { state: 'failed', failure: failure.message }
    }
    throw failure
  }
}

export interface ComparedCell {
  readonly cents: number
  readonly best: boolean
  /** Against the comparison base, or null in the base's own column. */
  readonly vsBase: number | null
  readonly detail: FigureDetail
}

export type LineGroup = 'net' | 'pension' | 'company' | 'state' | 'kept'

export interface ComparedLine {
  readonly key: string
  readonly label: string
  readonly group: LineGroup
  readonly total: boolean
  readonly cells: readonly ComparedCell[]
}

export interface ScenarioColumn {
  readonly slug: string
  readonly label: string
  readonly isBase: boolean
  readonly warnings: readonly string[]
  readonly notes: readonly string[]
}

/** One bar of the 100% split: each part of the profit before owner pay, in cents. */
export interface ScenarioSplit {
  readonly label: string
  readonly whole: Money
  readonly parts: readonly { readonly segment: SplitSegment; readonly cents: number }[]
}

export type SplitSegment = 'net' | 'pillar-two' | 'pillar-one' | 'health' | 'income-tax' | 'rent-tax' | 'dividend-tax' | 'corporate-tax' | 'kept'

export const SEGMENT_LABELS: Readonly<Record<SplitSegment, string>> = {
  net: 'Net to you',
  'pillar-two': 'Pension pillar II, your savings',
  'pillar-one': 'Pension pillar I',
  health: 'Health insurance',
  'income-tax': 'Income tax',
  'rent-tax': 'Rent tax',
  'dividend-tax': 'Dividend tax',
  'corporate-tax': 'Corporate tax',
  kept: 'Kept in the company',
}

export const GROUP_LABELS: Readonly<Record<LineGroup, string>> = {
  net: 'Net to you',
  pension: 'Pension, shown apart from net',
  company: 'Cost to the company',
  state: 'Taxes and contributions by type',
  kept: 'What the company keeps',
}

/** Which way a line is better, or null for a line that only informs. */
type Better = 'higher' | 'lower' | null

interface LineSpec {
  readonly key: string
  readonly label: string
  readonly group: LineGroup
  readonly better: Better
  readonly total?: true
  readonly pick: (outcome: ScenarioOutcome) => TracedFigure | null
}

const LINES: readonly LineSpec[] = [
  { key: 'net-salary', label: 'Net salary', group: 'net', better: null, pick: (outcome) => outcome.netSalary },
  { key: 'tax-free', label: 'Tax-free items', group: 'net', better: null, pick: (outcome) => outcome.taxFree },
  { key: 'rent-after-tax', label: 'Rent after the rent tax', group: 'net', better: null, pick: (outcome) => outcome.rentAfterTax },
  { key: 'dividend-net', label: 'Dividend after its tax', group: 'net', better: null, pick: (outcome) => outcome.dividend.net },
  { key: 'settlement', label: 'Annual settlement, refund or extra', group: 'net', better: null, pick: (outcome) => outcome.settlementRefund },
  { key: 'own-contributions', label: 'Contributions you pay yourself', group: 'net', better: null, pick: (outcome) => outcome.ownContributions },
  { key: 'net', label: 'Net to you', group: 'net', better: 'higher', total: true, pick: (outcome) => outcome.netToOwner },
  { key: 'per-hundred', label: 'Net to you of each 100.00 of profit before owner pay', group: 'net', better: 'higher', pick: (outcome) => outcome.netPerHundred },
  { key: 'pillar-two', label: 'Pension pillar II, your own savings', group: 'pension', better: null, pick: (outcome) => outcome.taxes.pensionPillarTwo },
  { key: 'pillar-one', label: 'Pension pillar I, your pension rights', group: 'pension', better: null, pick: (outcome) => outcome.taxes.pensionPillarOne },
  { key: 'gross-two', label: 'Gross II, salary and health', group: 'company', better: null, pick: (outcome) => outcome.grossTwo },
  { key: 'tax-free-cost', label: 'Tax-free items', group: 'company', better: null, pick: (outcome) => outcome.taxFree },
  { key: 'rent', label: 'Rent', group: 'company', better: null, pick: (outcome) => outcome.rent },
  { key: 'dividend', label: 'Dividend paid out', group: 'company', better: null, pick: (outcome) => outcome.dividend.gross },
  { key: 'corporate-tax', label: 'Corporate tax', group: 'company', better: null, pick: (outcome) => outcome.taxes.corporateTax },
  { key: 'company-cost', label: 'Total cost to the company', group: 'company', better: null, total: true, pick: (outcome) => outcome.companyCost },
  { key: 'corporate-tax-without', label: 'Corporate tax with no owner pay deducted', group: 'company', better: null, pick: (outcome) => outcome.corporateTaxWithoutOwnerPay },
  { key: 'corporate-tax-saved', label: 'Corporate tax the deductible pay saves', group: 'company', better: 'higher', pick: (outcome) => outcome.corporateTaxSaved },
  { key: 'health', label: 'Health insurance', group: 'state', better: 'lower', pick: (outcome) => outcome.taxes.health },
  { key: 'income-tax', label: 'Income tax withheld in the months', group: 'state', better: 'lower', pick: (outcome) => outcome.taxes.incomeTaxWithheld },
  { key: 'settlement-change', label: 'Annual settlement, extra tax less refund', group: 'state', better: 'lower', pick: (outcome) => outcome.taxes.settlementChange },
  { key: 'youth-relief', label: 'Youth relief, inside the settlement', group: 'state', better: null, pick: (outcome) => outcome.taxes.youthRelief },
  { key: 'rent-tax', label: 'Rent tax', group: 'state', better: 'lower', pick: (outcome) => outcome.taxes.rentTax },
  { key: 'dividend-tax', label: 'Dividend tax', group: 'state', better: 'lower', pick: (outcome) => outcome.taxes.dividendTax },
  { key: 'state-corporate-tax', label: 'Corporate tax', group: 'state', better: 'lower', pick: (outcome) => outcome.taxes.corporateTax },
  { key: 'state', label: 'Taken by the state, pillar I included, pillar II apart', group: 'state', better: 'lower', total: true, pick: (outcome) => outcome.stateTake },
  { key: 'kept', label: 'Kept in the company', group: 'kept', better: null, pick: (outcome) => outcome.keptInCompany },
  { key: 'cash-after', label: 'Cash left after the year and the payout', group: 'kept', better: 'higher', pick: (outcome) => outcome.cashAfter },
]

const ITEM_WORDS: Readonly<Record<string, string>> = {
  'results-bonus': 'A results bonus',
  'occasional-gift': 'An occasional gift',
  'meal-allowance-flat': 'A flat meal allowance',
  'meals-on-invoices': 'Meals on invoices',
  'supplementary-health-insurance': 'Supplementary health insurance',
  'holiday-services': 'Holiday services',
  'child-gift': 'A gift to a child',
}

/** A tax-free item as a sentence starts it. */
export function itemWords(item: string): string {
  return ITEM_WORDS[item] ?? item
}

export function warningText(warning: ScenarioWarning): string {
  switch (warning.kind) {
    case 'below-floor':
      return `The salary of ${formatMoney(warning.agreed)} a month is below the director floor of ${formatMoney(warning.floor.amount)}, so the payroll pays the floor.`
    case 'cap-exceeded':
      return `${itemWords(warning.item)} of ${formatMoney(warning.paid.amount)} is over its yearly cap of ${formatMoney(warning.cap.amount)}. The ${formatMoney(warning.excess.amount)} over it is taxed as salary.`
    case 'salary-dropped':
      return `The salary stops on ${dayLabel(warning.from)}, but ${warning.grant} requires the employment until ${dayLabel(warning.requiredUntil)}.${warning.atRisk === null || warning.atRisk.amount === 0 ? '' : ` Its terms can claw back ${formatMoney(warning.atRisk.amount)} then.`}`
    case 'dividend-above-capacity':
      return `The dividend of ${formatMoney(warning.dividend.amount)} is above the ${formatMoney(warning.distributable.amount)} the year can pay out.`
    case 'net-assets-below-capital':
      return warning.netAssetsAfter.amount < 0
        ? `After the payout, net assets fall to ${formatMoney(-warning.netAssetsAfter.amount)} below zero, under the share capital of ${formatMoney(warning.shareCapital.amount)}.`
        : `After the payout, net assets of ${formatMoney(warning.netAssetsAfter.amount)} fall below the share capital of ${formatMoney(warning.shareCapital.amount)}.`
    case 'cash-short':
      return `Cash would not cover the year: ${formatMoney(-warning.cashAfter.amount)} short after the owner pay, the corporate tax and the dividend paid in cash.`
  }
}

export function noteText(note: ScenarioNote): string {
  switch (note.kind) {
    case 'tax-free-basis':
      return `${itemWords(note.item)} needs a real basis, such as a written decision or the invoices, before it is paid tax free.`
    case 'rent-basis':
      return 'Rent needs real business space at a market rent, and one story with any commuting or work-from-home allowance.'
    case 'board-only':
      return 'As a board member only, you pay these contributions yourself on the average wage, set by a tax office decision. They are not a company cost. A part month is prorated by calendar days, which is an assumption.'
    case 'insured-elsewhere':
      return 'Insured through a job elsewhere, the yearly difference to the director floor is taken as nothing, which holds while that pay is at least the floor. That pay is not counted here.'
  }
}

export interface ShownScenarios {
  readonly columns: readonly ScenarioColumn[]
  readonly lines: readonly ComparedLine[]
  readonly splits: readonly ScenarioSplit[]
}

/** The chosen scenarios side by side, the base first, each line with its one best value marked and every figure opening its build-up. */
export function comparedScenarios(result: PayScenarios, chosen: readonly string[], base: string, link: (drill: DrillTarget | null) => RouteLocationRaw | null): ShownScenarios {
  const outcomes = result.entries.flatMap((entry) => (entry.kind === 'outcome' && chosen.includes(entry.scenario.slug) ? [entry.outcome] : []))
  const ordered = [...outcomes.filter((outcome) => outcome.scenario.slug === base), ...outcomes.filter((outcome) => outcome.scenario.slug !== base)]
  const baseOutcome = ordered[0]?.scenario.slug === base ? ordered[0] : null
  const nameOf = (outcome: ScenarioOutcome) => outcome.scenario.label || outcome.scenario.slug

  const lines = LINES.flatMap((spec): ComparedLine[] => {
    const figures = ordered.map((outcome) => spec.pick(outcome))
    if (figures.some((figure) => figure === null) || figures.every((figure) => figure?.amount === 0)) {
      return []
    }
    const amounts = figures.map((figure) => figure?.amount ?? 0)
    const extreme = spec.better === null || new Set(amounts).size < 2 ? null : spec.better === 'higher' ? Math.max(...amounts) : Math.min(...amounts)
    // A best shared by several scenarios tells nothing apart, so only a single best is marked.
    const best = extreme !== null && amounts.filter((amount) => amount === extreme).length === 1 ? extreme : null
    const baseFigure = baseOutcome === null ? null : spec.pick(baseOutcome)
    return [
      {
        key: spec.key,
        label: spec.label,
        group: spec.group,
        total: spec.total === true,
        cells: ordered.map((outcome, index): ComparedCell => {
          const figure = figures[index] as TracedFigure
          return {
            cents: figure.amount,
            best: best !== null && figure.amount === best,
            vsBase: baseFigure === null || outcome === baseOutcome ? null : figure.amount - baseFigure.amount,
            detail: figureDetail(figure, nameOf(outcome), link),
          }
        }),
      },
    ]
  })

  const columns = ordered.map((outcome): ScenarioColumn => ({
    slug: outcome.scenario.slug,
    label: nameOf(outcome),
    isBase: outcome === baseOutcome,
    warnings: outcome.warnings.map(warningText),
    notes: outcome.notes.map(noteText),
  }))
  const splits = ordered.map((outcome): ScenarioSplit => ({
    label: nameOf(outcome),
    whole: outcome.profitBeforeOwnerPay.amount,
    parts: [
      { segment: 'net', cents: outcome.netToOwner.amount },
      { segment: 'pillar-two', cents: outcome.taxes.pensionPillarTwo.amount },
      { segment: 'pillar-one', cents: outcome.taxes.pensionPillarOne.amount },
      { segment: 'health', cents: outcome.taxes.health.amount },
      { segment: 'income-tax', cents: outcome.taxes.incomeTaxWithheld.amount + outcome.taxes.settlementChange.amount },
      { segment: 'rent-tax', cents: outcome.taxes.rentTax.amount },
      { segment: 'dividend-tax', cents: outcome.taxes.dividendTax.amount },
      { segment: 'corporate-tax', cents: outcome.taxes.corporateTax.amount },
      { segment: 'kept', cents: outcome.keptInCompany.amount },
    ],
  }))
  return { columns, lines, splits }
}
