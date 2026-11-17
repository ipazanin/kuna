import { describe, expect, it } from 'vitest'

import { DEFAULT_FILTERS } from '../src/apps/company/filters/domain/filterState'
import type { FilterState } from '../src/apps/company/filters/domain/filterState'
import { filterTransactions, scopeTransactions, wholeRowLabels } from '../src/apps/company/transactions/domain/filterTransactions'
import type { ItemLabels } from '../src/apps/company/transactions/domain/filterTransactions'
import { ITEM_RECORDS, LABEL_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { wholeItemId } from '../src/apps/company/workbook/domain/splits'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { euros, ledger, windowOf } from './fixtures/ledger'

/** No item carries a label in these books. */
const NO_LABELS: ItemLabels = new Map()

const window = windowOf('2026-06-03', '2026-10-05')

const rows = ledger([
  { date: '2026-06-03', amount: 7200, category: 'revenue', counterparty: 'Northwind Ltd', iban: 'XX00FAKE0010' },
  { date: '2026-07-12', amount: -1100, category: 'salary-net', counterparty: 'Alex Example', iban: 'XX00FAKE0020' },
  { date: '2026-08-09', amount: -70, category: 'travel', counterparty: 'BISTRO HARBOUR · lunch', description: 'Ručak s klijentom' },
  { date: '2026-09-20', amount: -150, category: 'accounting', account: 'legacy', counterparty: 'Brightdesk', iban: 'XX00FAKE0040', flaggedBy: 'ai' },
  { date: '2026-10-05', amount: -6.4, category: 'mystery', counterparty: 'SNACK KIOSK' },
])

function amountsFor(filters: Partial<FilterState>): number[] {
  return filterTransactions(rows, { ...DEFAULT_FILTERS, period: { preset: 'all' }, ...filters }, NO_LABELS, window).map((row) => row.amount)
}

describe('filterTransactions', () => {
  it('applies the period, against the whole ledger’s window', () => {
    expect(amountsFor({ period: { preset: 'l3' } })).toEqual([euros(-6.4), euros(-150), euros(-70)])
    expect(amountsFor({ period: { preset: 'all' } })).toHaveLength(5)
  })

  it('narrows by account, bucket, family and category', () => {
    expect(amountsFor({ accounts: ['legacy'] })).toEqual([euros(-150)])
    expect(amountsFor({ buckets: ['owner-pay', 'unclassified'] })).toEqual([euros(-6.4), euros(-1100)])
    expect(amountsFor({ families: ['income'] })).toEqual([euros(7200)])
    expect(amountsFor({ categories: ['travel', 'accounting'] })).toEqual([euros(-150), euros(-70)])
  })

  it('narrows by counterparty key, IBAN first, else the folded name before the description mark', () => {
    expect(amountsFor({ counterparties: ['iban:XX00FAKE0020'] })).toEqual([euros(-1100)])
    expect(amountsFor({ counterparties: ['name:BISTRO HARBOUR'] })).toEqual([euros(-70)])
  })

  it('matches text with accents and case folded away', () => {
    expect(amountsFor({ text: 'rucak' })).toEqual([euros(-70)])
    expect(amountsFor({ text: 'northwind' })).toEqual([euros(7200)])
  })

  it('bounds the signed amount at both ends, ends included', () => {
    expect(amountsFor({ amount: { min: euros(-150), max: euros(-6.4) } })).toEqual([euros(-6.4), euros(-150), euros(-70)])
    expect(amountsFor({ amount: { min: euros(0.01), max: null } })).toEqual([euros(7200)])
  })

  it('keeps the rows no rule settled and the unclassified ones when asked for the review queue', () => {
    expect(amountsFor({ needsReview: true })).toEqual([euros(-6.4), euros(-150)])
  })

  it('scopes without the period, for screens that apply their own', () => {
    expect(scopeTransactions(rows, { ...DEFAULT_FILTERS, period: { preset: 'l3' }, accounts: ['main'] }, NO_LABELS)).toHaveLength(4)
  })

  it('keeps a row a part of which carries a label picked, and a split row as the bank booked it by any label of its parts', () => {
    const berlin = recordIdOf(LABEL_RECORDS, 'berlin')
    const office = recordIdOf(LABEL_RECORDS, 'office')
    const [first, second] = rows
    const labelled: ItemLabels = new Map([[wholeItemId(second!), [berlin]]])
    expect(scopeTransactions(rows, { ...DEFAULT_FILTERS, labels: [berlin, office] }, labelled)).toEqual([second])
    expect(scopeTransactions(rows, { ...DEFAULT_FILTERS, labels: [office] }, labelled)).toEqual([])

    const part = recordIdOf(ITEM_RECORDS, 'part-1')
    const split = { row: first!, parts: [{ id: part, amount: first!.amount, category: 'revenue', family: 'income', bucket: 'income' as const, note: '', ownerShare: null }] }
    const wholes = wholeRowLabels(new Map([[part, [office]]]), [split])
    expect(scopeTransactions(rows, { ...DEFAULT_FILTERS, labels: [office] }, wholes)).toEqual([first])
  })
})
