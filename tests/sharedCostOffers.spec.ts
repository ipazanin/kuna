import { describe, expect, it } from 'vitest'

import { entryCategoryChoices, pickedFilingOf } from '../src/apps/spending/entries/presentation/categoryChoices'
import { entrySplit } from '../src/apps/spending/entries/domain/entrySplit'
import { lineRefilesOf, refiledReceiptLines } from '../src/apps/spending/receipts/domain/receiptLines'
import { sharedCostFiling } from '../src/apps/spending/sharedCosts/application/sharedCostWrites'
import { onlyOpenSharedCost, openSharedCosts } from '../src/apps/spending/sharedCosts/domain/openSharedCosts'
import { BY_DAYS } from '../src/apps/spending/workbook/domain/event'
import type { SharedCost } from '../src/apps/spending/workbook/domain/sharedCost'
import { RECEIPT_RECORDS, SHARED_COST_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil } from './fixtures/ledger'
import { CATEGORIES, OTP, category, row, wholeItems } from './fixtures/spending'

const GIFTS = category('Family and gifts/Gifts')
const GROCERIES = category('Food/Groceries')
const FILED_IN = category('In a shared cost')

/** Made-up shared costs: a gift in November, a trip in October that is settled and a dinner in September. */
const sharedCost = (key: string, day: string, payee: string, settled = false): SharedCost => ({
  id: recordIdOf(SHARED_COST_RECORDS, key),
  day: civil(day),
  payee,
  category: GIFTS.id,
  labels: [],
  event: BY_DAYS,
  note: '',
  settled,
})
const GIFT = sharedCost('gift', '2026-11-20', 'Ana')
const TRIP = sharedCost('trip', '2026-10-02', 'Trip', true)
const DINNER = sharedCost('dinner', '2026-09-14', 'Dinner')
const ALL = [DINNER, TRIP, GIFT]

describe('the shared costs a picker offers', () => {
  it('offer every one not settled, newest first however old, and a settled one only to a part already in it', () => {
    expect(openSharedCosts(ALL).map((offered) => offered.payee)).toEqual(['Ana', 'Dinner'])
    expect(openSharedCosts(ALL, [TRIP.id]).map((offered) => offered.payee)).toEqual(['Ana', 'Trip', 'Dinner'])
  })

  it('name the one shared cost a repayment may be for only while exactly one is not settled', () => {
    expect(onlyOpenSharedCost(ALL)).toBeNull()
    expect(onlyOpenSharedCost([GIFT, TRIP])).toEqual(GIFT)
    expect(onlyOpenSharedCost([TRIP])).toBeNull()
  })

  it('list the shared costs under their own heading after the categories, and never In a shared cost as a bare choice', () => {
    const choices = entryCategoryChoices(CATEGORIES, 'out', FILED_IN.id, { sharedCosts: [{ sharedCost: GIFT, name: 'Ana' }] })
    const last = choices.at(-1)!

    expect(last.map((choice) => choice.label)).toEqual(['Shared costs', 'Ana'])
    expect(last[1]?.value).toBe(GIFT.id)
    expect(choices.flat().map((choice) => choice.label)).not.toContain('In a shared cost')
  })

  it('read a choice back as the category or the shared cost it names', () => {
    expect(pickedFilingOf(GIFT.id, CATEGORIES, ALL)).toEqual({ sharedCost: GIFT.id })
    expect(pickedFilingOf(GROCERIES.id, CATEGORIES, ALL)).toEqual({ category: GROCERIES.id })
    expect(pickedFilingOf('nothing', CATEGORIES, ALL)).toBeNull()
  })
})

describe('filing a part in a shared cost', () => {
  it('puts a part that joins under In a shared cost, and one filed under a category out of any shared cost', () => {
    const filing = sharedCostFiling(CATEGORIES, 'en')

    expect(filing.fields({ sharedCost: GIFT.id })).toEqual({ category: FILED_IN.id, sharedCost: GIFT.id })
    expect(filing.fields({ category: GROCERIES.id })).toEqual({ category: GROCERIES.id, sharedCost: null })
    expect(filing.added).toBeNull()
  })

  it('adds In a shared cost to a file made before it, in the write a part joins', () => {
    const filing = sharedCostFiling(
      CATEGORIES.filter((held) => held.kind !== 'shared-cost'),
      'en',
    )

    expect(filing.added?.kind).toBe('shared-cost')
    expect(filing.categories.some((held) => held.id === filing.filedIn)).toBe(true)
  })

  it("splits an entry with one part in the gift and the rest under Groceries, and refuses a linked part's joining", () => {
    const shop = row(OTP, '2026-11-20', -84, 'Food/Groceries', { payee: 'Market' })
    const items = wholeItems([shop])
    const book = { categories: CATEGORIES, receipts: [], items }
    const drafts = [
      { id: null, amount: accountMoneyFromAmount(-42), category: FILED_IN.id, sharedCost: GIFT.id, note: '' },
      { id: null, amount: 'rest' as const, category: GROCERIES.id, note: '' },
    ]
    const split = entrySplit(book, shop, drafts)

    expect('refused' in split ? [] : split.parts.map((part) => [part.category, part.sharedCost])).toEqual([
      [FILED_IN.id, GIFT.id],
      [GROCERIES.id, null],
    ])
    const linked = { ...book, items: items.map((item) => ({ ...item, link: { app: 'loans', kind: 'movement', key: 'loan-1', due: null } })) }
    expect(entrySplit(linked, shop, drafts)).toEqual({ refused: 'linked-member' })
  })

  it('refiles a receipt line picked in a shared cost under In a shared cost, naming the shared cost', () => {
    const shop = row(OTP, '2026-11-20', -12, 'Food/Groceries', { payee: 'Market' })
    const [line] = wholeItems([shop])
    const receiptLine = { ...line!, receipt: recordIdOf(RECEIPT_RECORDS, 'receipt-wine') }
    const filed = lineRefilesOf(CATEGORIES, [receiptLine], { [receiptLine.id]: { category: GIFT.id, note: 'Wine' } }, { sharedCosts: ALL, filedIn: FILED_IN.id })

    expect(filed.refiles).toEqual([{ line: receiptLine.id, category: FILED_IN.id, sharedCost: GIFT.id, note: 'Wine', payee: '' }])
    expect(filed.lines[0]?.sharedCost).toBe(GIFT.id)
  })

  it('refuses to put a receipt line linked to a record in another app in a shared cost, so the dialog says Unlink it first under the line', () => {
    const shop = row(OTP, '2026-11-20', -12, 'Food/Groceries', { payee: 'Market' })
    const [line] = wholeItems([shop])
    const linked = { ...line!, receipt: recordIdOf(RECEIPT_RECORDS, 'receipt-wine'), link: { app: 'loans', kind: 'movement', key: 'loan-1', due: null } }
    const joining = { sharedCosts: ALL, filedIn: FILED_IN.id }

    const filed = lineRefilesOf(CATEGORIES, [linked], { [linked.id]: { category: GIFT.id, note: 'Wine' } }, joining)
    expect(filed.refused.get(linked.id)).toBe('linked-member')
    expect(filed.refiles).toEqual([])
    expect(lineRefilesOf(CATEGORIES, [linked], { [linked.id]: { category: GROCERIES.id, note: 'Wine' } }, joining).refused.size).toBe(0)
    expect(refiledReceiptLines(CATEGORIES, [linked], [{ line: linked.id, category: FILED_IN.id, sharedCost: GIFT.id, note: 'Wine', payee: '' }])).toEqual({ refused: 'linked-member' })
  })
})
