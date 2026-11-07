import { describe, expect, it } from 'vitest'

import { BankScriptFailure, readBanks } from '../src/apps/spending/bankSync/application/bankSync'
import type { BankRead, BankSyncPort } from '../src/apps/spending/bankSync/application/bankSync'
import { accountsOfLinked, fetchFrom } from '../src/apps/spending/bankSync/domain/bankLinks'
import { bankSyncRows } from '../src/apps/spending/bankSync/domain/bankSyncRows'
import type { BankSession, BankTransaction } from '../src/apps/spending/bankSync/domain/bankAnswer'
import { fakeBankSync } from '../src/apps/spending/bankSync/infrastructure/fake/fakeBankSync'
import { reviewCount } from '../src/apps/spending/statements/domain/reviewQueue'
import { statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun'
import type { StatementRow, StatementRows } from '../src/apps/spending/statements/domain/statementRows'
import type { Account } from '../src/apps/spending/workbook/domain/account'
import type { SpendingBook } from '../src/apps/spending/workbook/domain/readSpendingBook'
import { spendingSettingsOf } from '../src/apps/spending/workbook/domain/spendingSettings'
import type { SpendingRule } from '../src/apps/spending/workbook/domain/spendingRule'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import { SPENDING_DOCUMENT } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { fakeSpendingDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending'
import { GoogleApiError } from '../src/shared/google/googleApi'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { ACCOUNT_RECORDS, RULE_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { ACCOUNTS, CATEGORIES, category, OTP, REVOLUT_EUR, REVOLUT_USD, row } from './fixtures/spending'
import { civil } from './fixtures/ledger'

const DAY = civil('2026-10-30')

function bookOf(transactions: readonly Transaction[], rules: readonly SpendingRule[] = []): SpendingBook {
  return {
    accounts: ACCOUNTS,
    categories: CATEGORIES,
    transactions,
    budgets: [],
    rules,
    receipts: [],
    lines: [],
    settings: spendingSettingsOf([]),
    readings: {} as SpendingBook['readings'],
    problems: [],
  }
}

const BANK: BankTransaction = {
  reference: 'ref-1',
  amount: '6.50',
  currency: 'EUR',
  direction: 'DBIT',
  status: 'BOOK',
  bookedOn: '2026-10-28',
  valueOn: null,
  madeOn: null,
  creditorName: 'Corner bakery',
  creditorIban: null,
  debtorName: null,
  debtorIban: null,
  remittance: [],
}

const syncOf = (answer: readonly BankTransaction[]): StatementRows => bankSyncRows(answer, OTP)

function fileRow(place: number, date = '2026-10-28', amount = -6.5): Transaction {
  return row(OTP, date, amount, null, { payee: 'Corner bakery', source: 'statement', importKey: `0123456789abcdef-${place}`, statement: 'statement.csv' })
}

function fileStatement(rows: readonly Partial<StatementRow>[]): StatementRows {
  return {
    label: 'statement.csv',
    notes: [],
    rows: rows.map((fields, place) => ({
      account: OTP.id,
      date: civil('2026-10-28'),
      amount: accountMoneyFromAmount(-6.5),
      payee: 'Corner bakery',
      category: null,
      description: '',
      counterpartyIban: '',
      importKey: `0123456789abcdef-${place}`,
      movedAt: '',
      pocket: false,
      ...fields,
    })),
  }
}

describe('a synced row against the file', () => {
  it('leaves out a row on the last day a file covers, adds nothing and says so with the account and the day', () => {
    const run = statementDryRun(bookOf([fileRow(1)]), syncOf([BANK]), DAY, () => '00000000-0000-4000-8000-000000000001')
    expect(run.added).toEqual([])
    expect(run.lines.map((line) => line.outcome)).toEqual(['other-source'])
    expect(run.notes).toEqual(['1 row of OTP current left out, since a file covers the days up to 28 Oct 2026.'])
  })

  it('leaves out a row before that day whatever its amount, since a sync row may hold a fee the file split off', () => {
    const run = statementDryRun(bookOf([fileRow(1)]), syncOf([{ ...BANK, amount: '7.00', bookedOn: '2026-10-20' }]), DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['other-source'])
  })

  it('takes a row the day after, of the same money too', () => {
    const run = statementDryRun(bookOf([fileRow(1, '2026-10-27')]), syncOf([BANK]), DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['new'])
  })

  it('keeps the days apart per account, so a file on one account leaves another whole', () => {
    const elsewhere = row(REVOLUT_EUR, '2026-10-29', -1, null, { source: 'statement', importKey: '0123456789abcdef-9' })
    const run = statementDryRun(bookOf([elsewhere]), syncOf([BANK]), DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['new'])
  })

  it('stays the same on the next sync, however many times the rows are fetched', () => {
    const answer = [BANK, { ...BANK, reference: 'ref-2', bookedOn: '2026-10-29' }]
    const first = statementDryRun(bookOf([fileRow(1)]), syncOf(answer), DAY)
    expect(first.added).toHaveLength(1)
    const again = statementDryRun(bookOf([fileRow(1), ...first.added]), syncOf(answer), DAY)
    expect(again.added).toEqual([])
    expect(again.lines.map((line) => line.outcome).sort()).toEqual(['already-in', 'other-source'])
  })

  it('fills a typed row and keeps its category and note', () => {
    const typed = row(OTP, '2026-10-27', -6.5, 'Food/Coffee', { payee: 'Bakery', note: 'Breakfast' })
    const run = statementDryRun(bookOf([typed]), syncOf([BANK]), DAY)
    expect(run.filled).toBe(1)
    expect(run.changed[0]?.after).toMatchObject({ id: typed.id, category: typed.category, note: 'Breakfast', importKey: syncOf([BANK]).rows[0]?.importKey, statement: 'Enable Banking' })
  })

  it('files a new row by a rule, an income rule among them only for money in', () => {
    const rule: SpendingRule = {
      id: recordIdOf(RULE_RECORDS, 'a0000000-0000-4000-8000-000000000001'),
      order: 1,
      condition: { column: 'counterparty_contains', fragment: 'Corner bakery' },
      category: category('Income').id,
    }
    expect(statementDryRun(bookOf([], [rule]), syncOf([BANK]), DAY).added[0]?.category).toBeNull()
    expect(statementDryRun(bookOf([], [rule]), syncOf([{ ...BANK, direction: 'CRDT', creditorName: null, debtorName: 'Corner bakery' }]), DAY).added[0]?.category).toBe(rule.category)
  })
})

describe('a file against rows a sync brought', () => {
  const synced = (date: string) => row(OTP, date, -6.5, null, { payee: 'Corner bakery', source: 'statement', importKey: 'bank-ref-1', statement: 'Enable Banking' })

  it('leaves out a row from the first day the sync covers, and says so with the account and the day', () => {
    const run = statementDryRun(bookOf([synced('2026-10-28')]), fileStatement([{ date: civil('2026-10-29'), amount: accountMoneyFromAmount(-99) }]), DAY)
    expect(run.added).toEqual([])
    expect(run.lines.map((line) => line.outcome)).toEqual(['other-source'])
    expect(run.notes).toEqual(['1 row of OTP current left out, since the bank sync covers the days from 28 Oct 2026.'])
  })

  it('takes a row from before the sync began, so a file can fill what came earlier', () => {
    const run = statementDryRun(bookOf([synced('2026-10-29')]), fileStatement([{}]), DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['new'])
  })

  it('leaves a second file of the same rows to the rows it brought, by key', () => {
    const run = statementDryRun(bookOf([fileRow(0)]), fileStatement([{ importKey: '0123456789abcdef-0' }, { importKey: '0123456789abcdef-1' }]), DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['already-in', 'new'])
  })

  it("keeps an exchange's legs pairing from a file, whatever the sync brought", () => {
    const usd = fileStatement([{ movedAt: '2026-10-28 09:30:00', amount: accountMoneyFromAmount(-54), importKey: 'leg-1', payee: 'Exchanged to USD' }])
    const run = statementDryRun(
      bookOf([]),
      { ...usd, rows: [...usd.rows, { ...usd.rows[0]!, account: REVOLUT_EUR.id, amount: accountMoneyFromAmount(54), importKey: 'leg-2', payee: 'Exchanged from EUR' }] },
      DAY,
    )
    expect(run.added.every((added) => added.pair !== null)).toBe(true)
  })
})

describe('an exchange or a pocket move from the sync, whose fields are not known yet', () => {
  const leg = (account: Account, direction: string, amount: string, currency: string, payee: string, reference: string): StatementRows =>
    bankSyncRows([{ ...BANK, reference, direction, amount, currency, creditorName: payee, debtorName: payee }], account)

  it('leaves both legs of an exchange on review, unpaired, each moving its own balance once', () => {
    const rows = [...leg(REVOLUT_EUR, 'DBIT', '100.00', 'EUR', 'Exchanged to USD', 'x-1').rows, ...leg(REVOLUT_USD, 'CRDT', '108.00', 'USD', 'Exchanged from EUR', 'x-2').rows]
    const run = statementDryRun(bookOf([]), { label: 'Enable Banking', notes: [], rows }, DAY)
    expect(run.added.map((added) => [added.amount, added.category, added.pair])).toEqual([
      [accountMoneyFromAmount(-100), null, null],
      [accountMoneyFromAmount(108), null, null],
    ])
    expect(reviewCount({ ...bookOf(run.added) })).toBe(2)
  })

  it('leaves a pocket move on one account on review, where the two legs cancel out', () => {
    const rows = [...leg(REVOLUT_EUR, 'DBIT', '15.00', 'EUR', 'To pocket', 'p-1').rows, ...leg(REVOLUT_EUR, 'CRDT', '15.00', 'EUR', 'To pocket', 'p-2').rows]
    const run = statementDryRun(bookOf([]), { label: 'Enable Banking', notes: [], rows }, DAY)
    expect(run.added.map((added) => [added.category, added.pair])).toEqual([
      [null, null],
      [null, null],
    ])
    expect(run.added[0]!.amount + run.added[1]!.amount).toBe(0)
  })
})

describe('readBanks', () => {
  const port = fakeBankSync('linked', DAY)
  const session = (bank: string, status: string, uid: string, iban: string, currency = 'EUR', reason?: string): BankSession => ({
    bank,
    status,
    ...(reason === undefined ? {} : { reason }),
    accounts: status === 'AUTHORIZED' ? [{ uid, iban, currency }] : [],
  })
  const OTP_SESSION = session('OTP banka', 'AUTHORIZED', 'otp', OTP.iban)
  const REVOLUT_SESSION = session('Revolut', 'AUTHORIZED', 'revolut', REVOLUT_EUR.iban)
  const payeesOf = (read: BankRead): readonly string[] => read.statement.rows.map((statementRow) => statementRow.payee)

  it('reads each live session onto the account with its IBAN and currency, Revolut split by currency', async () => {
    const { statement, unknown, problems } = await readBanks(port, bookOf([]), DAY)
    expect(unknown).toEqual([])
    expect(problems).toEqual([])
    expect(new Set(statement.rows.map((statementRow) => statementRow.account))).toEqual(
      new Set(ACCOUNTS.filter((account) => account.bank !== null && account.kind === 'bank').map((account) => account.id)),
    )
  })

  it('lists a linked account Kuna does not keep, and reads the rest', async () => {
    const { unknown } = await readBanks(fakeBankSync('unknown-account', DAY), bookOf([]), DAY)
    expect(unknown.map(({ bank, account }) => [bank, account.iban])).toEqual([['otp', 'HR0000000000000000077']])
  })

  it('keeps the other bank when the script could not ask one, and says why', async () => {
    const failing: BankSyncPort = {
      ...port,
      sessions: async () => [session('OTP banka', 'FAILED', '', '', 'EUR', 'Enable Banking answered 429: ASPSP_RATE_LIMIT_EXCEEDED'), REVOLUT_SESSION],
      transactions: async () => [BANK],
    }
    const read = await readBanks(failing, bookOf([]), DAY)
    expect(payeesOf(read)).toEqual(['Corner bakery'])
    expect(read.problems).toEqual(['OTP banka did not answer, so its rows wait for a later sync: Enable Banking answered 429: ASPSP_RATE_LIMIT_EXCEEDED'])
    expect(read.ended).toEqual([])
  })

  it("keeps the other bank when one account's transactions fail", async () => {
    const failing: BankSyncPort = {
      ...port,
      sessions: async () => [OTP_SESSION, REVOLUT_SESSION],
      transactions: async (uid) => {
        if (uid === 'otp') throw new BankScriptFailure('The bank sync script did not answer: ASPSP_ERROR')
        return [BANK]
      },
    }
    const read = await readBanks(failing, bookOf([]), DAY)
    expect(payeesOf(read)).toEqual(['Corner bakery'])
    expect(read.problems).toEqual(['OTP banka did not answer, so its rows wait for a later sync: The bank sync script did not answer: ASPSP_ERROR'])
  })

  it("lets Google's 401 through, which the page's sync turns into asking for access", async () => {
    const refused = new GoogleApiError('https://script.googleapis.com/v1/scripts/x:run', 401, 'expired')
    const failing: BankSyncPort = {
      ...port,
      sessions: async () => [OTP_SESSION],
      transactions: async () => {
        throw refused
      },
    }
    await expect(readBanks(failing, bookOf([]), DAY)).rejects.toBe(refused)
  })

  it.each(['EXPIRED', 'REVOKED', 'CLOSED', 'CANCELLED', 'INVALID'])('says a %s session ended, and reads no rows of it', async (status) => {
    const ended: BankSyncPort = { ...port, sessions: async () => [session('OTP banka', status, '', '')] }
    const read = await readBanks(ended, bookOf([]), DAY)
    expect(read.statement.rows).toEqual([])
    expect(read.ended).toEqual(['otp'])
    expect(read.problems).toEqual(['The link to OTP banka ended early. Link it again.'])
  })

  it('takes EXPIRED_SESSION from either call as a session that ended', async () => {
    const onSession: BankSyncPort = { ...port, sessions: async () => [session('OTP banka', 'FAILED', '', '', 'EUR', 'Enable Banking answered 401: EXPIRED_SESSION Session is expired')] }
    expect((await readBanks(onSession, bookOf([]), DAY)).ended).toEqual(['otp'])
    const onRows: BankSyncPort = {
      ...port,
      sessions: async () => [OTP_SESSION],
      transactions: async () => {
        throw new BankScriptFailure('Enable Banking answered 401: EXPIRED_SESSION Session is expired')
      },
    }
    expect((await readBanks(onRows, bookOf([]), DAY)).ended).toEqual(['otp'])
  })

  it('reads neither of two linked accounts that fit one Spending account, says so, and reads the rest', async () => {
    const twice: BankSyncPort = {
      ...port,
      sessions: async () => [
        {
          bank: 'Revolut',
          status: 'AUTHORIZED',
          accounts: [
            { uid: 'current', iban: REVOLUT_EUR.iban, currency: 'EUR' },
            { uid: 'pocket', iban: REVOLUT_EUR.iban, currency: 'EUR' },
          ],
        },
        OTP_SESSION,
      ],
      transactions: async () => [BANK],
    }
    const read = await readBanks(twice, bookOf([]), DAY)
    expect(read.problems).toEqual(['Revolut has more than one account that fits Revolut EUR, so none of them was read.'])
    expect(new Set(read.statement.rows.map((statementRow) => statementRow.account))).toEqual(new Set([OTP.id]))
  })

  it('sends a linked account to the current account when a savings account keeps the same IBAN', async () => {
    const savings = { ...REVOLUT_EUR, id: recordIdOf(ACCOUNT_RECORDS, 'a0000000-0000-4000-8000-000000000009'), name: 'Pocket', kind: 'savings' as const }
    expect(accountsOfLinked({ uid: 'u', iban: REVOLUT_EUR.iban, currency: 'EUR' }, 'revolut', [savings, REVOLUT_EUR])).toEqual([REVOLUT_EUR])
  })

  it('asks plainly for recent rows, two weeks back of the newest row, and for all it can have the first time', async () => {
    const asked: [string, string, boolean][] = []
    const counting: BankSyncPort = {
      ...port,
      transactions: async (uid, from, longest) => {
        asked.push([uid, from, longest])
        return []
      },
    }
    const synced = row(OTP, '2026-10-20', -6.5, null, { payee: 'Corner bakery', source: 'statement', importKey: 'bank-ref-1' })
    await readBanks(counting, bookOf([synced]), DAY)
    expect(asked[0]).toEqual(['fake-otp-account', '2026-10-06', false])
    expect(asked[1]?.[2]).toBe(true)
  })
})

describe('fetchFrom', () => {
  const synced = (date: string) => [{ account: OTP.id, date: civil(date), importKey: 'bank-x-1' }]

  it('asks for what the bank has once the newest row is past a period a bank may refuse', () => {
    expect(fetchFrom(OTP, synced('2026-03-01'), DAY)).toEqual({ from: civil('2026-02-15'), longest: true })
  })

  it('starts a little back of the last day a file covers and asks plainly, so a file holding every row never repeats the longest fetch', () => {
    const fromFile = [{ account: OTP.id, date: civil('2026-10-20'), importKey: '0123456789abcdef-1' }]
    expect(fetchFrom(OTP, fromFile, DAY)).toEqual({ from: civil('2026-10-06'), longest: false })
  })

  it('asks for what the bank has when a file ended longer ago than a bank may allow', () => {
    const fromFile = [{ account: OTP.id, date: civil('2026-05-01'), importKey: '0123456789abcdef-1' }]
    expect(fetchFrom(OTP, fromFile, DAY)).toEqual({ from: civil('2026-04-17'), longest: true })
  })

  it('leaves typed rows out of it, since they say nothing of what a bank has given', () => {
    expect(fetchFrom(OTP, [{ account: OTP.id, date: civil('2026-10-20'), importKey: '' }], DAY)).toEqual({ from: OTP.openedOn, longest: true })
  })

  it('stays plain within it', () => {
    expect(fetchFrom(OTP, synced('2026-08-16'), DAY).longest).toBe(false)
    expect(fetchFrom(OTP, synced('2026-08-14'), DAY).longest).toBe(true)
  })

  it('never starts past yesterday, since the API reads the day in UTC and refuses a future one', () => {
    expect(fetchFrom({ ...OTP, openedOn: DAY }, [], DAY).from).toBe(civil('2026-10-29'))
    expect(fetchFrom(OTP, synced('2026-10-30'), DAY).from).toBe(civil('2026-10-16'))
  })
})

describe('the fake Spending file', () => {
  it("brings the fake answer's rows into a dry run with rows a file brought skipped", async () => {
    const document = fakeSpendingDocument('2026-10-30T09:00:00.000Z', 'statements', DAY)
    const { workbook } = SPENDING_DOCUMENT.read({
      meta: { id: 'fake', source: 'browser', title: 'fake', syncedAt: '2026-10-30T09:00:00.000Z', lastExportedAt: null, unexportedSince: null },
      revision: '1',
      document,
    })
    const { statement } = await readBanks(fakeBankSync('linked', DAY), workbook, DAY)
    const run = statementDryRun(workbook, statement, DAY)
    expect(run.lines.filter((line) => line.outcome === 'other-source').map((line) => line.row.payee)).toEqual(['Transfer to Revolut'])
    expect(run.lines.filter((line) => line.row.payee === 'Corner bakery').map((line) => line.outcome)).toEqual(['new', 'new'])
    expect(run.lines.find((line) => line.row.payee === 'Café on the square')?.outcome).toBe('filled')
  })
})
