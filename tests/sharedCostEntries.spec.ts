import { describe, expect, it } from 'vitest'

import { entriesAndSharedCosts, eurosOfNewSharedCost, listedOnItsOwn } from '../src/apps/spending/sharedCosts/domain/sharedCostEntries'
import type { EntriesLine } from '../src/apps/spending/sharedCosts/domain/sharedCostEntries'
import { payeeNamed } from '../src/apps/spending/payees/domain/payeeDirectory'
import { payeeKey } from '../src/apps/spending/payees/domain/payeeKey'
import { BY_DAYS } from '../src/apps/spending/workbook/domain/event'
import type { SharedCost } from '../src/apps/spending/workbook/domain/sharedCost'
import { ITEM_RECORDS, SHARED_COST_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { StoredRow } from '../src/apps/spending/workbook/domain/transaction'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { ACCOUNTS, OTP, RATES, category, row, wholeItems } from './fixtures/spending'

const GIFTS = category('Family and gifts/Gifts')

/** The gift for Ana, all made up: two shops on 20 November and Petra paying back 30.00 on 5 December. */
const GIFT: SharedCost = { id: recordIdOf(SHARED_COST_RECORDS, 'shared-cost-gift'), day: civil('2026-11-20'), payee: 'Ana', category: GIFTS.id, labels: [], event: BY_DAYS, note: '', settled: false }

const bookshop = row(OTP, '2026-11-20', -40, 'In a shared cost', { payee: 'Bookshop' })
const flowers = row(OTP, '2026-11-20', -50, 'In a shared cost', { payee: 'Flower shop' })
const bakery = row(OTP, '2026-11-20', -5, 'Food/Groceries', { payee: 'Bakery' })
const lunch = row(OTP, '2026-11-22', -20, 'Food/Groceries', { payee: 'Market' })
const petra = row(OTP, '2026-12-05', 30, 'In a shared cost', { payee: 'Petra' })
const coffee = row(OTP, '2026-12-06', -3, 'Food/Groceries', { payee: 'Café' })

const ROWS = [bookshop, flowers, bakery, lunch, petra, coffee]
const MEMBERS = new Set([bookshop.id, flowers.id, petra.id])

function items(rows: readonly StoredRow[]): readonly TransactionItem[] {
  return wholeItems(rows).map((item) => (item.transaction !== null && MEMBERS.has(item.transaction) ? { ...item, sharedCost: GIFT.id } : item))
}

function linesOf(rows: readonly StoredRow[] = ROWS, held: readonly TransactionItem[] = items(rows)): EntriesLine[] {
  return entriesAndSharedCosts({ accounts: ACCOUNTS, transactions: rows, items: held, sharedCosts: [GIFT] }, RATES)
}

const keyOf = (line: EntriesLine): string => (line.kind === 'entry' ? line.row.transaction.payee : `shared:${line.entry.sharedCost.payee}`)

describe("Entries' shared costs", () => {
  it('list each shared cost on its own day before the entries of that day, newest day first', () => {
    expect(linesOf().map(keyOf)).toEqual(['Café', 'Market', 'shared:Ana', 'Bakery'])
  })

  it('list a repayment from another month only under its shared cost, with its own day, and the purchases there too', () => {
    const shared = linesOf().find((line) => line.kind === 'shared-cost')

    expect(shared?.kind === 'shared-cost' ? shared.entry.members.map(({ row: member }) => [member.transaction.payee, member.transaction.date]) : []).toEqual([
      ['Bookshop', civil('2026-11-20')],
      ['Flower shop', civil('2026-11-20')],
      ['Petra', civil('2026-12-05')],
    ])
  })

  it('count 60.00 out under the shared cost, the purchases less what came back', () => {
    const shared = linesOf().find((line) => line.kind === 'shared-cost')

    // 40.00 and 50.00 out, 30.00 back.
    expect(shared?.kind === 'shared-cost' ? shared.entry.counted.parts[0]?.euros : null).toEqual(euros(-60))
  })

  it('keep a split entry with one part in a shared cost as an entry of its own, and that part under the shared cost', () => {
    const [part] = items([bakery])
    const split = [
      { ...part!, id: recordIdOf(ITEM_RECORDS, 'part-one'), sharedCost: GIFT.id },
      { ...part!, id: recordIdOf(ITEM_RECORDS, 'part-two') },
    ]

    expect(listedOnItsOwn({ items: split })).toBe(true)
    expect(listedOnItsOwn({ items: [split[0]!] })).toBe(false)
  })

  it('count what a shared cost made of the picked rows would hold, every part of each', () => {
    // 40.00 and 50.00 out, 30.00 back.
    expect(eurosOfNewSharedCost({ accounts: ACCOUNTS, items: wholeItems(ROWS) }, [bookshop, flowers, petra], RATES)).toEqual(euros(-60))
  })

  it("find the shared cost's payee for Entries' payee filter, though no entry names them", () => {
    expect(payeeNamed({ transactions: ROWS, items: items(ROWS), sharedCosts: [GIFT], payees: [] }, payeeKey('Ana'))).toEqual({ key: payeeKey('Ana'), name: 'Ana' })
  })
})
