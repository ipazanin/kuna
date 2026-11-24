import { describe, expect, it } from 'vitest'

import { ruleTargetsOf } from '../src/apps/company/rules/domain/ruleTargets'
import { LABEL_RECORDS as COMPANY_LABELS } from '../src/apps/company/workbook/domain/coreKinds'
import { ruleCounts, rulesFiling } from '../src/shared/categorising/domain/rulesFiling'
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

describe('the rules behind a Spending category or label', () => {
  it('lists the rules that file under a category, in the order given', () => {
    expect(rulesFiling(RULES, FUEL, (rule) => rule).map((rule) => rule.name)).toEqual(['petrol station', 'motorway toll'])
  })

  it('lists the rules that put a label on, a labels-only rule among them', () => {
    expect(rulesFiling(RULES, TRIP, (rule) => rule).map((rule) => rule.name)).toEqual(['airport', 'motorway toll'])
  })

  it('counts the rules of each category and label once, and leaves out one no rule names', () => {
    const counts = ruleCounts(RULES, (rule) => rule)
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

const BERLIN = recordIdOf(COMPANY_LABELS, 'berlin')

const COMPANY_RULES = [
  { id: 'lufthansa-berlin', category: 'travel', labels: [BERLIN] },
  { id: 'lufthansa', category: 'Travel' },
  { id: 'unknown-card', category: '', labels: [BERLIN] },
  { id: 'accountant', category: 'accounting' },
]

describe('the rules behind a Company category or label', () => {
  it('counts a rule under the short name of its category, whatever its case, and under each label', () => {
    const counts = ruleCounts(COMPANY_RULES, ruleTargetsOf)
    expect([...counts]).toEqual(
      expect.arrayContaining([
        ['travel', 2],
        ['accounting', 1],
        [BERLIN, 2],
      ]),
    )
    expect(counts.size).toBe(3)
  })

  it('lists a review rule with a blank category only under its labels', () => {
    expect(rulesFiling(COMPANY_RULES, BERLIN, ruleTargetsOf).map((rule) => rule.id)).toEqual(['lufthansa-berlin', 'unknown-card'])
    expect(rulesFiling(COMPANY_RULES, '', ruleTargetsOf)).toEqual([])
  })
})
