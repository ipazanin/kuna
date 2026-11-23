import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { countedRows } from '../src/apps/spending/analytics/domain/countedRow'
import { monthTotals } from '../src/apps/spending/analytics/domain/monthTotals'
import { spanBreakdown } from '../src/apps/spending/analytics/domain/spanBreakdown'
import { newEntry, retypedEntry, unsplitItem, writeEntry, writeEntrySplit } from '../src/apps/spending/entries/application/entryWrites'
import { entrySplit, halfAndHalf } from '../src/apps/spending/entries/domain/entrySplit'
import { payeeNamed } from '../src/apps/spending/overview/presentation/spendingLinks'
import { payeeKey } from '../src/apps/spending/payees/domain/payeeKey'
import { countsUnderPayee, payeeTotals } from '../src/apps/spending/payees/domain/payeeTotals'
import { splitIntoParts } from '../src/apps/spending/links/domain/instalmentParts'
import { fileRows } from '../src/apps/spending/statements/application/statementWrites'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import type { Payee } from '../src/apps/spending/workbook/domain/payee'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, ITEM_RECORDS, PAYEE_RECORDS, TRANSACTION_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { BLANK_CELLS, storedRowOf } from '../src/apps/spending/workbook/domain/transaction'
import type { StoredRow } from '../src/apps/spending/workbook/domain/transaction'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { spendingDocumentOf } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { monthKey } from '../src/shared/calendar/monthKey'
import { monthRange } from '../src/shared/calendar/dateRange'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { civil, euros } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, RATES, bookItems, category, row, wholeItems } from './fixtures/spending'
import { SPENDING, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const EATING_OUT = category('Food/Eating out')
const GIFTS = category('Family and gifts/Gifts')
const BISTRO_IBAN = 'HR1210010051863000160'

/** 84.00 at Harbour bistro on 14 November, when you treated Ana: half your meal, half hers. */
const meal = row(OTP, '2026-11-14', -84, 'Food/Eating out', { payee: 'Harbour bistro', counterpartyIban: BISTRO_IBAN })
const [yours, hers] = [
  { ...wholeItems([meal])[0]!, amount: accountMoneyFromAmount(-42) },
  { ...wholeItems([meal])[0]!, id: recordIdOf(ITEM_RECORDS, 'meal-ana'), amount: accountMoneyFromAmount(-42), category: GIFTS.id, payee: 'Ana' },
] satisfies TransactionItem[]
const book = { accounts: ACCOUNTS, transactions: [meal], items: [yours, hers] }
const rows = countedRows(book, RATES)

describe('a part that counts under a payee of its own', () => {
  it('leaves total spending at the whole entry', () => {
    expect(monthTotals(rows, CATEGORIES, monthKey(2026, 11)).spent).toEqual(euros(84))
  })

  it('counts 42.00 under the bistro and 42.00 under Ana, one entry each, and only the bistro keeps the IBAN', () => {
    const totals = payeeTotals(rows, CATEGORIES)

    expect(totals.map(({ name, spent, rows: entries, latest, ibans }) => ({ name, spent, entries, latest, ibans }))).toEqual([
      { name: 'Ana', spent: euros(42), entries: 1, latest: civil('2026-11-14'), ibans: [] },
      { name: 'Harbour bistro', spent: euros(42), entries: 1, latest: civil('2026-11-14'), ibans: [BISTRO_IBAN] },
    ])
  })

  it('counts the same on Analysis by payee', () => {
    const lines = spanBreakdown(rows, { categories: CATEGORIES, labels: [], accounts: ACCOUNTS }, monthRange(monthKey(2026, 11)), 'payee').lines

    expect(lines.map((line) => [line.name, line.spent])).toEqual([
      ['Ana', euros(42)],
      ['Harbour bistro', euros(42)],
    ])
  })

  it("counts a part whose payee is the entry's own under the entry's spelling and IBAN", () => {
    const totals = payeeTotals(countedRows({ ...book, items: [{ ...yours, payee: 'HARBOUR BISTRO' }, hers] }, RATES), CATEGORIES)

    expect(totals.find((payee) => payee.key === payeeKey('Harbour bistro'))).toMatchObject({ name: 'Harbour bistro', ibans: [BISTRO_IBAN] })
  })

  it('counts all of an entry not split under another payee, and nothing under the entry payee', () => {
    const flowers = row(OTP, '2026-11-02', -30, 'Family and gifts/Gifts', { payee: 'Florist' })
    const totals = payeeTotals(countedRows({ accounts: ACCOUNTS, transactions: [flowers], items: [{ ...wholeItems([flowers])[0]!, payee: 'Ana' }] }, RATES), CATEGORIES)

    expect(totals.map((payee) => [payee.name, payee.spent])).toEqual([['Ana', euros(30)]])
  })

  it("names the payee a filter picks from a part's payee too", () => {
    expect(payeeNamed(book, payeeKey('Ana'))).toEqual({ key: payeeKey('Ana'), name: 'Ana' })
  })

  it('lists the entry under each payee its parts count under, and under no other', () => {
    const [counted] = rows

    expect([payeeKey('Ana'), payeeKey('Harbour bistro'), payeeKey('Florist')].map((key) => countsUnderPayee(counted!, key))).toEqual([true, true, false])
  })
})

describe('keeping a part payee through other writes', () => {
  const typedFlowers = (countsUnder?: string, note = '', payee = 'Florist') =>
    newEntry({ account: OTP.id, date: civil('2026-11-02'), amount: accountMoneyFromAmount(-30), payee, category: GIFTS.id, note, labels: [], ...(countsUnder === undefined ? {} : { countsUnder }) })

  it('takes who the entry dialog types an entry not split counts under, and blank brings it back to the entry payee', () => {
    const before = typedFlowers('Ana')

    expect(retypedEntry(before, typedFlowers('Ana', 'For her birthday')).items.map((item) => [item.note, item.payee])).toEqual([['For her birthday', 'Ana']])
    expect(retypedEntry(before, typedFlowers('Marko')).items.map((item) => item.payee)).toEqual(['Marko'])
    expect(retypedEntry(before, typedFlowers(undefined)).items.map((item) => item.payee)).toEqual([''])
  })

  it('takes the payee the entry dialog types on a part split by hand, and keeps the others', () => {
    const before = { row: meal, items: [yours, hers] }
    const typed = { row: meal, items: [{ ...yours, payee: 'Marko' }, hers] }

    expect(retypedEntry(before, typed).items.map((item) => item.payee)).toEqual(['Marko', hers.payee])
    expect(retypedEntry(before, { row: meal, items: [] }).items.map((item) => item.payee)).toEqual([yours.payee, hers.payee])
  })

  it("keeps no payee of its own once the entry's payee is retyped to the one it counted under", () => {
    expect(retypedEntry(typedFlowers('Ana'), typedFlowers(undefined, '', 'Ana')).items.map((item) => item.payee)).toEqual([''])
  })

  it('keeps the payee every part counted under when the split comes off, and none when the parts differ', () => {
    expect(unsplitItem(meal, [{ ...yours, payee: 'Ana' }, hers]).payee).toBe('Ana')
    expect(unsplitItem(meal, [yours, hers]).payee).toBe('')
  })

  it('keeps the payee all of an entry counted under on the parts a link splits it into', () => {
    const link = { app: 'investments', kind: 'loan', key: 'car', due: null }
    const [first] = typedFlowers('Ana').items
    const linked = splitIntoParts(
      { row: typedFlowers('Ana').row, items: [first!] },
      [
        [accountMoneyFromAmount(-20), GIFTS.id, '', link],
        [accountMoneyFromAmount(-10), EATING_OUT.id, '', link],
      ],
      () => 'part-two',
    )

    expect(linked.items.map((item) => item.payee)).toEqual(['Ana', 'Ana'])
  })
})

describe('splitting with a part payee', () => {
  it("keeps no payee on a part that names the entry's payee", () => {
    const split = entrySplit({ categories: CATEGORIES, receipts: [], items: [] }, meal, [
      { id: null, amount: accountMoneyFromAmount(-42), category: EATING_OUT.id, note: '', payee: ' harbour bistro ' },
      { id: null, amount: 'rest', category: GIFTS.id, note: '', payee: ' Ana ' },
    ])

    expect('parts' in split && split.parts.map((part) => part.payee)).toEqual(['', 'Ana'])
  })

  it('halves 84.01 as 42.01 and 42.00, the first part taking the cent, and money in the same way', () => {
    expect(halfAndHalf(accountMoneyFromAmount(-84.01))).toEqual([accountMoneyFromAmount(-42.01), accountMoneyFromAmount(-42)])
    expect(halfAndHalf(accountMoneyFromAmount(0.03))).toEqual([accountMoneyFromAmount(0.02), accountMoneyFromAmount(0.01)])
  })

  it('takes the payee of an entry not split as typed', () => {
    const typed = newEntry({ account: OTP.id, date: civil('2026-11-02'), amount: accountMoneyFromAmount(-30), payee: 'Florist', category: GIFTS.id, note: '', labels: [], countsUnder: ' Ana ' })

    expect(typed.items.map((item) => item.payee)).toEqual(['Ana'])
  })
})

function stored<R>(kind: RecordKind<R>, records: readonly R[]) {
  const codec = codecOfSpendingKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

async function storeWith(rows: readonly StoredRow[], payees: readonly Payee[] = []) {
  const document = spendingDocumentOf('2026-11-04T09:00:00.000Z', {
    ...stored(ACCOUNT_RECORDS, ACCOUNTS),
    ...stored(CATEGORY_RECORDS, CATEGORIES),
    ...stored(
      TRANSACTION_RECORDS,
      rows.map((held) => storedRowOf(held, BLANK_CELLS)),
    ),
    ...stored(ITEM_RECORDS, bookItems(rows)),
    ...stored(PAYEE_RECORDS, payees),
  })
  return (await browserHarness(used, document, SPENDING)).store
}

describe('writing a part payee', () => {
  it('adds a name no payee or entry holds as a person in the same write, and one Undo takes both back', async () => {
    const market = row(OTP, '2026-11-01', -5, 'Food/Groceries', { payee: 'Corner market' })
    const store = await storeWith([meal, market])
    const book = () => store.state.workbook!
    const split = entrySplit(
      book(),
      book().transactions.find((held) => held.id === meal.id)!,
      [
        { id: null, amount: accountMoneyFromAmount(-42), category: EATING_OUT.id, note: '', payee: 'Corner market' },
        { id: null, amount: 'rest', category: GIFTS.id, note: '', payee: 'Marko' },
      ],
    )
    if ('refused' in split) throw new Error(split.refused)

    await store.write('Split', (unit) => writeEntrySplit(unit, store.state.records!, split))

    expect(book().problems).toEqual([])
    expect(
      book()
        .items.filter((item) => item.transaction === meal.id)
        .map((item) => item.payee),
    ).toEqual(['Corner market', 'Marko'])
    expect(book().payees.map((payee) => [payee.names, payee.party])).toEqual([[['Marko'], 'person']])

    await store.undo(store.state.writes[0]!)

    expect(book().payees).toEqual([])
    expect(
      book()
        .items.filter((item) => item.transaction === meal.id)
        .map((item) => item.payee),
    ).toEqual([''])
  })
})

describe('filing a row that counts under another payee', () => {
  it('drops its payee once it is filed as a move between your own accounts', async () => {
    const flowers = row(OTP, '2026-11-02', -30, 'Family and gifts/Gifts', { payee: 'Florist' })
    const store = await storeWith([flowers])
    const book = () => store.state.workbook!
    const itemized = () => ({ row: book().transactions.find((held) => held.id === flowers.id)!, items: book().items.filter((item) => item.transaction === flowers.id) })
    const typed = newEntry({ account: OTP.id, date: flowers.date, amount: flowers.amount, payee: 'Florist', category: GIFTS.id, note: '', labels: [], countsUnder: 'Ana' })

    await store.write('Counts under Ana', (unit) => writeEntry(unit, store.state.records!, itemized(), typed, null))
    expect(itemized().items.map((item) => item.payee)).toEqual(['Ana'])

    await store.write('Filed', (unit) => fileRows(unit, store.state.records!, [itemized().row], category('Between my accounts')))

    expect(itemized().items.map((item) => [item.category, item.payee])).toEqual([[category('Between my accounts').id, '']])
  })
})
