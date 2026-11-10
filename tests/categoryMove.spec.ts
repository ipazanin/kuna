import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { ownerShareOf } from '../src/apps/company/owner-share/domain/ownerShare'
import { HR_DOO_PART, hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { OWNER_ADVANCE_RECORDS, PLAN_RECORDS, YEAR_END_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import type { PlanLine } from '../src/apps/company/packs/hr-doo/domain/forecast/plan'
import type { OwnerAdvanceEntry } from '../src/apps/company/packs/hr-doo/domain/ownerAdvancesReading'
import type { YearEndLine } from '../src/apps/company/packs/hr-doo/domain/yearEnd/yearEnd'
import { words as packWords } from '../src/apps/company/packs/hr-doo/presentation/words'
import { installedPack } from '../src/apps/company/packs/packContribution'
import { categoryMove, keptByMove } from '../src/apps/company/settings/domain/categoryMove'
import type { CategoryNaming } from '../src/apps/company/workbook/domain/packPart'
import { CATEGORY_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import type { LedgerEntry } from '../src/apps/company/workbook/domain/ledgerReading'
import type { SplitTabRow } from '../src/apps/company/workbook/domain/splitsReading'
import { moneyFromAmount, sumMoney } from '../src/shared/money/money'
import type { Money } from '../src/shared/money/money'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { storedFieldOf } from '../src/shared/storage/domain/storedFields'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import type { ReadRecord, RecordsRead, RefusedRecord } from '../src/shared/storage/domain/recordsRead'
import { companyDesk } from './fixtures/companyDesk'
import { ledger } from './fixtures/ledger'
import { forgetCaches } from './fixtures/writeBack'

const OFFICE_SHARE = ownerShareOf(40)

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

/** The pack's hook for a kind, as the categories tab and the chat take it. */
function namingOf<R>(kind: RecordKind<R>): CategoryNaming<R> {
  return HR_DOO_PART.categoryNaming.find((naming) => naming.writes.kind.name === kind.name) as CategoryNaming<R>
}

function readOf<R>(records: readonly R[], refused: readonly RefusedRecord[] = []): RecordsRead<R> {
  return { records: records.map((record, at): ReadRecord<R> => ({ record, id: null, label: String(at), fields: {} })), refused }
}

function planLine(id: string, year: number, month: number | null, item: string, amount: number): PlanLine {
  return { year, month, note: '', id: recordIdOf(PLAN_RECORDS, id), kind: 'amount', item, amount: moneyFromAmount(amount) }
}

/** What the plan holds for categories in each year, the figure a merge must leave as it was. */
function planTotals(lines: readonly PlanLine[]): ReadonlyMap<number, Money> {
  const years = [...new Set(lines.map((line) => line.year))]
  return new Map(years.map((year) => [year, sumMoney(lines.flatMap((line) => (line.year === year && line.kind === 'amount' && line.item !== 'dividend' ? [line.amount] : [])))]))
}

describe('deleting a category into another', () => {
  it('moves its rows and split parts with the other category’s share, keeps who filed each row, and moves its rules', () => {
    const [moved, kept] = ledger([
      { date: '2026-01-02', amount: -10, category: 'office' },
      { date: '2026-01-03', amount: -20, category: 'equipment', flaggedBy: 'human' },
    ]) as LedgerEntry[]
    const part = { category: 'Equipment', ownerShare: null } as unknown as SplitTabRow
    const rules = [{ fields: { rule: 'merchant-model', category: 'equipment' } }, { fields: { rule: 'merchant-paper', category: 'office' } }]

    const move = categoryMove('equipment', 'office', { ledger: [kept!, moved!], splits: [part], rules, packs: [] }, [{ slug: 'office', ownerShare: OFFICE_SHARE }])

    expect(move.ledger).toEqual([{ before: moved, after: { ...moved, category: 'office', ownerShare: OFFICE_SHARE, flaggedBy: 'human' } }])
    expect(move.splits).toEqual([{ before: part, after: { ...part, category: 'office', ownerShare: OFFICE_SHARE } }])
    expect(move.rules).toEqual([{ before: rules[0], after: { fields: { rule: 'merchant-model', category: 'office' } } }])
  })

  it('moves an owner advance with the other category’s share and leaves the rest', () => {
    const advance = (id: string, category: string): OwnerAdvanceEntry => ({
      date: '2026-02-03' as OwnerAdvanceEntry['date'],
      amount: moneyFromAmount(212.5),
      description: 'Train',
      category,
      ownerShare: null,
      id: recordIdOf(OWNER_ADVANCE_RECORDS, id),
    })
    const [moved, kept] = [advance('a1', 'travel'), advance('a2', 'office')]

    const move = namingOf(OWNER_ADVANCE_RECORDS).movedInto(readOf([moved!, kept!]), 'travel', 'office', [{ slug: 'office', ownerShare: OFFICE_SHARE }])

    expect(move).toEqual({ changed: [{ before: moved, after: { ...moved, category: 'office', ownerShare: OFFICE_SHARE } }], removed: [] })
  })

  it('moves a konto line to the other category, listed once when it lists both', () => {
    const line = (id: string, categories: readonly string[]): YearEndLine =>
      ({
        year: 2025,
        statement: 'konto',
        line: id,
        label: '',
        figure: { kind: 'money', amount: moneyFromAmount(82) },
        categories,
        aop: '',
        source: '',
        note: '',
        id: recordIdOf(YEAR_END_RECORDS, id),
      }) as YearEndLine
    const both = line('41200', ['travel', 'office'])
    const alone = line('41300', ['travel'])

    const move = namingOf(YEAR_END_RECORDS).movedInto(readOf([both, alone, line('41400', ['telecom'])]), 'travel', 'office', [])

    expect(move.changed).toEqual([
      { before: both, after: { ...both, categories: ['office'] } },
      { before: alone, after: { ...alone, categories: ['office'] } },
    ])
  })

  it('adds a plan row to the other category’s row of the same year and month, renames the rest, and keeps the plan’s totals', () => {
    const lines = [planLine('p1', 2027, null, 'travel', 100.5), planLine('p2', 2027, null, 'office', 20.25), planLine('p3', 2027, 3, 'travel', 30), planLine('p4', 2026, null, 'office', 7)]

    const move = namingOf(PLAN_RECORDS).movedInto(readOf(lines), 'travel', 'office', [])

    // 100.50 + 20.25 is 120.75, added in cents.
    expect(move.changed).toEqual([
      { before: lines[1], after: { ...lines[1], amount: moneyFromAmount(120.75) } },
      { before: lines[2], after: { ...lines[2], item: 'office' } },
    ])
    expect(move.removed).toEqual([lines[0]])
    expect(installedPack().categoryNamingWords(PLAN_RECORDS.name).joined(move.removed.length)).toBe(packWords.categoryNaming.planRowsJoined(1).one)
    const after = [...lines.filter((line) => !move.removed.includes(line) && !move.changed.some((changed) => changed.before === line)), ...move.changed.map((changed) => changed.after)]
    expect(planTotals(after)).toEqual(planTotals(lines))
  })

  it('keeps a category while a record its kind refuses names it, with the screen that fixes it', () => {
    const refused: RefusedRecord = { id: null, label: '2027 travel', fields: { year: storedFieldOf(2027), item: storedFieldOf('Travel') }, reason: 'no amount' }
    const plan = namingOf(PLAN_RECORDS)

    expect(plan.movedInto(readOf([], [refused]), 'travel', 'office', [])).toEqual({ changed: [], removed: [] })
    expect(keptByMove([{ naming: plan as CategoryNaming, records: readOf([], [refused]) }]).get('travel')).toEqual([{ kind: PLAN_RECORDS, count: 1, editedOn: plan.editedOn }])
  })
})

/** The pack's tabs of the desk: an owner advance, a konto line and plan rows that name travel, and a plan row of spare. */
const PACK_TABS = {
  'owner-advances': [
    ['date', 'amount', 'description', 'category', 'owner_share', 'id'],
    [46303, 212.5, 'Train tickets', 'travel', '', 'advance-1'],
  ],
  'year-end': [
    ['year', 'statement', 'line', 'label', 'amount', 'categories', 'aop', 'source', 'note', 'id'],
    [2025, 'konto', '41300', 'Putni troškovi', 300, 'travel, spare', '', '', '', 'konto-1'],
  ],
  plan: [
    ['year', 'month', 'item', 'amount', 'note', 'date', 'group', 'id'],
    [2027, '', 'travel', 100.5, 'Client visits', '', '', 'plan-1'],
    [2027, '', 'spare', 20.25, '', '', '', 'plan-2'],
    [2027, 3, 'travel', 30, '', '', '', 'plan-3'],
  ],
}

describe('the chat deleting a category the pack’s records name into another', () => {
  it('moves the owner advance, the konto line and the plan rows in one write, says the plan row joins, keeps the plan’s totals, and Undo puts it all back', async () => {
    const desk = await companyDesk(used, {}, PACK_TABS)
    const before = hrDooWorkbook(desk.store.state.workbook!)

    const proposed = await desk.propose([{ op: 'delete-category', input: { category: desk.ref(CATEGORY_RECORDS.name, 'travel'), into: desk.ref(CATEGORY_RECORDS.name, 'spare') } }])
    expect(proposed.isError).toBe(false)
    expect(JSON.stringify(desk.cards.at(-1))).toContain(packWords.categoryNaming.planRowsJoined(1).one)

    const accepted = await desk.accept()
    expect(accepted.kind).toBe('done')
    const after = hrDooWorkbook(desk.store.state.workbook!)
    expect(after.categories.some((category) => category.slug === 'travel')).toBe(false)
    expect(after.ownerAdvances.map((advance) => advance.category)).toEqual(['spare'])
    expect(after.yearEndLines.map((line) => line.categories)).toEqual([['spare']])
    expect(after.planLines.map((line) => (line.kind === 'amount' ? [line.month, line.item, line.amount] : null))).toEqual([
      [null, 'spare', moneyFromAmount(120.75)],
      [3, 'spare', moneyFromAmount(30)],
    ])
    expect(planTotals(after.planLines)).toEqual(planTotals(before.planLines))

    if (accepted.kind === 'done') await accepted.undo!()
    const undone = hrDooWorkbook(desk.store.state.workbook!)
    // Undo adds the joined row back at the end of its tab.
    expect([...undone.planLines].sort((left, right) => left.id.localeCompare(right.id))).toEqual(before.planLines)
    expect(undone.ownerAdvances).toEqual(before.ownerAdvances)
    expect(undone.yearEndLines).toEqual(before.yearEndLines)
  })

  it('refuses while a plan row the plan tab cannot read names the category, and says where to fix it', async () => {
    const desk = await companyDesk(used, {}, { ...PACK_TABS, plan: [...PACK_TABS.plan, [2027, 4, 'travel', '', 'amount to come', '', '', 'plan-4']] })

    const refused = await desk.propose([{ op: 'delete-category', input: { category: desk.ref(CATEGORY_RECORDS.name, 'travel'), into: desk.ref(CATEGORY_RECORDS.name, 'spare') } }])

    expect(refused.isError).toBe(true)
    expect(refused.text).toContain(packWords.links.yearPlan)
  })
})
