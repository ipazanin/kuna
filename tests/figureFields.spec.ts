import { describe, expect, it } from 'vitest'

import { reviewQueue } from '../src/apps/spending/statements/domain/reviewQueue'
import { fakeSpendingDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending'
import { SPENDING_DOCUMENT } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { civil } from './fixtures/ledger'
import { fakeInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/fake/fakeInvestments'
import { INVESTMENTS_DOCUMENT } from '../src/apps/investments/workbook/infrastructure/investmentsDocument'
import {
  COMPANY_ADVANCE,
  COMPANY_ITEM,
  COMPANY_LEDGER_ROW,
  INVESTMENT_ACCOUNT,
  SPENDING_ACCOUNT,
  SPENDING_ITEM,
  SPENDING_ROW,
  companyFiguresOf,
  companyKindOf,
  investmentsFiguresOf,
  investmentsKindOf,
  spendingFiguresOf,
  spendingKindOf,
  withoutAdvanceLabels,
} from '../scripts/support/figureFields.mjs'
import { OWNER_ADVANCE_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { recordsOfKindIn } from '../src/apps/company/workbook/domain/readWorkbook'

const DAY = civil('2026-11-10')
const SAVED_AT = '2026-01-01T00:00:00.000Z'

/**
 * The fields and stored cells of each kind the figure digest hashes. A field or a cell neither here nor left out fails, so
 * whoever adds one decides. A cell the fake files leave blank need not show.
 */
const KINDS = {
  'a Spending row': {
    kind: SPENDING_ROW,
    figures: ['account', 'amount', 'category', 'date', 'id', 'note', 'pair', 'payee', 'source'],
    cells: ['account', 'amount', 'category', 'date', 'id', 'note', 'pair', 'payee', 'source'],
  },
  'a Spending item': {
    kind: SPENDING_ITEM,
    figures: ['amount', 'category', 'id', 'note', 'printed', 'receipt', 'transaction'],
    cells: ['amount', 'category', 'id', 'note', 'printed', 'receipt', 'transaction'],
  },
  'a Spending account': {
    kind: SPENDING_ACCOUNT,
    figures: ['bank', 'closed', 'currency', 'iban', 'id', 'kind', 'name', 'openedOn', 'opening'],
    cells: ['bank', 'closed', 'currency', 'iban', 'id', 'kind', 'name', 'opened_on', 'opening'],
  },
  'an Investments account': {
    kind: INVESTMENT_ACCOUNT,
    figures: ['id', 'name', 'note'],
    cells: ['id', 'name', 'note'],
  },
  'a Company ledger row': {
    kind: COMPANY_LEDGER_ROW,
    figures: ['account', 'amount', 'balance', 'category', 'counterparty', 'date', 'id', 'ownerShare', 'reviewReasons', 'rowId'],
    cells: ['account', 'amount', 'balance', 'category', 'counterparty', 'date', 'id', 'owner_share', 'review_reasons'],
  },
  'a Company item': {
    kind: COMPANY_ITEM,
    figures: ['amount', 'category', 'id', 'invoice', 'note', 'ownerShare', 'row'],
    cells: ['amount', 'category', 'id', 'invoice_id', 'note', 'owner_share', 'row_id'],
  },
  'a cost the owner paid': {
    kind: COMPANY_ADVANCE,
    figures: ['amount', 'category', 'date', 'description', 'id', 'ownerShare', 'repaidBy'],
    cells: ['amount', 'category', 'date', 'description', 'id', 'items', 'owner_share'],
  },
} as const

const spending = SPENDING_DOCUMENT.read({
  meta: { id: 'figures', source: 'browser', title: 'figures', syncedAt: SAVED_AT, lastExportedAt: null, unexportedSince: null },
  revision: '1',
  document: fakeSpendingDocument(SAVED_AT, 'cash', DAY),
})
const investments = INVESTMENTS_DOCUMENT.read({
  meta: { id: 'figures', source: 'browser', title: 'figures', syncedAt: SAVED_AT, lastExportedAt: null, unexportedSince: null },
  revision: '1',
  document: fakeInvestmentsDocument(SAVED_AT, 'mail', DAY),
})
const company = readDocument({ id: 'figures', source: 'browser', title: 'figures', syncedAt: SAVED_AT }, fakeWorkbookDocument(SAVED_AT, 'drive'))

interface Stored {
  readonly record: object
  readonly fields: object
}

const STORED: Record<keyof typeof KINDS, readonly Stored[]> = {
  'a Spending row': spending.records.transactions.records,
  'a Spending item': spending.records.items.records,
  'a Spending account': spending.records.accounts.records,
  'an Investments account': investments.records.accounts.records,
  'a Company ledger row': company.records.ledger.records,
  'a Company item': company.records.items.records,
  'a cost the owner paid': recordsOfKindIn(company.records, OWNER_ADVANCE_RECORDS).records,
}

type KindOf = (record: object) => { readonly record: ReadonlySet<string>; readonly cells: ReadonlySet<string> } | null

/**
 * Every field a value still holds that the kind of the record holding it leaves out, however deep, and every stored cell its
 * record's kind leaves out. A field of the same name on a record of another kind, such as the file's own labels, is no such field.
 */
function leftOutIn(value: unknown, kindOf: KindOf): string[] {
  if (value === null || typeof value !== 'object') return []
  if (Array.isArray(value) || value instanceof Set) return [...value].flatMap((entry: unknown) => leftOutIn(entry, kindOf))
  if (value instanceof Map) return [...value].flatMap(([key, entry]: [unknown, unknown]) => [...leftOutIn(key, kindOf), ...leftOutIn(entry, kindOf)])
  const kind = kindOf(value)
  const record = 'record' in value && 'fields' in value && value.record !== null && typeof value.record === 'object' ? value.record : null
  const cellsKind = record === null ? null : kindOf(record)
  return Object.entries(value).flatMap(([key, field]: [string, unknown]) => {
    if (key === 'fields' && cellsKind !== null && field !== null && typeof field === 'object') return Object.keys(field).filter((cell) => cellsKind.cells.has(cell))
    return [...(kind?.record.has(key) === true ? [key] : []), ...leftOutIn(field, kindOf)]
  })
}

describe("the figure digest's fields", () => {
  it.each(Object.keys(KINDS) as (keyof typeof KINDS)[])('names every field and stored cell of %s as a figure or as left out', (name) => {
    const { kind, figures, cells } = KINDS[name]
    const [{ record }] = STORED[name] as [Stored]
    const storedCells = new Set(STORED[name].flatMap(({ fields }) => Object.keys(fields)))

    expect(
      Object.keys(record)
        .filter((key) => !kind.record.has(key))
        .sort(),
    ).toEqual(figures)
    expect([...kind.record].filter((key) => !Object.hasOwn(record, key))).toEqual([])
    expect([...storedCells].filter((cell) => !kind.cells.has(cell) && !(cells as readonly string[]).includes(cell))).toEqual([])
  })

  it('leaves no field or stored cell that is not a figure in a Spending group, in Investments accounts or in Company ledger records, however deep', () => {
    const group = {
      queue: reviewQueue(spending.workbook, DAY),
      records: spending.records,
      byAccount: new Map(spending.workbook.accounts.map((held) => [held, spending.workbook.transactions])),
      rows: new Set(spending.workbook.transactions),
    }

    expect(leftOutIn(group, spendingKindOf)).toEqual(expect.arrayContaining(['import_key', 'labels', 'splitByLink']))
    expect(leftOutIn(spendingFiguresOf(group), spendingKindOf)).toEqual([])
    expect(leftOutIn(investments.records.accounts, investmentsKindOf)).toContain('sources')
    expect(leftOutIn(investmentsFiguresOf(investments.records).accounts, investmentsKindOf)).toEqual([])
    expect(leftOutIn(company.records.ledger, companyKindOf)).toContain('signals')
    expect(leftOutIn(companyFiguresOf(company.records).ledger, companyKindOf)).toEqual([])
    expect(leftOutIn(company.records.items, companyKindOf)).toContain('label_ids')
    expect(leftOutIn(companyFiguresOf(company.records).items, companyKindOf)).toEqual([])
    expect(leftOutIn(company.workbook.ownerAdvances, companyKindOf)).toContain('labels')
    expect(leftOutIn(withoutAdvanceLabels(company.workbook.ownerAdvances), companyKindOf)).toEqual([])
  })

  it('keeps every figure of a record and its stored cells', () => {
    const pick = (record: object, names: readonly string[]) => Object.fromEntries(Object.entries(record).filter(([key]) => names.includes(key)))
    const [row] = STORED['a Spending row'] as [Stored]
    const [entry] = STORED['a Company ledger row'] as [Stored]
    const rowKind = KINDS['a Spending row']
    const entryKind = KINDS['a Company ledger row']

    expect(spendingFiguresOf(row)).toMatchObject({ record: pick(row.record, rowKind.figures), fields: pick(row.fields, rowKind.cells) })
    expect(companyFiguresOf(entry)).toMatchObject({ record: pick(entry.record, entryKind.figures), fields: pick(entry.fields, entryKind.cells) })
  })
})
