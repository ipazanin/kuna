import { describe, expect, it } from 'vitest'

import { receiptMatches } from '../src/apps/spending/receipts/domain/receiptMatch'
import { RECEIPT_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { Receipt } from '../src/apps/spending/workbook/domain/receipt'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { ACCOUNTS, CASH, CATEGORIES, OTP, REVOLUT_EUR, REVOLUT_USD, row } from './fixtures/spending'

const ISSUED = civil('2026-11-03')

function matchesOf(rows: readonly Transaction[], merchant = '', total = 23.49, receipts: readonly Receipt[] = []) {
  return receiptMatches({ merchant, issuedOn: ISSUED, total: euros(total) }, { accounts: ACCOUNTS, categories: CATEGORIES, transactions: rows, receipts })
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
    }

    expect(matchesOf([card], '', 23.49, [receipt])).toEqual({ kind: 'none' })
  })

  it('never offers a row on an account in another currency, since a fiscal total is in euros', () => {
    expect(matchesOf([row(REVOLUT_USD, '2026-11-04', -23.49, null)])).toEqual({ kind: 'none' })
  })

  it('offers a typed cash row', () => {
    expect(matchesOf([row(CASH, '2026-11-03', -23.49, 'Food/Coffee')]).kind).toBe('ready')
  })
})
