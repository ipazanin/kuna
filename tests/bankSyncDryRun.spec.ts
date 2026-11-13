import { describe, expect, it } from 'vitest'

import { readBanks } from '../src/apps/spending/bankSync/application/bankRead'
import type { BankRead } from '../src/apps/spending/bankSync/application/bankRead'
import { BankScriptFailure } from '../src/apps/spending/bankSync/application/bankSync'
import type { BankSyncPort } from '../src/apps/spending/bankSync/application/bankSync'
import { startDays, startedAccount } from '../src/apps/spending/bankSync/domain/bankAccountSetup'
import { accountsOfLinked, fetchFrom } from '../src/apps/spending/bankSync/domain/bankLinks'
import { bankSyncRows, rowsWithMoves } from '../src/apps/spending/bankSync/domain/bankSyncRows'
import type { SyncedRows } from '../src/apps/spending/bankSync/domain/bankSyncRows'
import type { BankSession, BankTransaction, LinkedAccount } from '../src/apps/spending/bankSync/domain/bankAnswer'
import { fakeBankSync } from '../src/apps/spending/bankSync/infrastructure/fake/fakeBankSync'
import { reviewCount } from '../src/apps/spending/statements/domain/reviewQueue'
import { revolutStatement } from '../src/apps/spending/statements/domain/revolutStatement'
import { statementDryRun, syncGapOf } from '../src/apps/spending/statements/domain/statementDryRun'
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

function linked(uid: string, iban: string, currency: string): LinkedAccount {
  return { uid, iban, currency, product: null, details: null, cashAccountType: null, usage: null, identificationHash: null }
}

function bookOf(transactions: readonly Transaction[], rules: readonly SpendingRule[] = []): SpendingBook {
  return {
    accounts: ACCOUNTS,
    categories: CATEGORIES,
    transactions,
    budgets: [],
    rules,
    receipts: [],
    items: [],
    held: [],
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
  exchangeRate: null,
}

function syncOf(answer: readonly BankTransaction[]): StatementRows {
  const { label, rows } = bankSyncRows(answer, OTP)
  return { label, rows, notes: [] }
}

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
      cashWithdrawal: false,
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

  it('puts a row the day after of the same money on hold, since the two may date one booking on different days', () => {
    const file = fileRow(1, '2026-10-27')
    const run = statementDryRun(bookOf([file]), syncOf([BANK]), DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['look-alike'])
    expect(run.added).toEqual([])
    expect(run.notes).toEqual([])
    expect(run.held).toEqual([expect.objectContaining({ account: OTP.id, date: civil('2026-10-28'), importKey: run.lines[0]!.row.importKey, like: file.id })])
  })

  it('finds a row on hold by its key when a later sync brings it again, and neither asks nor holds it twice', () => {
    const file = fileRow(1, '2026-10-27')
    const first = statementDryRun(bookOf([file]), syncOf([BANK]), DAY, () => '00000000-0000-4000-8000-000000000001')
    const again = statementDryRun({ ...bookOf([file]), held: first.held }, syncOf([BANK]), DAY)
    expect(again.lines).toEqual([expect.objectContaining({ outcome: 'look-alike', like: file })])
    expect([again.held, again.questions, again.added]).toEqual([[], [], []])
  })

  it('takes a row the day after of other money', () => {
    const run = statementDryRun(bookOf([fileRow(1, '2026-10-27', -4)]), syncOf([BANK]), DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['new'])
  })

  it('lets a row on the file’s days take its own twin first, so a second payment of the same money the day after stays new', () => {
    const second = { ...BANK, reference: 'ref-2', bookedOn: '2026-10-29' }
    const run = statementDryRun(bookOf([fileRow(1, '2026-10-28')]), syncOf([second, BANK]), DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['new', 'other-source'])
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
      withdrawal: null,
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
    const run = statementDryRun(bookOf([synced('2026-10-29')]), fileStatement([{ payee: 'Pharmacy' }]), DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['new'])
  })

  it('asks about a row from before the sync began that looks like a synced row a day later', () => {
    const book = bookOf([synced('2026-10-29')])
    const run = statementDryRun(book, fileStatement([{}]), DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['look-alike'])
    expect(run.questions.map((question) => [question.booked, question.keep])).toEqual([[book.transactions[0], null]])
    expect(run.notes).toEqual([])
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

describe('a file for the days it names on a synced account', () => {
  const synced = (date: string, payee = 'Corner bakery', amount = -6.5) => row(OTP, date, amount, null, { payee, source: 'statement', importKey: `bank-${date}-${payee}`, statement: 'Enable Banking' })
  const on = (date: string, payee = 'Corner bakery', amount = -6.5): Partial<StatementRow> => ({ date: civil(date), payee, amount: accountMoneyFromAmount(amount) })
  const days = (from: string, to: string) => ({ from: civil(from), to: civil(to) })

  it('books the rows the sync brought on both ends of the days once, adds the gap between, and leaves out the rest', () => {
    const book = bookOf([synced('2026-10-05'), synced('2026-10-25')])
    const file = fileStatement([on('2026-10-04', 'Kiosk', -2), on('2026-10-05'), on('2026-10-12', 'Pharmacy', -20), on('2026-10-25'), on('2026-10-26', 'Kiosk', -2)])
    const run = statementDryRun(book, { ...file, days: days('2026-10-05', '2026-10-25') }, DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['outside-days', 'already-in', 'new', 'already-in', 'outside-days'])
    expect(run.added.map((added) => added.payee)).toEqual(['Pharmacy'])
    expect(run.notes).toEqual(['2 rows left out, since the file brings only the days from 5 Oct 2026 to 25 Oct 2026.'])
  })

  it('asks about a row on an end of the days that only looks like the synced one, instead of adding it twice', () => {
    const book = bookOf([synced('2026-10-05', 'CORNER BAKERY D.O.O.')])
    const run = statementDryRun(book, { ...fileStatement([on('2026-10-04'), on('2026-10-12', 'Pharmacy', -20)]), days: days('2026-10-04', '2026-10-12') }, DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['look-alike', 'new'])
    expect(run.questions.map((question) => question.booked)).toEqual([book.transactions[0]])
  })

  it('adds nothing for days the sync already covers whole', () => {
    const book = bookOf([synced('2026-10-05'), synced('2026-10-06', 'Market', -30)])
    const run = statementDryRun(book, { ...fileStatement([on('2026-10-05'), on('2026-10-06', 'Market', -30)]), days: days('2026-10-05', '2026-10-06') }, DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['already-in', 'already-in'])
    expect([run.added, run.changed, run.notes]).toEqual([[], [], []])
  })

  it('takes the rows of the days on an account the sync brought nothing to, and leaves out the rest', () => {
    const run = statementDryRun(bookOf([]), { ...fileStatement([on('2026-10-01'), on('2026-10-15', 'Pharmacy', -20), on('2026-10-30')]), days: days('2026-10-10', '2026-10-20') }, DAY)
    expect(run.lines.map((line) => line.outcome)).toEqual(['outside-days', 'new', 'outside-days'])
    expect(run.added.map((added) => added.payee)).toEqual(['Pharmacy'])
  })

  it('takes no row when the last day comes before the first', () => {
    const run = statementDryRun(bookOf([]), { ...fileStatement([on('2026-10-15')]), days: days('2026-10-20', '2026-10-10') }, DAY)
    expect([run.lines.map((line) => line.outcome), run.added]).toEqual([['outside-days'], []])
  })
})

describe('syncGapOf', () => {
  const synced = (account: Account, date: string) => row(account, date, -1, null, { source: 'statement', importKey: `bank-${account.id}-${date}`, statement: 'Enable Banking' })
  const file = (...dates: string[]) => fileStatement(dates.map((date) => ({ date: civil(date) })))

  it('names the longest run of the file’s days the sync brought no row on', () => {
    const transactions = [synced(OTP, '2026-10-01'), synced(OTP, '2026-10-02'), synced(OTP, '2026-10-20'), synced(OTP, '2026-10-21'), synced(OTP, '2026-10-24')]
    expect(syncGapOf(transactions, file('2026-09-28', '2026-10-05', '2026-10-15', '2026-10-25'))).toEqual({ from: civil('2026-10-03'), to: civil('2026-10-19') })
  })

  it('names the file’s own days when they all fall between two synced days', () => {
    expect(syncGapOf([synced(OTP, '2026-10-01'), synced(OTP, '2026-10-30')], file('2026-10-10', '2026-10-12'))).toEqual({ from: civil('2026-10-10'), to: civil('2026-10-12') })
  })

  it('names nothing for a file the sync’s days leave whole, or one whose every day the sync brought rows on', () => {
    expect(syncGapOf([synced(OTP, '2026-10-20')], file('2026-10-01', '2026-10-19'))).toBeNull()
    expect(syncGapOf([synced(REVOLUT_EUR, '2026-10-01')], file('2026-10-05'))).toBeNull()
    expect(syncGapOf([synced(OTP, '2026-10-05'), synced(OTP, '2026-10-06')], file('2026-10-05', '2026-10-06'))).toBeNull()
  })

  it('names nothing for rows the AI copied, since no day belongs to a source for them', () => {
    expect(syncGapOf([synced(OTP, '2026-10-01')], { ...file('2026-10-10'), transcribed: { lookAlikes: 'ask' } })).toBeNull()
  })
})

describe('a Revolut export and a sync answer of the same days', () => {
  const HEADER = ['Type', 'Product', 'Started Date', 'Completed Date', 'Description', 'Amount', 'Fee', 'Currency', 'State', 'Balance']
  /** The export: a market on 26 October, and a bakery started late on 27 October. */
  const EXPORT = [
    HEADER,
    ['CARD_PAYMENT', 'Current', '2026-10-26 12:00:00', '2026-10-26 12:00:00', 'Konzum', '-45.30', '0.00', 'EUR', 'COMPLETED', ''],
    ['CARD_PAYMENT', 'Current', '2026-10-27 23:50:00', '2026-10-28 09:00:00', 'Corner Bakery', '-6.50', '0.00', 'EUR', 'COMPLETED', ''],
  ]
  /** The same two from the sync, which dates the bakery by its booking a day later and names the companies in full. */
  const ANSWER: readonly BankTransaction[] = [
    { ...BANK, reference: 'rev-1', amount: '45.30', bookedOn: '2026-10-26', creditorName: 'KONZUM PLUS D.O.O.' },
    { ...BANK, reference: 'rev-2', amount: '6.50', bookedOn: '2026-10-28', creditorName: 'CORNER BAKERY D.O.O.' },
  ]

  function exported(): StatementRows {
    const reading = revolutStatement(EXPORT, 'revolut.csv', { accounts: ACCOUNTS, categories: CATEGORIES })
    if (!('statement' in reading)) throw new Error(reading.refusal)
    return reading.statement
  }

  function synced(): StatementRows {
    const { label, rows } = bankSyncRows(ANSWER, REVOLUT_EUR)
    return { label, rows, notes: [] }
  }

  it('puts the bakery of a sync after the export on hold, since the sync asks nobody', () => {
    const first = statementDryRun(bookOf([]), exported(), DAY)
    expect(first.added).toHaveLength(2)
    const second = statementDryRun(bookOf(first.added), synced(), DAY)
    expect(second.lines.map((line) => line.outcome)).toEqual(['other-source', 'look-alike'])
    expect(second.added).toEqual([])
    expect([second.notes.length, second.held.length]).toEqual([1, 1])
  })

  it('asks about the bakery on an export after the sync, and books it once whichever way the person answers', () => {
    const { label, rows } = bankSyncRows(ANSWER.slice(1), REVOLUT_EUR)
    const first = statementDryRun(bookOf([]), { label, rows, notes: [] }, DAY)
    expect(first.added).toHaveLength(1)
    const book = bookOf(first.added)
    const asked = statementDryRun(book, exported(), DAY)
    expect(asked.lines.map((line) => line.outcome)).toEqual(['new', 'look-alike'])
    expect(asked.added.map((row) => row.payee)).toEqual(['Konzum'])
    const [question] = asked.questions
    const answered = (keep: 'both' | 'file') => statementDryRun(book, { ...exported(), twinAnswers: new Map([[question!.key, { booked: question!.booked.id, keep }]]) }, DAY)
    const replaced = answered('file')
    expect(replaced.lines.map((line) => line.outcome)).toEqual(['new', 'replaced'])
    // The kept row keeps the bank's key and takes the file's day, payee and text, so the sync's first day moves a day earlier, to 27 October.
    const [kept] = replaced.changed
    expect(kept).toEqual({ before: first.added[0], after: { ...first.added[0]!, date: question!.row.date, payee: 'Corner Bakery', description: question!.row.description } })
    const reread = statementDryRun(bookOf([kept!.after]), exported(), DAY)
    expect(reread.lines.map((line) => line.outcome)).toEqual(['new', 'other-source'])
    expect(kept!.after.date).toBe(civil('2026-10-27'))
    expect(answered('both').added.map((row) => row.payee)).toEqual(['Konzum', 'Corner Bakery'])
  })
})

describe('an exchange or a pocket move from the sync, whose shape is a guess until the first real run', () => {
  const leg = (account: Account, direction: string, amount: string, currency: string, payee: string, reference: string, exchangeRate: string | null = null): SyncedRows =>
    bankSyncRows([{ ...BANK, reference, direction, amount, currency, creditorName: payee, debtorName: payee, exchangeRate }], account)
  const synced = (legs: readonly SyncedRows[], accounts: readonly Account[] = ACCOUNTS): StatementRows => {
    const rows = legs.flatMap((one) => one.rows)
    const rates = new Map(legs.flatMap((one) => [...one.exchangeRates]))
    return { label: 'Enable Banking', notes: [], rows: rowsWithMoves(rows, rates, accounts) }
  }
  const between = category('Between my accounts').id

  it('pairs both legs of an exchange whose amounts follow the rate, under Between my accounts', () => {
    const statement = synced([leg(REVOLUT_EUR, 'DBIT', '100.00', 'EUR', 'Exchanged to USD', 'x-1', '1.08'), leg(REVOLUT_USD, 'CRDT', '108.00', 'USD', 'Exchanged from EUR', 'x-2')])
    const run = statementDryRun(bookOf([]), statement, DAY)
    const [sold, bought] = run.added
    expect([sold?.pair, bought?.pair]).toEqual([bought?.id, sold?.id])
    expect([sold?.category, bought?.category]).toEqual([between, between])
    expect(reviewCount({ ...bookOf(run.added) })).toBe(0)
  })

  it('leaves both legs of an exchange without a rate on review, unpaired, each moving its own balance once', () => {
    const run = statementDryRun(bookOf([]), synced([leg(REVOLUT_EUR, 'DBIT', '100.00', 'EUR', 'Exchanged to USD', 'x-1'), leg(REVOLUT_USD, 'CRDT', '108.00', 'USD', 'Exchanged from EUR', 'x-2')]), DAY)
    expect(run.added.map((added) => [added.amount, added.category, added.pair])).toEqual([
      [accountMoneyFromAmount(-100), null, null],
      [accountMoneyFromAmount(108), null, null],
    ])
    expect(reviewCount({ ...bookOf(run.added) })).toBe(2)
  })

  it('pairs a pocket move into a savings account of the same bank as a pocket', () => {
    const pocket: Account = { ...REVOLUT_EUR, id: recordIdOf(ACCOUNT_RECORDS, 'a0000000-0000-4000-8000-000000000009'), name: 'Revolut pocket', kind: 'savings', iban: 'LT000000000000000002' }
    const accounts = [...ACCOUNTS, pocket]
    const statement = synced([leg(REVOLUT_EUR, 'DBIT', '15.00', 'EUR', 'To pocket', 'p-1'), leg(pocket, 'CRDT', '15.00', 'EUR', 'From current', 'p-2')], accounts)
    const run = statementDryRun({ ...bookOf([]), accounts }, statement, DAY)
    expect(run.added.map((added) => [added.category, added.pocket, added.pair !== null])).toEqual([
      [between, true, true],
      [between, true, true],
    ])
  })

  it('leaves a pocket move on one account on review, where the two legs cancel out', () => {
    const run = statementDryRun(bookOf([]), synced([leg(REVOLUT_EUR, 'DBIT', '15.00', 'EUR', 'To pocket', 'p-1'), leg(REVOLUT_EUR, 'CRDT', '15.00', 'EUR', 'To pocket', 'p-2')]), DAY)
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
    accounts: status === 'AUTHORIZED' ? [linked(uid, iban, currency)] : [],
  })
  const OTP_SESSION = session('OTP banka', 'AUTHORIZED', 'otp', OTP.iban)
  const REVOLUT_SESSION = session('Revolut', 'AUTHORIZED', 'revolut', REVOLUT_EUR.iban)
  const payeesOf = (read: BankRead): readonly string[] => read.statement.rows.map((statementRow) => statementRow.payee)

  it('reads each live session onto the account with its IBAN and currency, Revolut split by currency', async () => {
    const { statement, proposals, problems } = await readBanks(port, bookOf([]), DAY)
    expect(proposals).toEqual([])
    expect(problems).toEqual([])
    expect(new Set(statement.rows.map((statementRow) => statementRow.account))).toEqual(
      new Set(ACCOUNTS.filter((account) => account.bank !== null && account.kind === 'bank').map((account) => account.id)),
    )
  })

  it('drafts a linked account Kuna does not keep, and reads the rest', async () => {
    const { proposals, statement } = await readBanks(fakeBankSync('unknown-account', DAY), bookOf([]), DAY)
    expect(proposals.map(({ bank, account }) => [bank, account.iban, account.currency, account.name])).toEqual([['otp', 'HR0000000000000000077', 'EUR', 'OTP EUR']])
    expect(statement.rows.some((statementRow) => statementRow.account === proposals[0]!.account.id)).toBe(false)
  })

  it('fetches a new account from years back, holds its rows and works out its opening from the balance', async () => {
    const asked: [string, string, boolean][] = []
    const port = fakeBankSync('new-accounts', DAY)
    const counting: BankSyncPort = { ...port, transactions: async (uid, from, longest) => (asked.push([uid, from, longest]), port.transactions(uid, from, longest)) }
    const { proposals } = await readBanks(counting, bookOf([]), DAY)
    expect(asked.filter(([uid]) => uid.startsWith('fake-revolut-new'))).toEqual([
      ['fake-revolut-new-usd', '2021-10-26', true],
      ['fake-revolut-new-savings', '2021-10-26', true],
    ])
    const fromEarliest = proposals.map((proposal) => startedAccount({ proposal, startsOn: startDays(proposal).earliest }))
    expect(fromEarliest.map(({ account, opening }) => [account.name, account.kind, account.openedOn, account.opening, opening.source, opening.rows])).toEqual([
      // 40.00 in and 12.50 out add up to the 27.50 the bank says, so it can start empty the day before its first row.
      ['Revolut USD 0003', 'bank', civil('2026-07-01'), 0, 'start', 2],
      // 350.00 less the one 100.00 row.
      ['Revolut EUR savings', 'savings', civil('2026-09-30'), 25_000, 'worked', 1],
    ])
    // Unless the person picks an earlier day, each starts on the day of the fetch at the bank's balance, with no row before it.
    expect(proposals.map(({ account }) => [account.openedOn, account.opening])).toEqual([
      [DAY, 2_750],
      [DAY, 35_000],
    ])
    expect(proposals[0]!.rows.rows.map((statementRow) => statementRow.payee)).toEqual(['Top-up', 'Bookshop in Boston'])
  })

  it('reads no account you said Kuna does not keep', async () => {
    const asked: string[] = []
    const port = fakeBankSync('new-accounts', DAY)
    const book = { ...bookOf([]), settings: { ...bookOf([]).settings, bankAccountsNotInKuna: ['LT000000000000000003 USD'] } }
    const read = await readBanks({ ...port, transactions: async (uid, from, longest) => (asked.push(uid), port.transactions(uid, from, longest)) }, book, DAY)
    expect(asked).not.toContain('fake-revolut-new-usd')
    expect(read.proposals.map(({ account }) => account.name)).toEqual(['Revolut EUR savings'])
    expect(read.linked.map(({ account }) => account.uid)).toContain('fake-revolut-new-usd')
  })

  it('reads an account you said is not in Kuna once you keep an account under its IBAN and currency', async () => {
    const book = { ...bookOf([]), settings: { ...bookOf([]).settings, bankAccountsNotInKuna: [`${REVOLUT_USD.iban} USD`] } }
    const read = await readBanks(port, book, DAY)
    expect(read.statement.rows.some((statementRow) => statementRow.account === REVOLUT_USD.id)).toBe(true)
  })

  it('gives two new accounts of one bank and currency different names', async () => {
    const twoUsd: BankSyncPort = {
      ...port,
      sessions: async () => [{ bank: 'Revolut', status: 'AUTHORIZED', accounts: [linked('usd-1', 'LT000000000000000004', 'USD'), linked('usd-2', 'LT000000000000000005', 'USD')] }],
      transactions: async () => [],
      balances: async () => [],
    }
    const { proposals } = await readBanks(twoUsd, { ...bookOf([]), accounts: [OTP, REVOLUT_EUR] }, DAY)
    expect(proposals.map(({ account }) => account.name)).toEqual(['Revolut USD', 'Revolut USD 0005'])
  })

  it('says nothing of older rows on the fetch just after a link, which a new link could not better', async () => {
    const openedLongAgo: SpendingBook = { ...bookOf([]), accounts: ACCOUNTS.map((account) => ({ ...account, openedOn: civil('2026-05-01') })) }
    const { olderRows } = await readBanks(port, openedLongAgo, DAY, ['revolut'])
    expect(olderRows.map(({ bank }) => bank)).toEqual(['otp'])
  })

  it('says a kept account wanted older rows than the bank gave, and not when a file covers those days', async () => {
    const openedLongAgo = (transactions: readonly Transaction[]): SpendingBook => ({ ...bookOf(transactions), accounts: ACCOUNTS.map((account) => ({ ...account, openedOn: civil('2026-05-01') })) })
    const { olderRows } = await readBanks(port, openedLongAgo([]), DAY)
    expect(olderRows.map(({ bank, account, reached }) => [bank, account.name, reached])).toEqual([
      ['otp', OTP.name, civil('2026-10-28')],
      ['revolut', REVOLUT_EUR.name, civil('2026-10-28')],
      ['revolut', REVOLUT_USD.name, civil('2026-10-29')],
    ])
    const covered = await readBanks(port, openedLongAgo([fileRow(1, '2026-10-20')]), DAY)
    expect(covered.olderRows.map(({ account }) => account.name)).not.toContain(OTP.name)
  })

  it('keeps the other bank when the script could not ask one, and says why', async () => {
    const failing: BankSyncPort = {
      ...port,
      sessions: async () => [session('OTP banka', 'FAILED', '', '', 'EUR', 'Enable Banking answered 429: ASPSP_RATE_LIMIT_EXCEEDED'), REVOLUT_SESSION],
      transactions: async () => [BANK],
    }
    const read = await readBanks(failing, bookOf([]), DAY)
    expect(payeesOf(read)).toEqual(['Corner bakery'])
    expect(read.problems).toEqual(['OTP did not answer, so its rows wait for a later sync: Enable Banking answered 429: ASPSP_RATE_LIMIT_EXCEEDED'])
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
    expect(read.problems).toEqual(['OTP did not answer, so its rows wait for a later sync: The bank sync script did not answer: ASPSP_ERROR'])
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
          accounts: [linked('current', REVOLUT_EUR.iban, 'EUR'), linked('pocket', REVOLUT_EUR.iban, 'EUR')],
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
    expect(accountsOfLinked(linked('u', REVOLUT_EUR.iban, 'EUR'), [savings, REVOLUT_EUR])).toEqual([REVOLUT_EUR])
  })

  it('sends a linked account to an account typed with a blank bank, since the IBAN already names it', () => {
    const typed = { ...REVOLUT_EUR, bank: null }
    expect(accountsOfLinked(linked('u', REVOLUT_EUR.iban, 'EUR'), [typed])).toEqual([typed])
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
    const document = fakeSpendingDocument('2026-10-30T09:00:00.000Z', 'statements', DAY, 'linked')
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

  it.each([
    ['exchange', ['Exchanged to USD', 'Exchanged from EUR'], false],
    ['pocket', ['To pocket Summer trip', 'From current'], true],
  ])("pairs the %s variant's two legs under Between my accounts", async (variant, payees, pocket) => {
    const document = fakeSpendingDocument('2026-10-30T09:00:00.000Z', 'statements', DAY, variant)
    const { workbook } = SPENDING_DOCUMENT.read({
      meta: { id: 'fake', source: 'browser', title: 'fake', syncedAt: '2026-10-30T09:00:00.000Z', lastExportedAt: null, unexportedSince: null },
      revision: '1',
      document,
    })
    const { statement } = await readBanks(fakeBankSync(variant, DAY), workbook, DAY)
    const run = statementDryRun(workbook, statement, DAY)
    const legs = run.added.filter((added) => payees.includes(added.payee))
    const between = workbook.categories.find((each) => each.kind === 'transfer')?.id
    expect(legs.map((added) => [added.payee, added.category === between, added.pair !== null, added.pocket])).toEqual(payees.map((payee) => [payee, true, true, pocket]))
  })

  it("pairs the withdrawal variant's cash machine row with a leg on the cash account, which its rule spots", async () => {
    const document = fakeSpendingDocument('2026-10-30T09:00:00.000Z', 'statements', DAY, 'withdrawal')
    const { workbook } = SPENDING_DOCUMENT.read({
      meta: { id: 'fake', source: 'browser', title: 'fake', syncedAt: '2026-10-30T09:00:00.000Z', lastExportedAt: null, unexportedSince: null },
      revision: '1',
      document,
    })
    const { statement } = await readBanks(fakeBankSync('withdrawal', DAY), workbook, DAY)
    const run = statementDryRun(workbook, statement, DAY)
    const cash = workbook.accounts.find((each) => each.kind === 'cash')!
    const line = run.lines.find((each) => each.row.payee === 'Bankomat Ilica')

    expect(line?.outcome === 'new' && line.withdrawal?.cashLeg).toMatchObject({ account: cash.id, amount: accountMoneyFromAmount(50) })
    expect(run.added.filter((added) => added.payee === 'Bankomat Ilica').map((added) => added.account)).toEqual([line!.row.account, cash.id])
  })
})
