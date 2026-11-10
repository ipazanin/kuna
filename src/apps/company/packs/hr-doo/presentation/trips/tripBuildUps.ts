import { decimalText } from '../../../../../../shared/money/decimal'
import { subtractMoney } from '../../../../../../shared/money/money'
import { deducted, summed, tracedFigure } from '../../domain/payroll/payrollArithmetic'
import type { PerDiemLine } from '../../domain/trips/perDiems'
import type { TripCost, TripCostPayer } from '../../domain/trips/trip'
import type { TripFile } from '../../domain/trips/tripReading'
import { costsPaidBy } from '../../domain/trips/tripSettlement'
import type { WorkedSettlement } from '../../domain/trips/tripSettlement'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { words } from './words'

/** The build-ups of a worked settlement's totals. */
export interface SettlementBuildUps {
  readonly perDiems: TracedFigure
  readonly kilometres: TracedFigure | null
  readonly travellerCosts: TracedFigure
  readonly companyCosts: TracedFigure
  readonly owed: TracedFigure
  readonly advance: TracedFigure
  /** What the company pays out, or what the traveller returns, as a positive amount either way. */
  readonly payout: TracedFigure
}

/** The full per diem of a line's place, with the stated dollar amount and the rule that converts it as its step. */
function fullFigure(line: PerDiemLine): TracedFigure {
  const said = words.perDiemFigures
  const { full } = line
  const label = line.place === 'abroad' ? said.abroadFull(line.country) : said.homeFull
  const stated = full.stated === null ? [] : [tracedFigure(said.inCurrency(full.stated.currency, decimalText(full.stated.amount)), full.amount, 'assumption', [full.stated.conversion])]
  return tracedFigure(label, full.amount, 'assumption', [full.citation], stated)
}

/** What the line's share earns before meals: the full per diem, or the half one, which abroad is a share of the full. */
function earnedFigure(line: PerDiemLine): TracedFigure {
  const full = fullFigure(line)
  if (line.share === 'full') return full
  const said = words.perDiemFigures
  return line.place === 'abroad'
    ? tracedFigure(said.abroadHalf(line.country), line.earned, 'assumption', [line.full.citation], [full])
    : tracedFigure(said.homeHalf, line.earned, 'assumption', [line.full.citation])
}

/** A per-diem line, the first counted 1, or the time at home around a trip abroad: its earned per diem less what the meals take off. */
export function perDiemLineFigure(line: PerDiemLine, index: number): TracedFigure {
  const label = line.from === null ? words.perDiemFigures.homeAround : words.perDiemFigures.line(index + 1)
  if (line.share === 'none') return tracedFigure(label, line.amount, 'assumption', line.citations)
  const earned = earnedFigure(line)
  const steps = line.meals === 0 ? [earned] : [earned, deducted(tracedFigure(words.perDiemFigures.mealCut(line.meals), line.mealCut, 'assumption', line.citations))]
  return tracedFigure(label, line.amount, 'assumption', line.citations, steps)
}

function costsFigure(costs: readonly TripCost[], payer: TripCostPayer): TracedFigure {
  const label = payer === 'traveller' ? words.settlementFigures.travellerCosts : words.settlementFigures.companyCosts
  return summed(
    label,
    costsPaidBy(costs, payer).map((cost) => ({ ...tracedFigure(cost.description || words.costKinds[cost.kind], cost.amount, 'assumption', []), on: cost.date })),
    'assumption',
  )
}

/** A worked settlement's figures, each with the steps and rules it adds up from, in the words on screen. */
export function settlementBuildUps(file: TripFile, settlement: WorkedSettlement): SettlementBuildUps {
  const said = words.settlementFigures
  const perDiems = summed(words.perDiemFigures.total, settlement.perDiemLines.map(perDiemLineFigure), 'assumption')
  const kilometres = settlement.kilometres === null ? null : tracedFigure(said.kilometres(settlement.kilometres.km), settlement.kilometres.amount, 'assumption', [])
  const travellerCosts = costsFigure(file.costs, 'traveller')
  const owed = summed(said.owed, [perDiems, ...(kilometres === null ? [] : [kilometres]), travellerCosts], 'assumption')
  const advance = tracedFigure(said.advance, settlement.advance, 'assumption', [])
  const payout =
    settlement.payout < 0
      ? tracedFigure(said.toReturn, subtractMoney(settlement.advance, settlement.owed), 'assumption', owed.rules, [advance, deducted(owed)])
      : tracedFigure(said.payout, settlement.payout, 'assumption', owed.rules, [owed, deducted(advance)])
  return { perDiems, kilometres, travellerCosts, companyCosts: costsFigure(file.costs, 'company'), owed, advance, payout }
}
