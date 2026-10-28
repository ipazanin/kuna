import { describe, expect, it } from 'vitest'

import { recategorisation } from '../src/apps/company/review/domain/verdictChanges'
import type { Rule } from '../src/apps/company/rules/domain/rule'
import { ruleAgainst } from '../src/apps/company/rules/domain/ruleCoverage'
import { categorisationContextOf } from '../src/apps/company/rules/domain/transactionFacts'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import { categoryChangeOf } from '../src/apps/company/transactions/domain/categoryChange'
import { listedRows } from '../src/apps/company/transactions/domain/listedRows'
import type { OwnerAdvance } from '../src/apps/company/workbook/domain/workbook'
import { STUDIO_CATEGORIES } from './fixtures/exampleStudio'
import { civil, euros, ledger } from './fixtures/ledger'
import { withSplit } from './fixtures/splits'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { OWNER_ADVANCE_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'

const ROWS = ledger([
  { date: '2026-09-02', amount: -40, category: 'travel', counterparty: 'Rail', flaggedBy: 'ivan' },
  { date: '2026-09-03', amount: -25, category: 'ai-services', counterparty: 'Model host', flaggedBy: 'rule' },
  { date: '2026-09-04', amount: -18, category: 'ai-services', counterparty: 'Snack kiosk', flaggedBy: 'ai' },
  { date: '2026-09-05', amount: -60, category: 'equipment', counterparty: 'Desk shop', flaggedBy: 'ivan' },
])

const named = (counterparty: string) => ROWS.find((row) => row.counterparty === counterparty)!

const ADVANCE: OwnerAdvance = {
  date: civil('2026-09-06'),
  amount: euros(12),
  category: 'travel',
  family: 'operating',
  bucket: 'operating',
  description: 'Taxi',
  ownerShare: null,
  id: recordIdOf(OWNER_ADVANCE_RECORDS, 'row-2'),
}

describe('categoryChangeOf', () => {
  const listed = listedRows(withSplit(ROWS, { date: '2026-09-05', amount: -60 }, [[-50, 'equipment'], [-10, 'software']], STUDIO_CATEGORIES), [ADVANCE])
  const changeOf = (counterparty: string) => listed.filter((row) => row.counterparty === counterparty).map(categoryChangeOf)

  it('changes a row a person or a rule settled on its ledger row', () => {
    expect(changeOf('Rail')).toEqual(['ledger'])
    expect(changeOf('Model host')).toEqual(['ledger'])
  })

  it('leaves a row that still waits to Review', () => {
    expect(changeOf('Snack kiosk')).toEqual([null])
  })

  it('sends each part of a split row to the split editor', () => {
    expect(changeOf('Desk shop')).toEqual(['split', 'split'])
  })

  it('leaves an owner advance alone, since it is a row of its own tab', () => {
    expect(listed.filter((row) => row.kind === 'owner-advance').map(categoryChangeOf)).toEqual([null])
  })
})

describe('changing the category of a settled row', () => {
  const RAIL_RULE: Rule = {
    id: 'rail-travel',
    order: 100,
    enabled: true,
    conditions: [{ column: 'counterparty_contains', fragment: 'RAIL' }],
    category: 'travel',
    confidence: 'rule',
    note: '',
  }
  const context = categorisationContextOf({ accounts: [], clients: [], settings: DEFAULT_SETTINGS })

  it('writes the new category with the review label, as a confirmation on Review does', () => {
    const rail = named('Rail')

    expect(recategorisation(rail, 'consulting', { reviewLabel: 'ivan' })).toEqual({ id: rail.id, verdict: { category: 'consulting', flaggedBy: 'ivan' } })
  })

  it('names the rule that files such rows elsewhere', () => {
    expect(ruleAgainst(named('Rail'), 'consulting', [RAIL_RULE], context)).toEqual({ ruleId: 'rail-travel', category: 'travel' })
  })

  it('names no rule when the rule agrees or none settles the row', () => {
    expect(ruleAgainst(named('Rail'), 'travel', [RAIL_RULE], context)).toBeNull()
    expect(ruleAgainst(named('Desk shop'), 'travel', [RAIL_RULE], context)).toBeNull()
  })

  it('names no rule that only sends such rows to review', () => {
    expect(ruleAgainst(named('Rail'), 'consulting', [{ ...RAIL_RULE, confidence: 'review', category: '' }], context)).toBeNull()
  })
})
