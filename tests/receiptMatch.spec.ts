import { describe, expect, it } from 'vitest'

import { NEW_ENTRY, heldReceiptOf, placeOf, receiptAccounts, receiptMatches, splittableRows } from '../src/apps/spending/receipts/domain/receiptMatch'
import { rowsTakingReceipt } from '../src/apps/spending/statements/domain/reviewQueue'
import { RECEIPT_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { SpendingBook } from '../src/apps/spending/workbook/domain/readSpendingBook'
import type { Receipt } from '../src/apps/spending/workbook/domain/receipt'
import { spendingSettingsOf } from '../src/apps/spending/workbook/domain/spendingSettings'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { ACCOUNTS, CASH, CATEGORIES, OTP, REVOLUT_EUR, REVOLUT_USD, row, storedBeforeItems, wholeItems } from './fixtures/spending'

const ISSUED = civil('2026-11-03')

function matchesOf(rows: readonly Transaction[], merchant = '', total = 23.49, receipts: readonly Receipt[] = []) {
  return receiptMatches({ merchant, issuedOn: ISSUED, total: euros(total) }, { accounts: ACCOUNTS, categories: CATEGORIES, transactions: rows, receipts, items: wholeItems(rows) }, null)
}

function rowsOf(matches: ReturnType<typeof matchesOf>) {
  return matches.kind === 'none' ? [] : matches.candidates.map((candidate) => candidate.row)
}

describe('which rows a receipt may split', () => {
  it('offers one candidate ready', () => {
    const card = row(OTP, '2026-11-04', -23.49, null, { payee: 'Corner market' })

    expect(matchesOf([card])).toEqual({ kind: 'ready', candidates: [{ row: card, difference: euros(0) }] })
  })

  it('asks for a pick of two equal payments, the nearest day first', () => {
    const later = row(OTP, '2026-11-08', -23.49, null)
    const sooner = row(REVOLUT_EUR, '2026-11-04', -23.49, null)
    const matches = matchesOf([later, sooner])

    expect(matches.kind).toBe('pick')
    expect(rowsOf(matches)).toEqual([sooner, later])
  })

  it("takes the one whose text holds the merchant's words as clear, whatever its day", () => {
    const nearer = row(OTP, '2026-11-03', -23.49, null, { payee: 'Bookshop' })
    const named = row(REVOLUT_EUR, '2026-11-06', -23.49, null, { description: 'POS KONZUM PJ 0412' })
    const matches = matchesOf([nearer, named], 'Konzum d.d.')

    expect(matches.kind).toBe('ready')
    expect(rowsOf(matches)).toEqual([named, nearer])
  })

  it('folds accents in the merchant and the row alike, and leaves out the bits of a company form', () => {
    const named = row(OTP, '2026-11-04', -23.49, null, { payee: 'SLASTICARNA' })
    const other = row(OTP, '2026-11-04', -23.49, null, { payee: 'D.O.O. Other' })

    expect(rowsOf(matchesOf([other, named], 'Slastičarna d.o.o.'))[0]).toBe(named)
  })

  it('stays inside the window of 3 days before the receipt to 7 after', () => {
    expect(matchesOf([row(OTP, '2026-10-31', -23.49, null)]).kind).toBe('ready')
    expect(matchesOf([row(OTP, '2026-11-10', -23.49, null)]).kind).toBe('ready')
  })

  it('offers an equal amount further off, and an amount within a tenth, only as a pick with its difference', () => {
    const further = row(OTP, '2026-11-15', -23.49, null)
    const tip = row(OTP, '2026-11-04', -25, null)
    const matches = matchesOf([further, tip])

    expect(matches.kind).toBe('pick')
    expect(matches).toMatchObject({
      candidates: [
        { row: tip, difference: euros(-1.51) },
        { row: further, difference: euros(0) },
      ],
    })
  })

  it('leaves the near ones out while an equal amount is in the window', () => {
    const exact = row(OTP, '2026-11-04', -23.49, null)

    expect(rowsOf(matchesOf([exact, row(OTP, '2026-11-04', -25, null)]))).toEqual([exact])
  })

  it('makes none of a far amount, money in, or a far day', () => {
    expect(matchesOf([row(OTP, '2026-11-04', -40, null), row(OTP, '2026-11-04', 23.49, 'Income/Salary'), row(OTP, '2026-12-01', -23.49, null)])).toEqual({ kind: 'none' })
  })

  it('never offers a transfer, in any of the ways a row can be one', () => {
    const leg = row(OTP, '2026-11-04', -23.49, 'Between my accounts')
    const paired = row(OTP, '2026-11-04', -23.49, null, { pair: row(REVOLUT_EUR, '2026-11-04', 23.49, null).id })
    const exchange = row(OTP, '2026-11-04', -23.49, null, { movedAt: '2026-11-04 09:30:00' })
    const toOwnIban = row(OTP, '2026-11-04', -23.49, null, { counterpartyIban: REVOLUT_EUR.iban })

    expect(matchesOf([leg, paired, exchange, toOwnIban])).toEqual({ kind: 'none' })
  })

  it('never offers a row with a receipt', () => {
    const card = row(OTP, '2026-11-04', -23.49, null)
    const receipt: Receipt = {
      id: recordIdOf(RECEIPT_RECORDS, '5e000000-0000-4000-8000-000000006001'),
      transaction: card.id,
      account: null,
      merchant: '',
      merchantOib: '',
      buyerOib: '',
      issuedOn: ISSUED,
      issuedTime: '',
      total: euros(23.49),
      jir: '',
      zki: '',
      readBy: '',
      photo: '',
      latitude: '',
      longitude: '',
    }

    expect(matchesOf([card], '', 23.49, [receipt])).toEqual({ kind: 'none' })
  })

  it('never offers a row on an account in another currency, since a fiscal total is in euros', () => {
    expect(matchesOf([row(REVOLUT_USD, '2026-11-04', -23.49, null)])).toEqual({ kind: 'none' })
  })

  it('offers a typed cash row', () => {
    expect(matchesOf([row(CASH, '2026-11-03', -23.49, 'Food/Coffee')]).kind).toBe('ready')
  })

  it('never lets a company form or a piece of a word win the match', () => {
    const konzum = row(OTP, '2026-11-04', -23.49, null, { payee: 'KONZUM DOO' })
    const bakery = row(OTP, '2026-11-04', -23.49, null, { payee: 'PEK 12' })

    expect(matchesOf([konzum, bakery], 'Pekara Dora DOO').kind).toBe('pick')
    expect(matchesOf([row(OTP, '2026-11-04', -23.49, null, { payee: 'SUPERKONZUMA' }), bakery], 'Konzum').kind).toBe('pick')
  })

  it('asks about a lone payment when a known merchant is not in its text', () => {
    const parking = row(OTP, '2026-11-09', -23.49, 'Transport/Parking and tolls', { payee: 'PARKING ZAGREB' })

    expect(matchesOf([parking], 'Pekara').kind).toBe('pick')
    expect(matchesOf([parking], 'Parking Zagreb').kind).toBe('ready')
    expect(matchesOf([parking]).kind).toBe('ready')
  })
})

describe('the rows that can take a receipt', () => {
  it('are payments out, never money in', () => {
    const spend = row(OTP, '2026-11-04', -23.49, null)
    const salary = row(OTP, '2026-11-04', 1200, 'Income/Salary')

    expect(splittableRows({ accounts: ACCOUNTS, categories: CATEGORIES, transactions: [spend, salary], receipts: [], items: wholeItems([spend, salary]) })).toEqual([spend])
  })

  it('leave out a payment To review asks about as maybe a transfer, until that is answered', () => {
    const topUp = row(OTP, '2026-11-04', -60, null, { source: 'statement', payee: 'Card top-up' })
    const toppedUp = row(REVOLUT_EUR, '2026-11-04', 60, null, { source: 'statement', payee: 'Top-up by card' })
    const spend = row(OTP, '2026-11-04', -23.49, null, { source: 'statement', payee: 'Corner market' })
    const book = (transactions: readonly Transaction[]): SpendingBook => ({
      accounts: ACCOUNTS,
      categories: CATEGORIES,
      transactions,
      budgets: [],
      rules: [],
      receipts: [],
      items: wholeItems(transactions),
      stored: storedBeforeItems(transactions),
      held: [],
      settings: spendingSettingsOf([]),
      readings: {} as SpendingBook['readings'],
      problems: [],
    })

    expect([...rowsTakingReceipt(book([topUp, toppedUp, spend]), ISSUED)]).toEqual([spend.id])
    expect([...rowsTakingReceipt(book([topUp, spend]), ISSUED)]).toEqual([topUp.id, spend.id])
  })
})

describe('where a receipt goes', () => {
  const first = row(OTP, '2026-11-04', -23.49, null)
  const second = row(REVOLUT_EUR, '2026-11-04', -23.49, null)
  const asked = matchesOf([first, second])
  const ready = matchesOf([first])

  it('takes the ready one, waits for a pick, and makes a new entry when nothing matches', () => {
    expect([placeOf(ready, null), placeOf(asked, null), placeOf({ kind: 'none' }, null), placeOf(null, null)]).toEqual([first.id, '', NEW_ENTRY, ''])
  })

  it('keeps your pick when the matching runs again, whatever it now calls ready', () => {
    const named = { ...second, payee: 'Konzum' }
    const after = matchesOf([first, named], 'Konzum')

    expect(after.kind).toBe('ready')
    expect(placeOf(after, first.id)).toBe(first.id)
    expect(placeOf(ready, NEW_ENTRY)).toBe(NEW_ENTRY)
  })

  it('drops a pick that is no longer on offer', () => {
    expect(placeOf(ready, second.id)).toBe(first.id)
    expect(placeOf(asked, 'gone')).toBe('')
  })
})

describe('the accounts a receipt can go on', () => {
  it('are the open euro ones', () => {
    expect(receiptAccounts([...ACCOUNTS, { ...OTP, closed: true, id: REVOLUT_USD.id }]).map((account) => account.name)).toEqual(['OTP current', 'Revolut EUR', 'Cash'])
  })
})

describe('a fiscal receipt already on the file', () => {
  const receipt = (jir: string, zki: string): Receipt => ({
    id: recordIdOf(RECEIPT_RECORDS, '5e000000-0000-4000-8000-000000006002'),
    transaction: row(OTP, '2026-11-04', -1, null).id,
    account: null,
    merchant: '',
    merchantOib: '',
    buyerOib: '',
    issuedOn: ISSUED,
    issuedTime: '',
    total: euros(1),
    jir,
    zki,
    readBy: '',
    photo: '',
    latitude: '',
    longitude: '',
  })

  it('is found by its JIR or its ZKI', () => {
    expect(heldReceiptOf({ jir: 'J', zki: '' }, [receipt('J', '')])).not.toBeNull()
    expect(heldReceiptOf({ jir: '', zki: 'Z' }, [receipt('', 'Z')])).not.toBeNull()
  })

  it('is not found by a blank code', () => {
    expect(heldReceiptOf({ jir: '', zki: '' }, [receipt('', '')])).toBeNull()
    expect(heldReceiptOf({ jir: 'J', zki: '' }, [receipt('K', '')])).toBeNull()
  })
})
