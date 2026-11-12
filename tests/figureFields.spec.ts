import { describe, expect, it } from 'vitest'

import { reviewQueue } from '../src/apps/spending/statements/domain/reviewQueue'
import { fakeSpendingDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending'
import { SPENDING_DOCUMENT } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { civil } from './fixtures/ledger'
import { COMPANY_LEDGER_ROW, SPENDING_ACCOUNT, SPENDING_ROW, companyFiguresOf, spendingFiguresOf } from '../scripts/support/figureFields.mjs'

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
  'a Spending account': {
    kind: SPENDING_ACCOUNT,
    figures: ['bank', 'closed', 'currency', 'iban', 'id', 'kind', 'name', 'openedOn', 'opening'],
    cells: ['bank', 'closed', 'currency', 'iban', 'id', 'kind', 'name', 'opened_on', 'opening'],
  },
  'a Company ledger row': {
    kind: COMPANY_LEDGER_ROW,
    figures: ['account', 'amount', 'balance', 'category', 'counterparty', 'date', 'id', 'ownerShare', 'reviewReasons', 'rowId'],
    cells: ['account', 'amount', 'balance', 'category', 'counterparty', 'date', 'id', 'owner_share', 'review_reasons'],
  },
} as const

const spending = SPENDING_DOCUMENT.read({
  meta: { id: 'figures', source: 'browser', title: 'figures', syncedAt: SAVED_AT, lastExportedAt: null, unexportedSince: null },
  revision: '1',
  document: fakeSpendingDocument(SAVED_AT, 'cash', DAY),
})
const company = readDocument({ id: 'figures', source: 'browser', title: 'figures', syncedAt: SAVED_AT }, fakeWorkbookDocument(SAVED_AT, 'drive'))

interface Stored {
  readonly record: object
  readonly fields: object
}

const STORED: Record<keyof typeof KINDS, readonly Stored[]> = {
  'a Spending row': spending.records.transactions.records,
  'a Spending account': spending.records.accounts.records,
  'a Company ledger row': company.records.ledger.records,
}

/** The name of every field of every record in a value, however deep. */
function fieldsIn(value: unknown): string[] {
  if (value === null || typeof value !== 'object') return []
  if (Array.isArray(value) || value instanceof Set) return [...value].flatMap(fieldsIn)
  if (value instanceof Map) return [...value].flatMap(([key, entry]) => [...fieldsIn(key), ...fieldsIn(entry)])
  return Object.entries(value).flatMap(([key, field]) => [key, ...fieldsIn(field)])
}

/** Whether a field is one that one of these kinds leaves out. */
const leftOutOf =
  (...kinds: readonly { readonly record: ReadonlySet<string>; readonly cells: ReadonlySet<string> }[]) =>
  (field: string) =>
    kinds.some((kind) => kind.record.has(field) || kind.cells.has(field))

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

  it('leaves no field or stored cell that is not a figure in a Spending group or in Company ledger records, however deep', () => {
    const queue = reviewQueue(spending.workbook, DAY)
    const group = {
      queue,
      records: spending.records,
      byAccount: new Map(spending.workbook.accounts.map((held) => [held, spending.workbook.transactions])),
      rows: new Set(spending.workbook.transactions),
    }

    const spendingLeftOut = leftOutOf(SPENDING_ROW, SPENDING_ACCOUNT)
    const ledgerLeftOut = leftOutOf(COMPANY_LEDGER_ROW)

    expect(fieldsIn(group).filter(spendingLeftOut)).toContain('import_key')
    expect(fieldsIn(spendingFiguresOf(group)).filter(spendingLeftOut)).toEqual([])
    expect(fieldsIn(company.records.ledger).filter(ledgerLeftOut)).toContain('signals')
    expect(fieldsIn(companyFiguresOf(company.records).ledger).filter(ledgerLeftOut)).toEqual([])
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
