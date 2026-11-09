import { describe, expect, it } from 'vitest'

import { ownerShareOf } from '../src/apps/company/owner-share/domain/ownerShare'
import { categoryMove } from '../src/apps/company/settings/domain/categoryMove'
import type { LedgerEntry } from '../src/apps/company/workbook/domain/ledgerReading'
import type { SplitTabRow } from '../src/apps/company/workbook/domain/splitsReading'
import { ledger } from './fixtures/ledger'

const OFFICE_SHARE = ownerShareOf(40)

describe('deleting a category into another', () => {
  it('moves its rows and split parts with the other category’s share, keeps who filed each row, and moves its rules', () => {
    const [moved, kept] = ledger([
      { date: '2026-01-02', amount: -10, category: 'office' },
      { date: '2026-01-03', amount: -20, category: 'equipment', flaggedBy: 'human' },
    ]) as LedgerEntry[]
    const part = { category: 'Equipment', ownerShare: null } as unknown as SplitTabRow
    const rules = [{ fields: { rule: 'merchant-model', category: 'equipment' } }, { fields: { rule: 'merchant-paper', category: 'office' } }]

    const move = categoryMove('equipment', 'office', { ledger: [kept!, moved!], splits: [part], rules }, [{ slug: 'office', ownerShare: OFFICE_SHARE }])

    expect(move.ledger).toEqual([{ before: moved, after: { ...moved, category: 'office', ownerShare: OFFICE_SHARE, flaggedBy: 'human' } }])
    expect(move.splits).toEqual([{ before: part, after: { ...part, category: 'office', ownerShare: OFFICE_SHARE } }])
    expect(move.rules).toEqual([{ before: rules[0], after: { fields: { rule: 'merchant-model', category: 'office' } } }])
  })
})
