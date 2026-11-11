import { describe, expect, it } from 'vitest'

import { addRevolutAccounts, revolutStatement } from '../src/apps/spending/statements/domain/revolutStatement'
import type { StatementRows } from '../src/apps/spending/statements/domain/statementRows'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { account, ACCOUNTS, CATEGORIES, category, REVOLUT_EUR, REVOLUT_USD } from './fixtures/spending'
import { civil } from './fixtures/ledger'

const HEADER = ['Type', 'Product', 'Started Date', 'Completed Date', 'Description', 'Amount', 'Fee', 'Currency', 'State', 'Balance']

function line(
  type: string,
  started: string | number,
  description: string,
  amount: string | number,
  fee: string | number = '0.00',
  currency = 'EUR',
  state = 'COMPLETED',
  product = 'Current',
): (string | number)[] {
  return [type, product, started, started, description, amount, fee, currency, state, '']
}

const BOOK = { accounts: ACCOUNTS, categories: CATEGORIES }

function read(rows: readonly (readonly (string | number)[])[], book = BOOK): StatementRows {
  const reading = revolutStatement([HEADER, ...rows], 'export.csv', book)
  if (!('statement' in reading)) throw new Error(reading.refusal)
  return reading.statement
}

describe("Revolut's export", () => {
  it.each(HEADER)('refuses a file with no %s column, naming it', (column) => {
    const place = HEADER.indexOf(column)
    const without = [HEADER, line('CARD_PAYMENT', '2026-10-01 10:00:00', 'Corner market', '-5.00')].map((row) => row.filter((_cell, index) => index !== place))

    expect(revolutStatement(without, 'export.csv', BOOK)).toEqual({ refusal: `The file has no ${column} column`, missing: [] })
  })

  it('finds the columns by their names, in any order', () => {
    const shuffled = [
      ['State', 'Amount', 'Currency', 'Started Date', 'Description', 'Fee', 'Type', 'Product', 'Completed Date', 'Balance'],
      ['COMPLETED', '-5.00', 'EUR', '2026-10-01 10:00:00', 'Corner market', '0.00', 'CARD_PAYMENT', 'Current', '', ''],
    ]
    const reading = revolutStatement(shuffled, 'export.csv', BOOK)

    expect('statement' in reading && reading.statement.rows).toMatchObject([{ payee: 'Corner market', amount: accountMoneyFromAmount(-5), date: civil('2026-10-01'), account: REVOLUT_EUR.id }])
  })

  it('takes a date by the started day, not the completed one', () => {
    const row = line('CARD_PAYMENT', '2026-10-01 23:50:00', 'Corner market', '-5.00')
    row[3] = '2026-10-03 08:00:00'

    expect(read([row]).rows[0]?.date).toBe('2026-10-01')
  })

  it('reads a date and an amount from an xlsx file, as a serial number and numbers', () => {
    const { rows } = read([line('CARD_PAYMENT', 46296.5, 'Corner market', -5.5, 0.25)])

    expect(rows.map((row) => [row.date, row.amount])).toEqual([
      [civil('2026-10-01'), accountMoneyFromAmount(-5.5)],
      [civil('2026-10-01'), accountMoneyFromAmount(-0.25)],
    ])
  })

  it('gives one row one key and one started time, from a csv with text or an xlsx with a date cell', () => {
    // 46315 is 20 Oct 2026, and 0.4166… of a day is 10:00:00.
    const asText = read([line('EXCHANGE', '2026-10-20 10:00:00', 'Exchanged to USD', '-54.00')]).rows[0]!
    for (const started of [46315.416666666664, 46315.41666666668, '2026-10-20T10:00', '2026-10-20 10:00:00']) {
      const other = read([line('EXCHANGE', started, 'Exchanged to USD', -54)]).rows[0]!

      expect([other.importKey, other.movedAt, other.date]).toEqual([asText.importKey, '2026-10-20 10:00:00', civil('2026-10-20')])
    }
  })

  it('leaves out pending, reverted and declined rows and counts them in a note', () => {
    const { rows, notes } = read([
      line('CARD_PAYMENT', '2026-10-01 10:00:00', 'Kept', '-1.00'),
      line('CARD_PAYMENT', '2026-10-01 10:01:00', 'Pending', '-2.00', '0.00', 'EUR', 'PENDING'),
      line('CARD_PAYMENT', '2026-10-01 10:02:00', 'Reverted', '-3.00', '0.00', 'EUR', 'REVERTED'),
      line('CARD_PAYMENT', '2026-10-01 10:03:00', 'Declined', '-4.00', '0.00', 'EUR', 'DECLINED'),
    ])

    expect(rows.map((row) => row.payee)).toEqual(['Kept'])
    expect(notes).toEqual(['1 pending row left out. It comes with the next export.', '2 reverted or declined rows left out.'])
  })

  it('makes a fee a row of its own in Bank fees, with a key of its own', () => {
    const { rows } = read([line('CARD_PAYMENT', '2026-10-01 10:00:00', 'Fuel station', '-40.00', '1.50')])

    expect(rows.map((row) => [row.payee, row.amount, row.category])).toEqual([
      ['Fuel station', accountMoneyFromAmount(-40), null],
      ['Revolut', accountMoneyFromAmount(-1.5), category('Money and fees/Bank fees').id],
    ])
    expect(rows[1]?.importKey).toBe(`${rows[0]?.importKey}-fee`)
  })

  it('marks a current row of type ATM as cash taken out, and neither its fee nor any other row', () => {
    const { rows } = read([
      line('ATM', '2026-10-01 10:00:00', 'Cash at Ilica ATM', '-50.00', '1.00'),
      line('CARD_PAYMENT', '2026-10-01 11:00:00', 'Cash and carry', '-20.00'),
      line('atm', '2026-10-02 10:00:00', 'Cash at Trg ATM', '-30.00'),
    ])

    expect(rows.map((row) => [row.payee, row.cashWithdrawal])).toEqual([
      ['Cash at Ilica ATM', true],
      ['Revolut', false],
      ['Cash and carry', false],
      ['Cash at Trg ATM', true],
    ])
  })

  it('leaves the fee waiting on review once Bank fees was renamed', () => {
    const renamed = CATEGORIES.map((other) => (other.id === category('Money and fees/Bank fees').id ? { ...other, name: 'Charges' } : other))

    expect(read([line('CARD_PAYMENT', '2026-10-01 10:00:00', 'Fuel station', '-40.00', '1.50')], { accounts: ACCOUNTS, categories: renamed }).rows[1]?.category).toBeNull()
  })

  it("sends each row to the Revolut account of its currency, and marks an exchange's two legs with their started time", () => {
    const { rows } = read([line('EXCHANGE', '2026-10-01 10:00:00', 'Exchanged to USD', '-54.00'), line('EXCHANGE', '2026-10-01 10:00:00', 'Exchanged from EUR', '58.00', '0.00', 'USD')])

    expect(rows.map((row) => [row.account, row.amount, row.movedAt])).toEqual([
      [REVOLUT_EUR.id, accountMoneyFromAmount(-54), '2026-10-01 10:00:00'],
      [REVOLUT_USD.id, accountMoneyFromAmount(58), '2026-10-01 10:00:00'],
    ])
  })

  it('takes the open Revolut account of a currency ahead of a closed one listed first, and a closed one when none is open', () => {
    const closed = account(8, { ...REVOLUT_EUR, name: 'Old Revolut', closed: true })
    const row = line('CARD_PAYMENT', '2026-10-01 10:00:00', 'Pub', '-5.00')

    expect(read([row], { accounts: [closed, REVOLUT_EUR], categories: CATEGORIES }).rows[0]?.account).toBe(REVOLUT_EUR.id)
    expect(read([row], { accounts: [closed], categories: CATEGORIES }).rows[0]?.account).toBe(closed.id)
  })

  it('refuses a file two open Revolut accounts of its currency could take, naming them', () => {
    const second = account(8, { ...REVOLUT_EUR, name: 'Second Revolut' })
    const reading = revolutStatement([HEADER, line('CARD_PAYMENT', '2026-10-01 10:00:00', 'Pub', '-5.00')], 'export.csv', { accounts: [REVOLUT_EUR, second], categories: CATEGORIES })

    expect(reading).toEqual({ refusal: 'More than one open Revolut account keeps EUR: Revolut EUR, Second Revolut. Close the one the file is not for', missing: [] })
  })

  it('refuses a file in currencies no Revolut account keeps, saying what to add for every currency at once, each drafted from the file under the IBAN the Revolut current account already holds', () => {
    const at = (started: string, amount: string, fee: string, currency: string, balance: string, product = 'Current') => {
      const row = line('CARD_PAYMENT', started, 'Pub', amount, fee, currency, 'COMPLETED', product)
      row[9] = balance
      return row
    }
    const reading = revolutStatement(
      [
        HEADER,
        // GBP opens at 100.00: the last balance 85.00 less the rows, -10.00 and -5.00 with a 0.00 and a 0.00 fee.
        at('2026-10-02 10:00:00', '-10.00', '0.00', 'GBP', '90.00'),
        at('2026-10-04 10:00:00', '-5.00', '0.00', 'GBP', '85.00'),
        // CHF reaches back to an empty account, so it opens at zero the day before its first row.
        at('2026-10-03 10:00:00', '20.00', '0.00', 'CHF', '20.00'),
        at('2026-10-05 10:00:00', '7.00', '0.00', 'GBP', '7.00', 'Savings'),
        line('CARD_PAYMENT', '2026-10-01 10:00:00', 'Kept', '-1.00'),
      ],
      'export.csv',
      BOOK,
    )

    expect({ ...reading, missing: reading.missing.map(({ account }) => account) }).toEqual({
      refusal: 'Add Revolut bank accounts in GBP and CHF and a Revolut savings account in GBP to bring in this file',
      missing: [
        {
          name: 'Revolut GBP',
          kind: 'bank',
          bank: 'revolut',
          currency: 'GBP',
          iban: REVOLUT_EUR.iban,
          opening: accountMoneyFromAmount(100),
          openedOn: civil('2026-10-02'),
          rowsFrom: 'bank-link',
          closed: false,
        },
        {
          name: 'Revolut CHF',
          kind: 'bank',
          bank: 'revolut',
          currency: 'CHF',
          iban: REVOLUT_EUR.iban,
          opening: accountMoneyFromAmount(0),
          openedOn: civil('2026-10-02'),
          rowsFrom: 'bank-link',
          closed: false,
        },
        {
          name: 'Revolut GBP savings',
          kind: 'savings',
          bank: 'revolut',
          currency: 'GBP',
          iban: '',
          opening: accountMoneyFromAmount(0),
          openedOn: civil('2026-10-04'),
          rowsFrom: 'by-hand',
          closed: false,
        },
      ],
    })
  })

  it('drafts a missing account at zero on its first day when the file prints no balance', () => {
    const reading = revolutStatement([HEADER, line('CARD_PAYMENT', '2026-10-01 10:00:00', 'Pub', '-5.00', '0.00', 'GBP')], 'export.csv', BOOK)

    expect({ ...reading, missing: reading.missing.map(({ account }) => account) }).toEqual({
      refusal: 'Add a Revolut bank account in GBP to bring in this file',
      missing: [
        {
          name: 'Revolut GBP',
          kind: 'bank',
          bank: 'revolut',
          currency: 'GBP',
          iban: REVOLUT_EUR.iban,
          opening: accountMoneyFromAmount(0),
          openedOn: civil('2026-10-01'),
          rowsFrom: 'bank-link',
          closed: false,
        },
      ],
    })
  })

  it('refuses a currency Kuna does not know, naming it', () => {
    expect(revolutStatement([HEADER, line('CARD_PAYMENT', '2026-10-01 10:00:00', 'Pub', '-5.00', '0.00', 'XYZ')], 'export.csv', BOOK)).toEqual({
      refusal: 'The file has rows in "XYZ", which is not a currency code such as EUR or USD',
      missing: [],
    })
  })

  it('keeps the savings note for a currency Kuna cannot draft an account for', () => {
    const row = line('TRANSFER', '2026-10-01 10:00:00', 'To pocket', '-5.00', '0.00', 'XYZ', 'COMPLETED', 'Savings')

    expect(read([row]).notes).toEqual(['1 savings row left out, since no Revolut savings account keeps XYZ.'])
  })

  it('leaves a Savings row out without a note when it drafts the savings account, and sends it to one when there is', () => {
    const row = line('TRANSFER', '2026-10-01 10:00:00', 'To pocket', '-5.00', '0.00', 'EUR', 'COMPLETED', 'Savings')
    const left = read([row])
    const savings = account(9, {
      name: 'Revolut pocket',
      kind: 'savings',
      bank: 'revolut',
      currency: REVOLUT_EUR.currency,
      opening: accountMoneyFromAmount(0),
      openedOn: civil('2026-09-01'),
      rowsFrom: 'by-hand',
      iban: '',
      closed: false,
    })

    expect(left.rows).toEqual([])
    expect(left.notes).toEqual([])
    expect(revolutStatement([HEADER, row], 'export.csv', BOOK).missing.map(({ account }) => account)).toEqual([
      {
        name: 'Revolut EUR savings',
        kind: 'savings',
        bank: 'revolut',
        currency: 'EUR',
        iban: '',
        opening: accountMoneyFromAmount(0),
        openedOn: civil('2026-10-01'),
        rowsFrom: 'by-hand',
        closed: false,
      },
    ])
    expect(addRevolutAccounts(revolutStatement([HEADER, row], 'export.csv', BOOK).missing, 'savings')).toBe('Add a Revolut savings account in EUR to bring in the savings rows left out')
    expect(read([row], { accounts: [...ACCOUNTS, savings], categories: CATEGORIES }).rows[0]?.account).toBe(savings.id)
  })

  it('leaves a row of any other product out, with a note naming it, and keeps a current row whatever its case', () => {
    const row = (product: string) => line('TRANSFER', '2026-10-01 10:00:00', `On ${product}`, '-5.00', '0.00', 'EUR', 'COMPLETED', product)
    const { rows, notes } = read([row('Deposit'), row('Deposit'), row('Vault'), row('CURRENT')])

    expect(rows.map((kept) => kept.payee)).toEqual(['On CURRENT'])
    expect(notes).toEqual(['2 rows of the product "Deposit" left out.', '1 row of the product "Vault" left out.'])
  })

  describe('a pocket move', () => {
    const POCKET_AT = '2026-10-01 10:00:00'
    const current = (amount: string, started: string | number = POCKET_AT) => line('TRANSFER', started, 'Pocket Summer trip', amount)
    const savingsRow = (amount: string, started: string | number = POCKET_AT) => line('TRANSFER', started, 'From current', amount, '0.00', 'EUR', 'COMPLETED', 'Savings')
    const pocket = account(9, {
      name: 'Revolut pocket',
      kind: 'savings',
      bank: 'revolut',
      currency: REVOLUT_EUR.currency,
      opening: accountMoneyFromAmount(0),
      openedOn: civil('2026-09-01'),
      rowsFrom: 'by-hand',
      iban: '',
      closed: false,
    })
    const withPocket = { accounts: [...ACCOUNTS, pocket], categories: CATEGORIES }

    it('gives both legs one time and sends them to their accounts, with a savings account', () => {
      const { rows, notes } = read([current('-20.00'), savingsRow('20.00')], withPocket)

      expect(rows.map((row) => [row.account, row.amount, row.movedAt, row.pocket])).toEqual([
        [REVOLUT_EUR.id, accountMoneyFromAmount(-20), POCKET_AT, true],
        [pocket.id, accountMoneyFromAmount(20), POCKET_AT, true],
      ])
      expect(notes).toEqual([])
    })

    it('keeps the current leg as a pocket move, and leaves the savings leg out with a note, with no savings account', () => {
      const { rows, notes } = read([current('-20.00'), savingsRow('20.00')])

      expect(rows).toMatchObject([{ account: REVOLUT_EUR.id, movedAt: POCKET_AT, pocket: true }])
      expect(notes).toEqual([])
    })

    it('finds the legs across a serial and a text', () => {
      expect(read([current('-20.00', 46296 + 10 / 24), savingsRow('20.00')], withPocket).rows.map((row) => row.pocket)).toEqual([true, true])
    })

    it('leaves legs a second apart, of another amount or of the same sign as ordinary rows', () => {
      for (const rows of [
        [current('-20.00'), savingsRow('20.00', '2026-10-01 10:00:01')],
        [current('-20.00'), savingsRow('21.00')],
        [current('-20.00'), savingsRow('-20.00')],
      ]) {
        expect(read(rows, withPocket).rows.map((row) => [row.movedAt, row.pocket])).toEqual([
          ['', false],
          ['', false],
        ])
      }
    })

    it('matches one to one, so two moves in one second stay two, and a third row stays ordinary', () => {
      expect(read([current('-20.00'), savingsRow('20.00'), savingsRow('20.00'), current('-20.00')], withPocket).rows.map((row) => row.pocket)).toEqual([true, true, true, true])
      expect(read([current('-20.00'), savingsRow('20.00'), savingsRow('20.00')], withPocket).rows.map((row) => row.pocket)).toEqual([true, true, false])
    })

    it('sends a savings row with no mirror, such as interest, to the savings account as ordinary money in', () => {
      const { rows } = read([line('INTEREST', POCKET_AT, 'Example Bank UAB', '0.12', '0.00', 'EUR', 'COMPLETED', 'Savings')], withPocket)

      expect(rows).toMatchObject([{ account: pocket.id, amount: accountMoneyFromAmount(0.12), movedAt: '', pocket: false, category: null }])
    })

    it('keeps the key of each leg whether it paired or not, so adding a savings account later leaves the current leg already in', () => {
      const rows = [current('-20.00'), savingsRow('20.00')]

      expect(read(rows).rows[0]?.importKey).toBe(read(rows, withPocket).rows[0]?.importKey)
    })
  })

  describe('the closing balance note', () => {
    const on = (started: string, amount: string, fee: string, balance: string, product = 'Current') => {
      const row = line('CARD_PAYMENT', started, `Row ${started}`, amount, fee, 'EUR', 'COMPLETED', product)
      row[9] = balance
      return row
    }
    const pocket = account(9, {
      name: 'Revolut pocket',
      kind: 'savings',
      bank: 'revolut',
      currency: REVOLUT_EUR.currency,
      opening: accountMoneyFromAmount(0),
      openedOn: civil('2026-09-01'),
      rowsFrom: 'by-hand',
      iban: '',
      closed: false,
    })
    const withPocket = { accounts: [...ACCOUNTS, pocket], categories: CATEGORIES }
    const whole = [on('2026-10-01 10:00:00', '-10.00', '0.00', '90.00'), on('2026-10-02 10:00:00', '-20.00', '1.00', '69.00'), on('2026-10-03 10:00:00', '5.00', '0.00', '74.00')]

    it('says nothing when the rows add up to the last balance, as previous plus amount less fee', () => {
      expect(read(whole).notes).toEqual([])
    })

    it('says so in one line when a row is missing, and still reads the file', () => {
      const { rows, notes } = read([whole[0]!, whole[2]!])

      expect(rows).toHaveLength(2)
      expect(notes).toEqual(["The export's last Current balance is €74.00, but its rows add up to €95.00, so a row may be missing."])
    })

    it('walks them in the order they completed, whatever the file lists first', () => {
      expect(read([...whole].reverse()).notes).toEqual([])
    })

    it('checks each product on its own', () => {
      const savings = [on('2026-10-01 10:00:00', '5.00', '0.00', '5.00', 'Savings'), on('2026-10-02 10:00:00', '5.00', '0.00', '12.00', 'Savings')]

      expect(read([...whole, ...savings], withPocket).notes).toEqual(["The export's last Savings balance is €12.00, but its rows add up to €10.00, so a row may be missing."])
    })

    it('still checks a product with no account to go to', () => {
      const savings = [on('2026-10-01 10:00:00', '5.00', '0.00', '5.00', 'Savings'), on('2026-10-02 10:00:00', '5.00', '0.00', '12.00', 'Savings')]

      expect(read(savings).notes).toContain("The export's last Savings balance is €12.00, but its rows add up to €10.00, so a row may be missing.")
    })

    it('leaves out rows with no balance or that never completed, as a pending one is not in the sum', () => {
      const pending = line('CARD_PAYMENT', '2026-10-02 12:00:00', 'Pending', '-3.00', '0.00', 'EUR', 'PENDING')

      expect(read([...whole, pending, line('CARD_PAYMENT', '2026-10-03 12:00:00', 'No balance', '-7.00')]).notes).toEqual(['1 pending row left out. It comes with the next export.'])
    })
  })

  it('refuses a date or an amount it cannot read, since a row left out would throw the balance', () => {
    expect(revolutStatement([HEADER, line('CARD_PAYMENT', 'soon', 'Pub', '-5.00')], 'export.csv', BOOK)).toEqual({ refusal: 'Row 2 of the file starts on "soon", which is not a date', missing: [] })
    expect(revolutStatement([HEADER, line('CARD_PAYMENT', '2026-10-01 10:00:00', 'Pub', '-5,00')], 'export.csv', BOOK)).toEqual({
      refusal: 'Row 2 of the file holds "-5,00", which is not an amount',
      missing: [],
    })
  })

  it('refuses a blank amount, and reads a blank fee as none', () => {
    expect(revolutStatement([HEADER, line('CARD_PAYMENT', '2026-10-01 10:00:00', 'Pub', '')], 'export.csv', BOOK)).toEqual({
      refusal: 'Row 2 of the file holds "", which is not an amount',
      missing: [],
    })
    expect(read([line('CARD_PAYMENT', '2026-10-01 10:00:00', 'Pub', '-5.00', '')]).rows).toHaveLength(1)
  })

  it('keeps the same key for the same row across two overlapping exports, and two equal coffees stay two', () => {
    const coffee = line('CARD_PAYMENT', '2026-10-01 10:00:00', 'Coffee', '-2.00')
    const first = read([coffee, coffee])
    const later = read([coffee, coffee, line('CARD_PAYMENT', '2026-10-02 10:00:00', 'Pub', '-5.00')])

    expect(new Set(first.rows.map((row) => row.importKey)).size).toBe(2)
    expect(later.rows.slice(0, 2).map((row) => row.importKey)).toEqual(first.rows.map((row) => row.importKey))
  })
})
