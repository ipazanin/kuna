import { describe, expect, it } from 'vitest'

import { holdingMixes } from '../src/apps/investments/holdings/domain/holdingMix'
import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import type { RecentCosts } from '../src/apps/investments/income/domain/yearlyCosts'
import { portfolioChecks } from '../src/apps/investments/overview/domain/portfolioChecks'
import { checkLines } from '../src/apps/investments/overview/presentation/checkLines'
import { fetchedFactsBook } from '../src/apps/investments/prices/domain/factsBook'
import { NO_FETCHED_FACTS } from '../src/apps/investments/prices/domain/pricesFile'
import type { CheckName, CheckSetting } from '../src/apps/investments/workbook/domain/checkSetting'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import { CHECK_RECORDS, TARGET_RECORDS } from '../src/apps/investments/workbook/domain/investmentKinds'
import type { ClassGroup } from '../src/apps/investments/workbook/domain/mixGroup'
import type { Target } from '../src/apps/investments/workbook/domain/target'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { BROKER, book, cashMovement, decimal, instrument, priceBookOf, rateBookOf, trade } from './fixtures/investments'
import type { CloseRow } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const TECH = instrument('tech', { name: 'Example Tech', type: 'share', sector: 'information-technology' })
const FUND = instrument('fund', { name: 'Example Fund', type: 'fund' })

/** €10,000.00 put in: €3,420.00 of Example Tech, €3,000.00 of a fund with no sector, and €3,580.00 of cash. */
const RECORDS = book({
  accounts: [BROKER],
  instruments: [TECH, FUND],
  cashMovements: [cashMovement('deposit', BROKER, '2026-01-05', '10000')],
  trades: [trade('buy', BROKER, TECH, '2026-01-05', '342', '10', '0'), trade('buy', BROKER, FUND, '2026-01-05', '300', '10', '0')],
})
const FIGURES = portfolioFigures({
  book: RECORDS,
  prices: priceBookOf(
    new Map<Instrument, readonly CloseRow[]>([
      [TECH, [['2026-10-29', '10']]],
      [FUND, [['2026-10-29', '10']]],
    ]),
  ),
  rates: rateBookOf(new Map()),
  today: civil('2026-10-29'),
})
const MIXES = holdingMixes(FIGURES, RECORDS, fetchedFactsBook(NO_FETCHED_FACTS))
/** €12.00 over an average of €1,000.00. */
const COSTS: RecentCosts = { total: euros(12), averageValue: euros(1000) }

function setting(check: CheckName, threshold: string | null, off = false): CheckSetting {
  return { id: recordIdOf(CHECK_RECORDS, check), check, threshold: threshold === null ? null : decimal(threshold), off }
}

function classTargets(percents: readonly (readonly [ClassGroup, string])[]): Target[] {
  return percents.map(([group, percent]) => ({ id: recordIdOf(TARGET_RECORDS, group), slice: { mix: 'class', group }, percent: decimal(percent) }))
}

function linesOf(targets: readonly Target[], thresholds: readonly CheckSetting[]) {
  return checkLines(portfolioChecks(FIGURES, MIXES, COSTS, targets, thresholds), RECORDS)
}

describe('the portfolio checks', () => {
  it('fails a holding at 34.2% against the default 20% and says so in words', () => {
    const holding = linesOf([], []).find((line) => line.check === 'holding')
    expect(holding).toEqual({ check: 'holding', over: true, label: 'Largest holding', sentence: 'Example Tech is 34.2% of the value, over 20%' })
  })

  it('reads every check at its default, failing ones first, and leaves out a mix with no group placed and a mix with no targets', () => {
    // Cash €3,580.00 is 35.8% of the value. The sector mix splits the €6,420.00 of holdings, €3,420.00 of it information technology.
    expect(linesOf([], []).map((line) => [line.check, line.over, line.sentence])).toEqual([
      ['holding', true, 'Example Tech is 34.2% of the value, over 20%'],
      ['currency', true, 'EUR: 100.0% of the value, over 50%'],
      ['sector', true, 'Information technology: 53.3% of the holdings, over 30%'],
      ['account', true, 'Broker: 100.0% of the value, over 50%'],
      ['cash', true, 'Cash is 35.8% of the value, over 10%'],
      ['costs', true, 'The costs were 1.20% of the average value, over 1%'],
    ])
  })

  it('reads a changed threshold from its record and leaves out a check switched off', () => {
    const lines = linesOf([], [setting('holding', '35'), setting('cash', null, true)])
    expect(lines.find((line) => line.check === 'holding')).toMatchObject({ over: false, sentence: 'Example Tech is 34.2% of the value, within 35%' })
    expect(lines.some((line) => line.check === 'cash')).toBe(false)
    expect(lines.at(-1)?.check).toBe('holding')
  })

  it('is over only above its threshold, so a share exactly at it is within', () => {
    expect(linesOf([], [setting('holding', '34.2')]).find((line) => line.check === 'holding')?.over).toBe(false)
    expect(linesOf([], [setting('holding', '34.19')]).find((line) => line.check === 'holding')?.over).toBe(true)
  })

  it('names the group furthest from its target in points', () => {
    // Stocks hold 64.2% against 60, bonds 0% against 10 and cash 35.8% against 30, so bonds are furthest at 10 points.
    const targets = classTargets([
      ['stocks', '60'],
      ['bonds', '10'],
      ['cash', '30'],
    ])
    expect(linesOf(targets, []).find((line) => line.check === 'target-gap')).toEqual({
      check: 'target-gap',
      over: true,
      label: 'Gap to the target mix',
      sentence: 'Bonds: 10.0 points from the target, over 5 points',
    })
    expect(linesOf(targets, [setting('target-gap', '10')]).find((line) => line.check === 'target-gap')).toMatchObject({ over: false, sentence: 'Bonds: 10.0 points from the target, within 10 points' })
  })
})
