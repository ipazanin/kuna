import { describe, expect, it } from 'vitest'

import type { HoldingMix } from '../src/apps/investments/holdings/domain/holdingMix'
import { depositSplit, targetGaps, targetedMix } from '../src/apps/investments/holdings/domain/targetMix'
import { TARGET_RECORDS } from '../src/apps/investments/workbook/domain/investmentKinds'
import type { ClassGroup, Sector } from '../src/apps/investments/workbook/domain/mixGroup'
import type { Target } from '../src/apps/investments/workbook/domain/target'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { decimal } from './fixtures/investments'
import { euros } from './fixtures/ledger'

function classTargets(percents: readonly (readonly [ClassGroup, string])[]): Target[] {
  return percents.map(([group, percent]) => ({ id: recordIdOf(TARGET_RECORDS, group), slice: { mix: 'class', group }, percent: decimal(percent) }))
}

function sectorTargets(percents: readonly (readonly [Sector, string])[]): Target[] {
  return percents.map(([group, percent]) => ({ id: recordIdOf(TARGET_RECORDS, group), slice: { mix: 'sector', group }, percent: decimal(percent) }))
}

/** €10,000.00 as stocks €7,000.00, bonds €2,000.00 and cash €1,000.00. */
const CLASSES: HoldingMix<'class'> = {
  mix: 'class',
  parts: [
    { group: 'stocks', value: euros(7000), share: 0.7 },
    { group: 'bonds', value: euros(2000), share: 0.2 },
    { group: 'cash', value: euros(1000), share: 0.1 },
  ],
  whole: euros(10000),
  unknown: euros(0),
  missing: [],
}

/** €10,000.00 held, €4,000.00 of it information technology, €4,000.00 financials and €2,000.00 no source places yet. */
const SECTORS: HoldingMix<'sector'> = {
  mix: 'sector',
  parts: [
    { group: 'financials', value: euros(4000), share: 0.4 },
    { group: 'information-technology', value: euros(4000), share: 0.4 },
  ],
  whole: euros(10000),
  unknown: euros(2000),
  missing: [],
}
const HALF_AND_HALF = sectorTargets([
  ['information-technology', '50'],
  ['financials', '50'],
])
const SIXTY_THIRTY_TEN = classTargets([
  ['stocks', '60'],
  ['bonds', '30'],
  ['cash', '10'],
])

describe('the targeted mix', () => {
  it("is the first target's mix, leaving out the targets of any other mix a hand-edited file holds", () => {
    const sector: Target = { id: recordIdOf(TARGET_RECORDS, 'information-technology'), slice: { mix: 'sector', group: 'information-technology' }, percent: decimal('100') }
    expect(targetedMix([...SIXTY_THIRTY_TEN, sector])).toEqual({ mix: 'class', targets: SIXTY_THIRTY_TEN })
  })

  it('is none with no targets', () => {
    expect(targetedMix([])).toBeNull()
  })
})

describe('the gap to a target mix', () => {
  it('is the target of the whole less what each group holds', () => {
    // 60% of 10,000.00 = 6,000.00 against 7,000.00, 30% = 3,000.00 against 2,000.00, 10% = 1,000.00 against 1,000.00.
    expect(targetGaps(CLASSES, SIXTY_THIRTY_TEN).map((line) => [line.group, line.gap])).toEqual([
      ['stocks', euros(-1000)],
      ['bonds', euros(1000)],
      ['cash', euros(0)],
    ])
  })

  it('lists a group targeted but not held, and a group held with no target, which should hold nothing', () => {
    const targets = classTargets([
      ['stocks', '80'],
      ['gold', '20'],
    ])
    expect(targetGaps(CLASSES, targets).map((line) => [line.group, line.now, line.gap])).toEqual([
      ['stocks', euros(7000), euros(1000)],
      ['gold', euros(0), euros(2000)],
      ['bonds', euros(2000), euros(-2000)],
      ['cash', euros(1000), euros(-1000)],
    ])
  })

  it('measures sector targets against the placed value, leaving out what no source places yet', () => {
    // Of the €8,000.00 placed, 50% is €4,000.00 for each, against the €4,000.00 each holds.
    expect(targetGaps(SECTORS, HALF_AND_HALF).map((line) => [line.group, line.share, line.gap])).toEqual([
      ['information-technology', 0.5, euros(0)],
      ['financials', 0.5, euros(0)],
    ])
  })
})

describe('what a deposit buys', () => {
  it('fills every shortfall when the deposit is just enough', () => {
    // Against 12,000.00: 7,200.00 − 7,000.00, 3,600.00 − 2,000.00 and 1,200.00 − 1,000.00.
    expect(depositSplit(CLASSES, SIXTY_THIRTY_TEN, euros(2000)).map((line) => [line.group, line.buy])).toEqual([
      ['stocks', euros(200)],
      ['bonds', euros(1600)],
      ['cash', euros(200)],
    ])
  })

  it('splits a smaller deposit in proportion to the shortfalls, the last group taking the rest', () => {
    // Against 11,000.00 stocks are over, bonds lack 3,300.00 − 2,000.00 = 1,300.00 and cash 1,100.00 − 1,000.00 = 100.00.
    // 1,000.00 × 1,300 ÷ 1,400 = 928.571… is 928.57, and cash takes the rest, 71.43.
    expect(depositSplit(CLASSES, SIXTY_THIRTY_TEN, euros(1000)).map((line) => [line.group, line.buy])).toEqual([
      ['stocks', euros(0)],
      ['bonds', euros(928.57)],
      ['cash', euros(71.43)],
    ])
  })

  it('splits a deposit over the placed value, so it keeps groups on their targets', () => {
    // Against €9,000.00 placed with the deposit, each group's 50% is €4,500.00, €500.00 more than it holds.
    expect(depositSplit(SECTORS, HALF_AND_HALF, euros(1000)).map((line) => [line.group, line.buy])).toEqual([
      ['information-technology', euros(500)],
      ['financials', euros(500)],
    ])
  })

  it('buys nothing with nothing put in', () => {
    expect(depositSplit(CLASSES, SIXTY_THIRTY_TEN, euros(0)).map((line) => line.buy)).toEqual([euros(0), euros(0), euros(0)])
  })
})
