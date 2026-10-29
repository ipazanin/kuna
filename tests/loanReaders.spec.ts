import { describe, expect, it } from 'vitest'

import { codecOfLoansKind } from '../src/apps/loans/workbook/application/loansCodecs'
import { BANK_LOAN_RECORDS, EXTRA_PAYMENT_RECORDS, INFORMAL_LOAN_RECORDS, LATE_INSTALMENT_RECORDS, MOVEMENT_RECORDS, RATE_PERIOD_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import { LOANS_APP, LOANS_DOCUMENT } from '../src/apps/loans/workbook/infrastructure/loansDocument'
import type { DocumentRecord } from '../src/shared/storage/infrastructure/documentFormat'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import type { RecordFields } from '../src/shared/storage/domain/recordFields'
import { euros } from './fixtures/ledger'
import { LOAN_UUID, OTHER_UUID } from './fixtures/loans'

const LOAN = { id: LOAN_UUID, name: 'Car loan', lender: 'Example Bank', principal: '1200.00', drawdown: '2026-01-05', first_instalment: '2026-02-05', instalments: '12' }
const FIRST_RATE = { id: 'a1', loan: LOAN_UUID, from: '2026-02-05', rate: '12', rate_type: 'fixed' }
const FRIEND = { id: OTHER_UUID, name: 'From Ana', counterparty: 'Ana', direction: 'you-owe', opening_balance: '3000.00', start: '2026-03-01' }

type Records = Partial<Record<'bank-loan' | 'rate-period' | 'extra-payment' | 'late-instalment' | 'informal-loan' | 'movement', readonly DocumentRecord[]>>

function booksOf(records: Records) {
  const document = newDocument(LOANS_APP, { loans: 1 }, records, '2026-10-28T09:00:00.000Z')
  return LOANS_DOCUMENT.read({
    meta: { id: 'local', source: 'browser', title: 'kuna-loans.json', syncedAt: '2026-10-28T09:00:00.000Z', lastExportedAt: null, unexportedSince: null },
    revision: '1',
    document,
  }).workbook
}

/** Each problem as its kind, the record's label and the reason. */
function problemsOf(records: Records): [string, string, string][] {
  return booksOf(records).problems.map((problem) => [problem.kind, problem.label, problem.reason])
}

function roundTrip<R>(kind: RecordKind<R>, fields: RecordFields): RecordFields {
  const codec = codecOfLoansKind(kind)
  const stored = storedFieldsOfValues(fields)
  return codec.fieldsOf(codec.make(stored, recordIdOf(kind, String(fields.id))))
}

describe('the Loans file', () => {
  it('writes every kind back field for field as it read it', () => {
    const loan = {
      ...LOAN,
      interim_interest: '12.40',
      interim_interest_date: '2026-02-05',
      subsidy_monthly: '50.00',
      subsidy_first_instalment: '1',
      subsidy_instalments: '6',
      subsidy_payer: 'APN',
      note: 'Housing',
    }
    const kinds: [RecordKind<unknown>, RecordFields][] = [
      [BANK_LOAN_RECORDS, loan],
      [RATE_PERIOD_RECORDS, { ...FIRST_RATE, rate: '3.1825', rate_type: 'variable', note: '6M EURIBOR + 0.90' }],
      [EXTRA_PAYMENT_RECORDS, { id: 'x1', loan: LOAN_UUID, date: '2026-07-05', amount: '300.00', effect: 'shorter-term' }],
      [LATE_INSTALMENT_RECORDS, { id: 'l1', loan: LOAN_UUID, due: '2026-03-05', paid: '2026-03-23' }],
      [INFORMAL_LOAN_RECORDS, { ...FRIEND, note: 'For the boat' }],
      [MOVEMENT_RECORDS, { id: 'm1', loan: OTHER_UUID, date: '2026-04-01', kind: 'borrowed-in-kind', amount: '45.50', note: 'Paid my ferry ticket' }],
    ]

    for (const [kind, fields] of kinds) {
      expect(roundTrip(kind, fields)).toEqual(fields)
    }
  })

  it('reads a bank loan with its rate periods, payments and plan, and an informal loan with its movements', () => {
    const books = booksOf({
      'bank-loan': [LOAN],
      'rate-period': [FIRST_RATE, { id: 'a2', loan: LOAN_UUID, from: '2026-08-05', rate: '6', rate_type: 'variable' }],
      'extra-payment': [{ id: 'x1', loan: LOAN_UUID, date: '2026-07-05', amount: '300.00', effect: 'lower-instalment' }],
      'late-instalment': [{ id: 'l1', loan: LOAN_UUID, due: '2026-03-05', paid: '2026-03-23' }],
      'informal-loan': [FRIEND],
      movement: [{ id: 'm1', loan: OTHER_UUID, date: '2026-04-01', kind: 'repaid', amount: '500.00' }],
    })

    expect(books.problems).toEqual([])
    const [bank] = books.bankLoans
    expect(bank).toMatchObject({ loan: { id: recordIdOf(BANK_LOAN_RECORDS, LOAN_UUID), principal: euros(1200), instalments: 12 } })
    expect(bank!.ratePeriods.map((period) => [period.from, period.rate, period.rateType])).toEqual([
      ['2026-02-05', 120_000, 'fixed'],
      ['2026-08-05', 60_000, 'variable'],
    ])
    expect(bank!.plan?.filter((row) => row.kind === 'instalment')).toHaveLength(12)
    expect(bank!.extraPayments).toHaveLength(1)
    expect(bank!.lateInstalments).toHaveLength(1)
    expect(books.informalLoans).toMatchObject([{ loan: { name: 'From Ana', openingBalance: euros(3000) }, movements: [{ kind: 'repaid', amount: euros(500) }] }])
  })

  it('refuses a bank loan whose terms do not make a loan, and says why', () => {
    expect(
      problemsOf({
        'bank-loan': [
          { ...LOAN, id: 'b1', name: '' },
          { ...LOAN, id: 'b2', principal: '0' },
          { ...LOAN, id: 'b3', first_instalment: '2026-01-05' },
          { ...LOAN, id: 'b4', instalments: 'twelve' },
          { ...LOAN, id: 'b5', instalments: '601' },
          { ...LOAN, id: 'b6', interim_interest: '12.40' },
          { ...LOAN, id: 'b7', interim_interest: '12.40', interim_interest_date: '2026-02-06' },
          { ...LOAN, id: 'b8', subsidy_monthly: '50.00', subsidy_first_instalment: '1' },
          { ...LOAN, id: 'b9', subsidy_monthly: '50.00', subsidy_first_instalment: '10', subsidy_instalments: '4' },
          { ...LOAN, id: 'b10', subsidy_payer: 'APN' },
        ],
      }),
    ).toEqual([
      ['bank-loan', 'unnamed', 'no name'],
      ['bank-loan', 'Car loan', 'principal must be more than zero'],
      ['bank-loan', 'Car loan', 'first_instalment 2026-01-05 is not after the drawdown 2026-01-05'],
      ['bank-loan', 'Car loan', 'instalments "twelve" is not a whole number above zero'],
      ['bank-loan', 'Car loan', 'more than 600 instalments'],
      ['bank-loan', 'Car loan', 'interim_interest and interim_interest_date go together, and only one is filled'],
      ['bank-loan', 'Car loan', 'interim_interest_date 2026-02-06 is not from the drawdown 2026-01-05 to the first instalment 2026-02-05'],
      ['bank-loan', 'Car loan', 'subsidy_monthly, subsidy_first_instalment and subsidy_instalments go together, and not all are filled'],
      ['bank-loan', 'Car loan', "the subsidy runs past instalment 12, the loan's last"],
      ['bank-loan', 'Car loan', 'subsidy_payer names a payer of no subsidy'],
    ])
  })

  it('reads a subsidy without a payer, as files saved before the field have it', () => {
    const books = booksOf({ 'bank-loan': [{ ...LOAN, subsidy_monthly: '50.00', subsidy_first_instalment: '1', subsidy_instalments: '6' }], 'rate-period': [FIRST_RATE] })

    expect(books.problems).toEqual([])
    expect(books.bankLoans[0]?.loan.subsidy).toEqual({ monthly: euros(50), firstInstalment: 1, instalments: 6, payer: '' })
  })

  it('doubts a bank loan with no rate period at its first instalment, and leaves out periods that leave a gap or overlap', () => {
    expect(problemsOf({ 'bank-loan': [LOAN] })).toEqual([['bank-loan', 'Car loan', 'no rate period starts at its first instalment on 2026-02-05, so its plan cannot be worked out']])
    expect(booksOf({ 'bank-loan': [LOAN] }).bankLoans).toMatchObject([{ plan: null }])

    expect(
      problemsOf({
        'bank-loan': [LOAN],
        'rate-period': [
          { ...FIRST_RATE, id: 'a1', from: '2026-03-05' },
          { ...FIRST_RATE, id: 'a2', from: '2026-05-05' },
          { ...FIRST_RATE, id: 'a3', from: '2026-05-05', rate: '7' },
          { ...FIRST_RATE, id: 'a4', from: '2026-06-06' },
          { ...FIRST_RATE, id: 'a5', rate: '3.18%' },
          { ...FIRST_RATE, id: 'a6', rate_type: 'floating' },
        ],
      }),
    ).toEqual([
      ['bank-loan', 'Car loan', 'no rate period starts at its first instalment on 2026-02-05, so its plan cannot be worked out'],
      ['rate-period', '3.18%, from 2026-02-05', 'rate "3.18%" is not a yearly percent with at most four decimals, such as 3.18'],
      ['rate-period', '12%, from 2026-02-05', '"floating" is not a rate type. Use fixed, variable'],
      ['rate-period', '12%, from 2026-03-05', 'from 2026-03-05 leaves the instalments of "Car loan" from 2026-02-05 without a rate'],
      ['rate-period', '12%, from 2026-05-05', 'another rate period of "Car loan" starts on 2026-05-05 too'],
      ['rate-period', '7%, from 2026-05-05', 'another rate period of "Car loan" starts on 2026-05-05 too'],
      ['rate-period', '12%, from 2026-06-06', 'from 2026-06-06 is not a due date of "Car loan"'],
    ])
  })

  it('leaves out a record that names no loan of its kind, or falls before its loan starts', () => {
    expect(
      problemsOf({
        'bank-loan': [LOAN],
        'rate-period': [FIRST_RATE, { ...FIRST_RATE, id: 'a2', loan: OTHER_UUID }, { ...FIRST_RATE, id: 'a3', loan: '' }],
        'extra-payment': [{ id: 'x1', loan: LOAN_UUID, date: '2026-01-04', amount: '300.00', effect: 'shorter-term' }],
        'informal-loan': [FRIEND],
        movement: [
          { id: 'm1', loan: LOAN_UUID, date: '2026-04-01', kind: 'repaid', amount: '500.00' },
          { id: 'm2', loan: OTHER_UUID, date: '2026-02-28', kind: 'borrowed', amount: '500.00' },
        ],
      }),
    ).toEqual([
      ['rate-period', '12%, from 2026-02-05', 'no loan'],
      ['rate-period', '12%, from 2026-02-05', 'names no bank loan in the file'],
      ['extra-payment', '2026-01-04, 300', 'date 2026-01-04 is before "Car loan" was drawn on 2026-01-05'],
      ['movement', '2026-04-01, repaid, 500', 'names no informal loan in the file'],
      ['movement', '2026-02-28, borrowed, 500', 'date 2026-02-28 is before "From Ana" starts on 2026-03-01'],
    ])
  })

  it('reads payments and movements by their kind and amount', () => {
    expect(
      problemsOf({
        'bank-loan': [LOAN],
        'rate-period': [FIRST_RATE],
        'extra-payment': [
          { id: 'x1', loan: LOAN_UUID, date: '2026-07-05', amount: '0', effect: 'shorter-term' },
          { id: 'x2', loan: LOAN_UUID, date: '2026-07-05', amount: '300.00', effect: 'shorter' },
        ],
        'informal-loan': [FRIEND, { ...FRIEND, id: 'f2', direction: 'lent' }, { ...FRIEND, id: 'f3', opening_balance: '-1.00' }],
        movement: [
          { id: 'm1', loan: OTHER_UUID, date: '2026-04-01', kind: 'paid', amount: '500.00' },
          { id: 'm2', loan: OTHER_UUID, date: '2026-04-01', kind: 'repaid', amount: '-500.00' },
        ],
      }),
    ).toEqual([
      ['extra-payment', '2026-07-05, 0', 'amount must be more than zero'],
      ['extra-payment', '2026-07-05, 300', '"shorter" is not a payment effect. Use shorter-term, lower-instalment'],
      ['informal-loan', 'From Ana', '"lent" is not a direction. Use you-owe, owed-to-you'],
      ['informal-loan', 'From Ana', 'opening_balance is below zero'],
      ['movement', '2026-04-01, paid, 500', '"paid" is not a movement kind. Use borrowed, borrowed-in-kind, repaid, repaid-in-kind, forgiven'],
      ['movement', '2026-04-01, repaid, -500', 'amount must be more than zero'],
    ])
  })

  it("keeps a late instalment to a due date of its loan's plan, once, paid after it", () => {
    expect(
      problemsOf({
        'bank-loan': [LOAN],
        'rate-period': [FIRST_RATE],
        'extra-payment': [{ id: 'x1', loan: LOAN_UUID, date: '2026-07-05', amount: '600.00', effect: 'shorter-term' }],
        'late-instalment': [
          { id: 'l1', loan: LOAN_UUID, due: '2026-03-05', paid: '2026-03-05' },
          { id: 'l2', loan: LOAN_UUID, due: '2026-03-06', paid: '2026-03-23' },
          { id: 'l3', loan: LOAN_UUID, due: '2026-04-05', paid: '2026-04-09' },
          { id: 'l4', loan: LOAN_UUID, due: '2026-04-05', paid: '2026-04-10' },
          { id: 'l5', loan: LOAN_UUID, due: '2026-11-05', paid: '2026-11-10' },
        ],
      }),
    ).toEqual([
      ['late-instalment', 'due 2026-03-05, paid 2026-03-05', 'paid 2026-03-05 is not after the due date 2026-03-05'],
      ['late-instalment', 'due 2026-03-06, paid 2026-03-23', 'due 2026-03-06 is not a due date of "Car loan"'],
      ['late-instalment', 'due 2026-04-05, paid 2026-04-09', 'another late instalment of "Car loan" names the due date 2026-04-05 too'],
      ['late-instalment', 'due 2026-04-05, paid 2026-04-10', 'another late instalment of "Car loan" names the due date 2026-04-05 too'],
      // 600.00 after instalment 6 leaves 17.89, which instalment 7 repays, so the plan has no instalment in November.
      ['late-instalment', 'due 2026-11-05, paid 2026-11-10', 'due 2026-11-05 is not a due date of "Car loan"'],
    ])
  })

  it('leaves out every record of an id another record holds too', () => {
    expect(problemsOf({ 'informal-loan': [FRIEND, { ...FRIEND, name: 'Copy' }] }).map(([kind, label]) => [kind, label])).toEqual([
      ['informal-loan', 'From Ana'],
      ['informal-loan', 'Copy'],
    ])
  })
})
