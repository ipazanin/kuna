import { describe, expect, it } from 'vitest'

import type { BankTransaction } from '../src/apps/spending/bankSync/domain/bankAnswer'
import { bankSyncRows } from '../src/apps/spending/bankSync/domain/bankSyncRows'
import { fakeBankTransactions } from '../src/apps/spending/bankSync/infrastructure/fake/fakeBankSync'
import type { StatementRows } from '../src/apps/spending/statements/domain/statementRows'
import type { Account } from '../src/apps/spending/workbook/domain/account'
import { OTP, REVOLUT_EUR, REVOLUT_USD } from './fixtures/spending'
import { civil, euros } from './fixtures/ledger'

const DAY = civil('2026-10-30')

const TRANSACTION: BankTransaction = {
  reference: 'ref-1',
  amount: '12.30',
  currency: 'EUR',
  direction: 'DBIT',
  status: 'BOOK',
  bookedOn: '2026-10-29',
  valueOn: '2026-10-29',
  madeOn: '2026-10-28',
  creditorName: 'Corner market',
  creditorIban: 'hr11 0000 0000 0000 0000 9',
  debtorName: 'Made-up Owner',
  debtorIban: null,
  remittance: ['Card', 'payment'],
}

const statementOf = (answer: readonly BankTransaction[], account: Account = OTP): StatementRows => bankSyncRows(answer, account)

describe('bankSyncRows', () => {
  it('leaves out a row with no direction with the note for rows it cannot read, since it might be money in or out', () => {
    const { rows, notes } = statementOf([{ ...TRANSACTION, direction: '' }])
    expect(rows).toEqual([])
    expect(notes).toEqual(['1 row of OTP current left out, since its day or amount cannot be read.'])
  })

  it('turns a debit into money out, dated on the day of the transaction and keyed by the bank reference', () => {
    const [only] = statementOf([TRANSACTION]).rows
    expect(only?.importKey).toMatch(/^bank-[0-9a-f]{16}-1$/)
    expect(statementOf([TRANSACTION]).rows).toEqual([
      {
        account: OTP.id,
        date: civil('2026-10-28'),
        amount: euros(-12.3),
        payee: 'Corner market',
        category: null,
        description: 'Card payment',
        counterpartyIban: 'HR1100000000000000009',
        movedAt: '',
        pocket: false,
        importKey: only?.importKey,
      },
    ])
  })

  it('turns a credit into money in, from the debtor', () => {
    const [row] = statementOf([{ ...TRANSACTION, direction: 'CRDT', creditorName: 'Made-up Owner', creditorIban: null, debtorName: 'Example Studio d.o.o.', debtorIban: 'HR2200000000000000001' }]).rows
    expect(row).toMatchObject({ amount: euros(12.3), payee: 'Example Studio d.o.o.', counterpartyIban: 'HR2200000000000000001' })
  })

  it('falls back to the booking day and then the value day', () => {
    expect(statementOf([{ ...TRANSACTION, madeOn: null }]).rows[0]?.date).toBe(civil('2026-10-29'))
    expect(statementOf([{ ...TRANSACTION, madeOn: null, bookedOn: null, valueOn: '2026-10-27' }]).rows[0]?.date).toBe(civil('2026-10-27'))
  })

  it('leaves a pending row out with a note', () => {
    const { rows, notes } = statementOf([TRANSACTION, { ...TRANSACTION, reference: null, status: 'PDNG' }])
    expect(rows).toHaveLength(1)
    expect(notes).toEqual([`1 pending row of ${OTP.name} left out. It comes once it is booked.`])
  })

  it('leaves a row of no amount out, since an entry is never zero', () => {
    const { rows, notes } = statementOf([{ ...TRANSACTION, amount: '0.00' }])
    expect(rows).toEqual([])
    expect(notes).toEqual([`1 row of ${OTP.name} without an amount left out.`])
  })

  it('takes only the rows in the currency of the account', () => {
    const answer = fakeBankTransactions('fake-revolut-account', DAY)
    expect(statementOf(answer, REVOLUT_EUR).rows.map((row) => row.payee)).toEqual(['Café on the square', 'Corner market'])
    expect(statementOf(answer, REVOLUT_USD).rows.map((row) => row.payee)).toEqual(['Diner in Boston'])
  })

  it('gives a reference a bank repeats on other money a key of its own, the same whichever of them a fetch sees', () => {
    const first = { ...TRANSACTION, reference: 'R', madeOn: '2026-10-01', amount: '10.00' }
    const second = { ...TRANSACTION, reference: 'R', madeOn: '2026-10-02', amount: '20.00' }
    const later = { ...TRANSACTION, reference: 'R', madeOn: '2026-10-25', amount: '33.00' }
    const [firstKey, secondKey] = statementOf([first, second]).rows.map((row) => row.importKey)
    const [laterKey] = statementOf([later]).rows.map((row) => row.importKey)
    expect(new Set([firstKey, secondKey, laterKey]).size).toBe(3)
    expect(statementOf([second, later]).rows.map((row) => row.importKey)).toEqual([secondKey, laterKey])
  })

  it('keeps two rows equal in reference, day and amount two, numbered', () => {
    const keys = statementOf([TRANSACTION, TRANSACTION]).rows.map((row) => row.importKey)
    expect(keys[0]).toMatch(/-1$/)
    expect(keys[1]).toBe(keys[0]!.replace(/-1$/, '-2'))
  })

  it('reads a blank reference as none, so rows of different days do not share a key', () => {
    const blank = (madeOn: string) => ({ ...TRANSACTION, reference: '  ', madeOn })
    const none = (madeOn: string) => ({ ...TRANSACTION, reference: null, madeOn })
    const keys = statementOf([blank('2026-10-25'), blank('2026-10-26')]).rows.map((row) => row.importKey)
    expect(new Set(keys).size).toBe(2)
    expect(keys).toEqual(statementOf([none('2026-10-25'), none('2026-10-26')]).rows.map((row) => row.importKey))
  })

  it('keys a row with no reference by its facts, the same on a later fetch, with two equal rows kept two', () => {
    const bare = { ...TRANSACTION, reference: null }
    const keys = statementOf([bare, bare, TRANSACTION]).rows.map((row) => row.importKey)
    expect(keys[0]).toMatch(/^bank-[0-9a-f]{16}-1$/)
    expect(keys[1]).toMatch(/^bank-[0-9a-f]{16}-2$/)
    expect(new Set(keys).size).toBe(3)
    expect(statementOf([bare, bare, TRANSACTION]).rows.map((row) => row.importKey)).toEqual(keys)
  })

  it('leaves out a row whose day or amount it cannot read, with a note, and keeps the rest', () => {
    const { rows, notes } = statementOf([TRANSACTION, { ...TRANSACTION, madeOn: 'soon' }, { ...TRANSACTION, amount: 'a lot' }])
    expect(rows).toHaveLength(1)
    expect(notes).toEqual([`2 rows of ${OTP.name} left out, since their day or amount cannot be read.`])
  })
})
