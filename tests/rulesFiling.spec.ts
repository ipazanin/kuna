import { describe, expect, it } from 'vitest'

import { ruleCounts, rulesFiling } from '../src/apps/spending/statements/domain/rulesFiling'
import { CATEGORY_RECORDS, LABEL_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'

const FUEL = recordIdOf(CATEGORY_RECORDS, 'fuel')
const GROCERIES = recordIdOf(CATEGORY_RECORDS, 'groceries')
const TRIP = recordIdOf(LABEL_RECORDS, 'trip')
const CAR = recordIdOf(LABEL_RECORDS, 'car')

const RULES = [
  { name: 'petrol station', category: FUEL, labels: [CAR] },
  { name: 'market', category: GROCERIES, labels: [] },
  { name: 'airport', category: null, labels: [TRIP, CAR] },
  { name: 'motorway toll', category: FUEL, labels: [TRIP] },
]

describe('the rules behind a category or a label', () => {
  it('lists the rules that file under a category, in the order given', () => {
    expect(rulesFiling(RULES, FUEL).map((rule) => rule.name)).toEqual(['petrol station', 'motorway toll'])
  })

  it('lists the rules that put a label on, a labels-only rule among them', () => {
    expect(rulesFiling(RULES, TRIP).map((rule) => rule.name)).toEqual(['airport', 'motorway toll'])
  })

  it('counts the rules of each category and label once, and leaves out one no rule names', () => {
    const counts = ruleCounts(RULES)
    expect([...counts]).toEqual(
      expect.arrayContaining([
        [FUEL, 2],
        [GROCERIES, 1],
        [CAR, 2],
        [TRIP, 2],
      ]),
    )
    expect(counts.size).toBe(4)
    expect(counts.get(recordIdOf(CATEGORY_RECORDS, 'pharmacy'))).toBeUndefined()
  })
})
