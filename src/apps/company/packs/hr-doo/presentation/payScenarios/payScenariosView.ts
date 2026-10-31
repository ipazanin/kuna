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
import { HUNDRED } from '../../domain/scenarios/marginalEuro'
import type { ScenarioNote, ScenarioOutcome, ScenarioWarning } from '../../domain/scenarios/scenarioOutcome'
import { scenarioName } from '../../domain/scenarios/startingScenarios'
import { figureDetail } from '../tracedFigureView'
import type { FigureDetail } from '../tracedFigureView'
import { words } from './words'

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
      why: words.needs.registered,
      action: { label: words.needs.setOnSettings, to: { path: '/company/settings', hash: '#company-registered' } },
    }
  }
  const employees = { path: '/company/salaries', hash: '#employee-rows' }
  if (workbook.director === null) {
    return {
      state: 'needs',
      need: words.needs.director,
      why: words.needs.directorWhy,
      action: { label: words.needs.addOnSalaries, to: employees },
    }
  }
  if (workbook.director.residenceCity === '') {
    return { state: 'needs', need: words.needs.city, why: words.needs.cityWhy, action: { label: words.needs.setOnSalaries, to: employees } }
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

export const SEGMENT_LABELS: Readonly<Record<SplitSegment, string>> = words.segments

export const GROUP_LABELS: Readonly<Record<LineGroup, string>> = words.groups

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

/** The lines of the comparison, worded when they are shown so an amount in a label follows the file's number format. */
function lineSpecs(): readonly LineSpec[] {
  return [
    { key: 'net-salary', label: words.lines['net-salary'], group: 'net', better: null, pick: (outcome) => outcome.netSalary },
    { key: 'tax-free', label: words.lines['tax-free'], group: 'net', better: null, pick: (outcome) => outcome.taxFree },
    { key: 'rent-after-tax', label: words.lines['rent-after-tax'], group: 'net', better: null, pick: (outcome) => outcome.rentAfterTax },
    { key: 'dividend-net', label: words.lines['dividend-net'], group: 'net', better: null, pick: (outcome) => outcome.dividend.net },
    { key: 'settlement', label: words.lines['settlement'], group: 'net', better: null, pick: (outcome) => outcome.settlementRefund },
    { key: 'own-contributions', label: words.lines['own-contributions'], group: 'net', better: null, pick: (outcome) => outcome.ownContributions },
    { key: 'net', label: words.lines['net'], group: 'net', better: 'higher', total: true, pick: (outcome) => outcome.netToOwner },
    { key: 'per-hundred', label: words.lines['per-hundred'](HUNDRED), group: 'net', better: 'higher', pick: (outcome) => outcome.netPerHundred },
    { key: 'pillar-two', label: words.lines['pillar-two'], group: 'pension', better: null, pick: (outcome) => outcome.taxes.pensionPillarTwo },
    { key: 'pillar-one', label: words.lines['pillar-one'], group: 'pension', better: null, pick: (outcome) => outcome.taxes.pensionPillarOne },
    { key: 'gross-two', label: words.lines['gross-two'], group: 'company', better: null, pick: (outcome) => outcome.grossTwo },
    { key: 'tax-free-cost', label: words.lines['tax-free-cost'], group: 'company', better: null, pick: (outcome) => outcome.taxFree },
    { key: 'rent', label: words.lines['rent'], group: 'company', better: null, pick: (outcome) => outcome.rent },
    { key: 'dividend', label: words.lines['dividend'], group: 'company', better: null, pick: (outcome) => outcome.dividend.gross },
    { key: 'corporate-tax', label: words.lines['corporate-tax'], group: 'company', better: null, pick: (outcome) => outcome.taxes.corporateTax },
    { key: 'company-cost', label: words.lines['company-cost'], group: 'company', better: null, total: true, pick: (outcome) => outcome.companyCost },
    { key: 'corporate-tax-without', label: words.lines['corporate-tax-without'], group: 'company', better: null, pick: (outcome) => outcome.corporateTaxWithoutOwnerPay },
    { key: 'corporate-tax-saved', label: words.lines['corporate-tax-saved'], group: 'company', better: 'higher', pick: (outcome) => outcome.corporateTaxSaved },
    { key: 'health', label: words.lines['health'], group: 'state', better: 'lower', pick: (outcome) => outcome.taxes.health },
    { key: 'income-tax', label: words.lines['income-tax'], group: 'state', better: 'lower', pick: (outcome) => outcome.taxes.incomeTaxWithheld },
    { key: 'settlement-change', label: words.lines['settlement-change'], group: 'state', better: 'lower', pick: (outcome) => outcome.taxes.settlementChange },
    { key: 'youth-relief', label: words.lines['youth-relief'], group: 'state', better: null, pick: (outcome) => outcome.taxes.youthRelief },
    { key: 'rent-tax', label: words.lines['rent-tax'], group: 'state', better: 'lower', pick: (outcome) => outcome.taxes.rentTax },
    { key: 'dividend-tax', label: words.lines['dividend-tax'], group: 'state', better: 'lower', pick: (outcome) => outcome.taxes.dividendTax },
    { key: 'state-corporate-tax', label: words.lines['state-corporate-tax'], group: 'state', better: 'lower', pick: (outcome) => outcome.taxes.corporateTax },
    { key: 'state', label: words.lines['state'], group: 'state', better: 'lower', total: true, pick: (outcome) => outcome.stateTake },
    { key: 'kept', label: words.lines['kept'], group: 'kept', better: null, pick: (outcome) => outcome.keptInCompany },
    { key: 'cash-after', label: words.lines['cash-after'], group: 'kept', better: 'higher', pick: (outcome) => outcome.cashAfter },
  ]
}

const ITEM_WORDS: Readonly<Record<string, string>> = words.items

/** A tax-free item as a sentence starts it. */
export function itemWords(item: string): string {
  return ITEM_WORDS[item] ?? item
}

export function warningText(warning: ScenarioWarning): string {
  switch (warning.kind) {
    case 'below-floor':
      return words.warnings.belowFloor(formatMoney(warning.agreed), formatMoney(warning.floor.amount))
    case 'cap-exceeded':
      return words.warnings.capExceeded(itemWords(warning.item), formatMoney(warning.paid.amount), formatMoney(warning.cap.amount), formatMoney(warning.excess.amount))
    case 'salary-dropped':
      return words.warnings.salaryDropped(
        dayLabel(warning.from),
        warning.grant,
        dayLabel(warning.requiredUntil),
        warning.atRisk === null || warning.atRisk.amount === 0 ? null : formatMoney(warning.atRisk.amount),
      )
    case 'dividend-above-capacity':
      return words.warnings.aboveCapacity(formatMoney(warning.dividend.amount), formatMoney(warning.distributable.amount))
    case 'net-assets-below-capital':
      return warning.netAssetsAfter.amount < 0
        ? words.warnings.belowZero(formatMoney(-warning.netAssetsAfter.amount), formatMoney(warning.shareCapital.amount))
        : words.warnings.belowCapital(formatMoney(warning.netAssetsAfter.amount), formatMoney(warning.shareCapital.amount))
    case 'cash-short':
      return words.warnings.cashShort(formatMoney(-warning.cashAfter.amount))
  }
}

export function noteText(note: ScenarioNote): string {
  switch (note.kind) {
    case 'tax-free-basis':
      return words.notes.taxFreeBasis(itemWords(note.item))
    case 'rent-basis':
      return words.notes.rentBasis
    case 'board-only':
      return words.notes.boardOnly
    case 'insured-elsewhere':
      return words.notes.insuredElsewhere
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
  const nameOf = (outcome: ScenarioOutcome) => scenarioName(outcome.scenario)

  const lines = lineSpecs().flatMap((spec): ComparedLine[] => {
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
