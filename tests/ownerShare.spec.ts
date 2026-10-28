import { describe, expect, it } from 'vitest'

import { filedIn, movedTo, ownerShareOf, ownerShareProblem, storedOwnerShare } from '../src/apps/company/owner-share/domain/ownerShare'
import type { OwnerShare } from '../src/apps/company/owner-share/domain/ownerShare'
import { categoryShareRefusals } from '../src/apps/company/settings/domain/categoryGuards'
import { storedFieldOf } from '../src/shared/storage/domain/storedFields'
import { readSnapshot } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import { EMPTY_TABS, sheetRowsFromValues } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import type { CellValue, WorkbookSnapshot } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { withIds } from './fixtures/rowIds'

const share = (percent: number): OwnerShare => ownerShareOf(percent)!

describe('the owner share', () => {
  it('is a whole percentage from 0 to 100, and 0 is a share where blank is none', () => {
    expect(ownerShareOf(0)).toBe(0)
    expect(ownerShareOf(30)).toBe(30)
    expect(ownerShareOf(100)).toBe(100)
    expect(ownerShareOf(-1)).toBeNull()
    expect(ownerShareOf(101)).toBeNull()
    expect(ownerShareOf(12.5)).toBeNull()
    expect(storedOwnerShare(undefined)).toBeNull()
    expect(storedOwnerShare(storedFieldOf(0))).toBe(0)
  })

  it('reads a number cell or text of a whole number, and reads anything else as none with a problem', () => {
    expect(storedOwnerShare(storedFieldOf(50))).toBe(50)
    expect(storedOwnerShare(storedFieldOf('25'))).toBe(25)
    for (const cell of ['half', '30%', 0.3, 150, true]) {
      expect(storedOwnerShare(storedFieldOf(cell)), String(cell)).toBeNull()
      expect(ownerShareProblem(storedFieldOf(cell)), String(cell)).toContain('is not a whole number from 0 to 100, so it reads as blank')
    }
    expect(ownerShareProblem(undefined)).toBeNull()
    expect(ownerShareProblem(storedFieldOf(0))).toBeNull()
  })

  it('is copied from the category a record is filed in, over any share it held, and blank for a category without a default', () => {
    const categories = [
      { slug: 'ai-services', ownerShare: share(50) },
      { slug: 'equipment', ownerShare: null },
    ]
    const held = { category: 'equipment', ownerShare: share(30), note: 'kept' }

    expect(filedIn(held, 'ai-services', categories)).toEqual({ category: 'ai-services', ownerShare: 50, note: 'kept' })
    expect(filedIn({ ...held, category: 'ai-services', ownerShare: share(10) }, 'ai-services', categories)).toEqual({ category: 'ai-services', ownerShare: 50, note: 'kept' })
    expect(filedIn(held, 'equipment', categories).ownerShare).toBeNull()
    expect(filedIn(held, 'snacks', categories).ownerShare).toBeNull()
    expect(filedIn(held, '', categories).ownerShare).toBeNull()
  })

  it('is kept by an edit that keeps the category, and copied again when the edit moves the record', () => {
    const categories = [{ slug: 'ai-services', ownerShare: share(50) }]
    const held = { category: 'equipment', ownerShare: share(30) }

    expect(movedTo(held, 'equipment', categories)).toBe(held)
    expect(movedTo(held, 'ai-services', categories)).toEqual({ category: 'ai-services', ownerShare: 50 })
  })
})

function snapshotOf(tabs: Readonly<Record<string, CellValue[][]>>): WorkbookSnapshot {
  return {
    meta: { id: 'sheet', source: 'drive', title: 'Books', syncedAt: '2026-10-16T08:00:00.000Z', lastExportedAt: null, unexportedSince: null, missingTabs: [] },
    ...EMPTY_TABS,
    ...Object.fromEntries(Object.entries(tabs).map(([tab, values]) => [tab, sheetRowsFromValues(values)])),
  } as WorkbookSnapshot
}

describe('reading the owner share', () => {
  const tabs = {
    categories: [
      ['category', 'family', 'bucket', 'owner_share'],
      ['ai-services', 'operating', 'operating', 50],
      ['equipment', 'operating', 'operating', 0],
      ['travel', 'operating', 'operating', 'most'],
      ['benefits', 'owner', 'owner-pay', ''],
    ],
    accounts: [['account', 'iban'], ['main', 'XX00FAKE0000000001']],
    ledger: [
      ['date', 'account', 'amount', 'balance', 'counterparty', 'category', 'reference', 'owner_share'],
      [46300, 'main', -20, 980, 'MODEL API INC', 'ai-services', 'REF-3', 50],
      [46299, 'main', -100, 1000, 'Desk Co', 'equipment', 'REF-2', 0],
      [46298, 'main', -10, 1100, 'Rail', 'travel', 'REF-1', ''],
      [46297, 'main', -5, 1110, 'Kiosk', 'travel', 'REF-0', 'lots'],
    ],
    splits: withIds('split', [
      ['date', 'account', 'row_amount', 'row_balance', 'amount', 'category', 'owner_share'],
      [46299, 'main', -100, 1000, -60, 'equipment', 40],
      [46299, 'main', -100, 1000, -40, 'travel', 120],
    ]),
    'owner-advances': withIds('advance', [
      ['date', 'amount', 'description', 'category', 'owner_share'],
      [46300, 12, 'Pens', 'equipment', 25],
      [46300, 8, 'Paper', 'equipment', -3],
    ]),
  }
  const workbook = readSnapshot(snapshotOf(tabs)).workbook

  it('reads blank and 0 apart on every kind', () => {
    expect(workbook.categories.map((category) => [category.slug, category.ownerShare])).toEqual([
      ['ai-services', 50],
      ['equipment', 0],
      ['travel', null],
      ['benefits', null],
    ])
    expect(workbook.transactions.map((row) => [row.counterparty, row.ownerShare])).toEqual([
      ['MODEL API INC', 50],
      ['Desk Co', 0],
      ['Rail', null],
      ['Kiosk', null],
    ])
    expect(workbook.splits[0]?.parts.map((part) => [part.category, part.ownerShare])).toEqual([
      ['equipment', 40],
      ['travel', null],
    ])
    expect(workbook.ownerAdvances.map((advance) => [advance.description, advance.ownerShare])).toEqual([
      ['Pens', 25],
      ['Paper', null],
    ])
  })

  it('reads a cell that is not a whole number from 0 to 100 as blank, with a problem naming the row, and the row still counts', () => {
    expect(workbook.problems.filter((problem) => problem.reason.includes('owner_share')).map((problem) => [problem.tab, problem.label, problem.reason])).toEqual([
      ['categories', 'travel', 'owner_share "most" is not a whole number from 0 to 100, so it reads as blank'],
      ['ledger', '2026-10-02, Kiosk, -5, balance 1110', 'owner_share "lots" is not a whole number from 0 to 100, so it reads as blank'],
      ['splits', 'travel, -40, 2026-10-04', 'owner_share "120" is not a whole number from 0 to 100, so it reads as blank'],
      ['owner-advances', 'Paper, 8, 2026-10-05', 'owner_share "-3" is not a whole number from 0 to 100, so it reads as blank'],
    ])
    expect(workbook.transactions.map((row) => row.counterparty)).toContain('Kiosk')
    expect(workbook.categories.map((category) => category.slug)).toContain('travel')
    expect(workbook.ownerAdvances.map((advance) => advance.description)).toContain('Paper')
    expect(workbook.splits).toHaveLength(1)
  })

  it('reads a Sheet without the column as every share blank, with no problem', () => {
    const without = readSnapshot(
      snapshotOf({
        categories: [['category', 'family', 'bucket'], ['ai-services', 'operating', 'operating']],
        accounts: tabs.accounts,
        ledger: [
          ['date', 'account', 'amount', 'balance', 'category', 'reference'],
          [46300, 'main', -20, 980, 'ai-services', 'REF-3'],
        ],
      }),
    ).workbook

    expect(without.categories[0]?.ownerShare).toBeNull()
    expect(without.transactions[0]?.ownerShare).toBeNull()
    expect(without.problems).toEqual([])
  })
})

describe('categoryShareRefusals', () => {
  const benefit = { slug: 'benefits', bucket: 'owner-pay', roles: ['owner-benefit'], ownerShare: null }
  const ai = { slug: 'ai-services', bucket: 'operating', roles: [], ownerShare: share(50) }

  it('lets an operating category hold a default while a category carries the owner-benefit role', () => {
    expect(categoryShareRefusals([{ before: { ...ai, ownerShare: null }, after: ai }], [benefit, ai])).toEqual([])
    expect(categoryShareRefusals([{ before: null, after: { ...ai, ownerShare: share(0) } }], [benefit, { ...ai, ownerShare: share(0) }])).toEqual([])
  })

  it('refuses a new default outside operating cost, and lets a category move out of it with the default it holds, which then counts as 0', () => {
    const taxes = { slug: 'payroll-tax', bucket: 'taxes', roles: [], ownerShare: share(20) }

    expect(categoryShareRefusals([{ before: { ...taxes, ownerShare: null }, after: taxes }], [benefit, taxes])).toEqual([
      '"payroll-tax" is in the taxes bucket, and only an operating category holds an owner share.',
    ])
    expect(categoryShareRefusals([{ before: ai, after: { ...ai, bucket: 'owner-pay' } }], [benefit, { ...ai, bucket: 'owner-pay' }])).toEqual([])
  })

  it('refuses a new default while no category carries the owner-benefit role, and leaves a default it does not touch alone', () => {
    expect(categoryShareRefusals([{ before: { ...ai, ownerShare: null }, after: ai }], [ai])).toEqual([
      '"ai-services" holds an owner share only once a category carries the owner-benefit role, where the owner\'s part counts.',
    ])
    expect(categoryShareRefusals([{ before: ai, after: { ...ai, roles: ['watched'] } }], [{ ...ai, roles: ['watched'] }])).toEqual([])
  })

  it('lets the role come off the last category that carries it while a default is held, since the default then counts as 0', () => {
    expect(categoryShareRefusals([{ before: benefit, after: { ...benefit, roles: [] } }], [{ ...benefit, roles: [] }, ai])).toEqual([])
    expect(categoryShareRefusals([{ before: benefit, after: null }], [ai])).toEqual([])
  })

  it('gives the owner-benefit role to one owner-pay category only, and keeps that category in owner pay', () => {
    const perks = { slug: 'perks', bucket: 'owner-pay', roles: ['owner-benefit'], ownerShare: null }
    const movedOut = { ...benefit, bucket: 'operating' }

    expect(categoryShareRefusals([{ before: null, after: perks }], [benefit, perks, ai])).toEqual([
      '"perks" takes the owner-benefit role only once no other category carries it, and "benefits" does.',
    ])
    expect(categoryShareRefusals([{ before: { ...ai, ownerShare: null }, after: { ...ai, ownerShare: null, roles: ['owner-benefit'] } }], [{ ...ai, ownerShare: null, roles: ['owner-benefit'] }])).toEqual([
      '"ai-services" is in the operating bucket, and only an owner-pay category carries the owner-benefit role, since the owner\'s part of a shared cost counts there.',
    ])
    expect(categoryShareRefusals([{ before: benefit, after: movedOut }], [movedOut, ai])).toEqual([
      '"benefits" is in the operating bucket, and only an owner-pay category carries the owner-benefit role, since the owner\'s part of a shared cost counts there.',
    ])
    expect(categoryShareRefusals([{ before: benefit, after: { ...benefit, roles: [] } }, { before: null, after: perks }], [{ ...benefit, roles: [] }, perks, ai])).toEqual([])
    expect(categoryShareRefusals([{ before: benefit, after: { ...benefit, roles: ['owner-benefit', 'watched'] } }], [benefit, ai])).toEqual([])
  })
})
