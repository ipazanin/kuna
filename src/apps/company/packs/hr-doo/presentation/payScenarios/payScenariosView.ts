import type { RouteLocationRaw } from 'vue-router'

import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import type { DrillTarget } from '../../../../filters/domain/drillTarget'
import type { HrDooWorkbook } from '../../domain/hrDooPart'
import { paysBesidesOwner } from '../../domain/employees/employees'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { addMoney, negateMoney, subtractMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { payScenarios } from '../../domain/scenarios/payScenarios'
import type { PayScenarios } from '../../domain/scenarios/payScenarios'
import { HUNDRED } from '../../domain/scenarios/marginalEuro'
import type { ScenarioNote, ScenarioOutcome, ScenarioWarning } from '../../domain/scenarios/scenarioOutcome'
import { scenarioName } from '../../domain/scenarios/startingScenarios'
import type { ComparedCell, ComparedColumn, ComparedLine } from '../../../../../../shared/ui/ScenarioComparison.vue'
import { figureDetail } from '../tracedFigureView'
import type { AskableDetail } from '../tracedFigureView'
import { words } from './words'

/** The pay scenarios of a year, the fact their figures wait for and where it is set, or why they could not be worked out. */
export type PayState =
  | { readonly state: 'needs'; readonly need: string; readonly why: string; readonly action: { readonly label: string; readonly to: RouteLocationRaw } }
  | { readonly state: 'failed'; readonly failure: string }
  /** `staffPay` says whether the company pays others besides the owner, whose pay the figures' salary costs then hold. */
  | { readonly state: 'ready'; readonly figures: PayScenarios; readonly staffPay: boolean }

export function payState(workbook: HrDooWorkbook, year: number, asOf: CivilDate): PayState {
  if (workbook.companyFacts.companyRegistered === null) {
    return {
      state: 'needs',
      need: words.needs.registeredSetting,
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
    return { state: 'ready', figures: payScenarios(workbook, year, asOf), staffPay: paysBesidesOwner(workbook) }
  } catch (failure) {
    if (failure instanceof RangeError) {
      return { state: 'failed', failure: failure.message }
    }
    throw failure
  }
}

export type LineGroup = 'net' | 'pension' | 'company' | 'state' | 'kept'

export interface PayCell extends ComparedCell {
  readonly detail: AskableDetail
}

export interface PayLine extends ComparedLine {
  readonly cells: readonly PayCell[]
}

export interface ScenarioColumn extends ComparedColumn {
  readonly warnings: readonly string[]
  readonly notes: readonly string[]
}

/** One bar of the 100% split: each part of the profit before owner pay, in cents. */
export interface ScenarioSplit {
  readonly label: string
  readonly whole: Money
  readonly parts: readonly { readonly segment: SplitSegment; readonly cents: Money }[]
}

export type SplitSegment = 'net' | 'pillar-two' | 'pillar-one' | 'health' | 'income-tax' | 'rent-tax' | 'dividend-tax' | 'corporate-tax' | 'kept'

export const SEGMENT_LABELS: Readonly<Record<SplitSegment, string>> = words.segments

/** Which way a line is better, or null for a line that only informs. */
type Better = 'higher' | 'lower' | null

interface LineSpec {
  readonly key: string
  readonly group: LineGroup
  readonly label: string
  readonly better: Better
  readonly total?: true
  readonly pick: (outcome: ScenarioOutcome) => TracedFigure | null
}

/** The lines of the comparison, worded when they are shown so an amount in a label follows the file's number format. */
function lineSpecs(): readonly LineSpec[] {
  return [
    { key: 'net-salary', group: 'net', label: words.lines['net-salary'], better: null, pick: (outcome) => outcome.netSalary },
    { key: 'tax-free', group: 'net', label: words.lines['tax-free'], better: null, pick: (outcome) => outcome.taxFree },
    { key: 'rent-after-tax', group: 'net', label: words.lines['rent-after-tax'], better: null, pick: (outcome) => outcome.rentAfterTax },
    { key: 'dividend-net', group: 'net', label: words.lines['dividend-net'], better: null, pick: (outcome) => outcome.dividend.net },
    { key: 'settlement', group: 'net', label: words.lines['settlement'], better: null, pick: (outcome) => outcome.settlementRefund },
    { key: 'own-contributions', group: 'net', label: words.lines['own-contributions'], better: null, pick: (outcome) => outcome.ownContributions },
    { key: 'net', group: 'net', label: words.lines['net'], better: 'higher', total: true, pick: (outcome) => outcome.netToOwner },
    { key: 'per-hundred', group: 'net', label: words.lines['per-hundred'](HUNDRED), better: 'higher', pick: (outcome) => outcome.netPerHundred },
    { key: 'pillar-two', group: 'pension', label: words.lines['pillar-two'], better: null, pick: (outcome) => outcome.taxes.pensionPillarTwo },
    { key: 'pillar-one', group: 'pension', label: words.lines['pillar-one'], better: null, pick: (outcome) => outcome.taxes.pensionPillarOne },
    { key: 'gross-two', group: 'company', label: words.lines['gross-two'], better: null, pick: (outcome) => outcome.grossTwo },
    { key: 'tax-free-cost', group: 'company', label: words.lines['tax-free-cost'], better: null, pick: (outcome) => outcome.taxFree },
    { key: 'rent', group: 'company', label: words.lines['rent'], better: null, pick: (outcome) => outcome.rent },
    { key: 'dividend', group: 'company', label: words.lines['dividend'], better: null, pick: (outcome) => outcome.dividend.gross },
    { key: 'corporate-tax', group: 'company', label: words.lines['corporate-tax'], better: null, pick: (outcome) => outcome.taxes.corporateTax },
    { key: 'company-cost', group: 'company', label: words.lines['company-cost'], better: null, total: true, pick: (outcome) => outcome.companyCost },
    { key: 'corporate-tax-without', group: 'company', label: words.lines['corporate-tax-without'], better: null, pick: (outcome) => outcome.corporateTaxWithoutOwnerPay },
    { key: 'corporate-tax-saved', group: 'company', label: words.lines['corporate-tax-saved'], better: 'higher', pick: (outcome) => outcome.corporateTaxSaved },
    { key: 'health', group: 'state', label: words.lines['health'], better: 'lower', pick: (outcome) => outcome.taxes.health },
    { key: 'income-tax', group: 'state', label: words.lines['income-tax'], better: 'lower', pick: (outcome) => outcome.taxes.incomeTaxWithheld },
    { key: 'settlement-change', group: 'state', label: words.lines['settlement-change'], better: 'lower', pick: (outcome) => outcome.taxes.settlementChange },
    { key: 'youth-relief', group: 'state', label: words.lines['youth-relief'], better: null, pick: (outcome) => outcome.taxes.youthRelief },
    { key: 'rent-tax', group: 'state', label: words.lines['rent-tax'], better: 'lower', pick: (outcome) => outcome.taxes.rentTax },
    { key: 'dividend-tax', group: 'state', label: words.lines['dividend-tax'], better: 'lower', pick: (outcome) => outcome.taxes.dividendTax },
    { key: 'state-corporate-tax', group: 'state', label: words.lines['state-corporate-tax'], better: 'lower', pick: (outcome) => outcome.taxes.corporateTax },
    { key: 'state', group: 'state', label: words.lines['state'], better: 'lower', total: true, pick: (outcome) => outcome.stateTake },
    { key: 'kept', group: 'kept', label: words.lines['kept'], better: null, pick: (outcome) => outcome.keptInCompany },
    { key: 'cash-after', group: 'kept', label: words.lines['cash-after'], better: 'higher', pick: (outcome) => outcome.cashAfter },
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
        ? words.warnings.belowZero(formatMoney(negateMoney(warning.netAssetsAfter.amount)), formatMoney(warning.shareCapital.amount))
        : words.warnings.belowCapital(formatMoney(warning.netAssetsAfter.amount), formatMoney(warning.shareCapital.amount))
    case 'cash-short':
      return words.warnings.cashShort(formatMoney(negateMoney(warning.cashAfter.amount)))
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
  readonly lines: readonly PayLine[]
  readonly splits: readonly ScenarioSplit[]
}

/**
 * The chosen scenarios side by side, the base first, each line with its one best value marked and every figure opening
 * its build-up. `staffPay` marks every figure as naming employees' pay, since a scenario's figures count the company's salaries.
 */
export function comparedScenarios(result: PayScenarios, chosen: readonly string[], base: string, link: (drill: DrillTarget | null) => RouteLocationRaw | null, staffPay: boolean): ShownScenarios {
  const outcomes = result.entries.flatMap((entry) => (entry.kind === 'outcome' && chosen.includes(entry.scenario.slug) ? [entry.outcome] : []))
  const ordered = [...outcomes.filter((outcome) => outcome.scenario.slug === base), ...outcomes.filter((outcome) => outcome.scenario.slug !== base)]
  const baseOutcome = ordered[0]?.scenario.slug === base ? ordered[0] : null
  const nameOf = (outcome: ScenarioOutcome) => scenarioName(outcome.scenario)

  const lines = lineSpecs().flatMap((spec): PayLine[] => {
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
        group: words.groups[spec.group],
        total: spec.total === true,
        cells: ordered.map((outcome, index): PayCell => {
          const figure = figures[index] as TracedFigure
          return {
            text: formatMoney(figure.amount),
            best: best !== null && figure.amount === best,
            difference: baseFigure === null || outcome === baseOutcome || figure.amount === baseFigure.amount ? null : formatMoney(subtractMoney(figure.amount, baseFigure.amount), 'always'),
            detail: figureDetail(figure, nameOf(outcome), [nameOf(outcome)], link, staffPay),
          }
        }),
      },
    ]
  })

  const columns = ordered.map((outcome): ScenarioColumn => ({
    key: outcome.scenario.slug,
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
      { segment: 'income-tax', cents: addMoney(outcome.taxes.incomeTaxWithheld.amount, outcome.taxes.settlementChange.amount) },
      { segment: 'rent-tax', cents: outcome.taxes.rentTax.amount },
      { segment: 'dividend-tax', cents: outcome.taxes.dividendTax.amount },
      { segment: 'corporate-tax', cents: outcome.taxes.corporateTax.amount },
      { segment: 'kept', cents: outcome.keptInCompany.amount },
    ],
  }))
  return { columns, lines, splits }
}
