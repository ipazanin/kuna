import { describe, expect, it } from 'vitest'

import { assetLoansOf } from '../src/apps/assets/loans/application/assetLoans'
import { assetsOnDay } from '../src/apps/assets/values/domain/assetsOnDay'
import { ASSET_RECORDS } from '../src/apps/assets/workbook/domain/assetKinds'
import { bankLoanFigures, bankLoanMonths } from '../src/apps/loans/bankLoans/domain/bankLoanFigures'
import { bankLoansOf } from '../src/apps/loans/facts'
import { loansNetWorthParts } from '../src/apps/loans/home/domain/loansNetWorthParts'
import { owedByMonth, plannedLoans } from '../src/apps/loans/overview/domain/loansTogether'
import { owedOnDay } from '../src/apps/loans/overview/domain/owedTotals'
import { codecOfLoansKind } from '../src/apps/loans/workbook/application/loansCodecs'
import { BANK_LOAN_RECORDS, LOAN_SHARE_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import { LOANS_APP } from '../src/apps/loans/workbook/domain/loansApp'
import { LOANS_DOCUMENT } from '../src/apps/loans/workbook/infrastructure/loansDocument'
import { percentFromBasisPoints } from '../src/shared/money/percent'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import type { RecordFields } from '../src/shared/storage/domain/recordFields'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import type { DocumentRecord } from '../src/shared/storage/infrastructure/documentFormat'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { civil, euros } from './fixtures/ledger'
import { LOAN_UUID } from './fixtures/loans'

const LOAN = { id: LOAN_UUID, name: 'Car loan', lender: 'Example Bank', principal: '1200.00', drawdown: '2026-01-05', first_instalment: '2026-02-05', instalments: '12' }
const FIRST_RATE = { id: 'a1', loan: LOAN_UUID, from: '2026-02-05', rate: '12', rate_type: 'fixed' }

type Records = Partial<Record<'bank-loan' | 'rate-period' | 'loan-share', readonly DocumentRecord[]>>

function booksOf(records: Records) {
  const document = newDocument(LOANS_APP, { loans: 2 }, { 'rate-period': [FIRST_RATE], ...records }, '2026-10-28T09:00:00.000Z')
  return LOANS_DOCUMENT.read({
    meta: { id: 'local', source: 'browser', title: 'kuna-loans.json', syncedAt: '2026-10-28T09:00:00.000Z', lastExportedAt: null, unexportedSince: null },
    revision: '1',
    document,
  }).workbook
}

function roundTrip<R>(kind: RecordKind<R>, fields: RecordFields): RecordFields {
  const codec = codecOfLoansKind(kind)
  return codec.fieldsOf(codec.make(storedFieldsOfValues(fields), recordIdOf(kind, String(fields.id))))
}

describe('your part of a bank loan you took out with others', () => {
  it('writes a loan with its part and a share change back field for field, and leaves the part out of a loan that is all yours', () => {
    expect(roundTrip(BANK_LOAN_RECORDS, { ...LOAN, share: '50' })).toEqual({ ...LOAN, share: '50' })
    expect(roundTrip(BANK_LOAN_RECORDS, LOAN)).toEqual(LOAN)
    const change = { id: 's1', loan: LOAN_UUID, from: '2026-06-01', share: '100', note: 'My partner left the loan' }
    expect(roundTrip(LOAN_SHARE_RECORDS, change)).toEqual(change)
    expect(booksOf({ 'bank-loan': [{ ...LOAN, share: '0.8' }] }).bankLoans[0]?.loan.share).toBe(percentFromBasisPoints(80))
  })

  it('gives a loan its share changes oldest first, and doubts one before the drawdown, a second on one day or one naming no loan', () => {
    const books = booksOf({
      'bank-loan': [{ ...LOAN, share: '50' }],
      'loan-share': [
        { id: 's2', loan: LOAN_UUID, from: '2026-09-01', share: '100' },
        { id: 's1', loan: LOAN_UUID, from: '2026-06-01', share: '60' },
        { id: 's3', loan: LOAN_UUID, from: '2025-12-31', share: '40' },
        { id: 's4', loan: '1c7a4d2f-6e3b-4f90-8b82-4d5e6f7a8b91', from: '2026-06-01', share: '40' },
        { id: 's5', loan: LOAN_UUID, from: '2026-07-01', share: '70' },
        { id: 's6', loan: LOAN_UUID, from: '2026-07-01', share: '80' },
      ],
    })

    expect(books.bankLoans[0]?.shares.map((change) => change.from)).toEqual(['2026-06-01', '2026-09-01'])
    expect(books.problems.map((problem) => [problem.kind, problem.label, problem.reason])).toEqual([
      ['loan-share', '2025-12-31, 40', 'from 2025-12-31 is before "Car loan" was drawn on 2026-01-05'],
      ['loan-share', '2026-06-01, 40', 'names no bank loan in the file'],
      ['loan-share', '2026-07-01, 70', 'another share change of "Car loan" is from 2026-07-01 too'],
      ['loan-share', '2026-07-01, 80', 'another share change of "Car loan" is from 2026-07-01 too'],
    ])
  })

  it("keeps the bank's balance on the loan, counts your half of it in the totals, Net worth and what Assets reads, and keeps instalments whole", () => {
    const book = booksOf({ 'bank-loan': [{ ...LOAN, share: '50' }] })
    const day = civil('2026-01-20')
    const figures = bankLoanFigures(book.bankLoans[0]!, day)

    // Before the first instalment the bank is owed the whole 1,200.00, and half of it is yours.
    expect(figures).toMatchObject({ owed: euros(1200), yours: euros(600) })
    expect(figures?.next?.payment).toBe(bankLoanFigures(booksOf({ 'bank-loan': [LOAN] }).bankLoans[0]!, day)?.next?.payment)
    expect(owedOnDay(book, day).owed).toBe(euros(600))
    expect(loansNetWorthParts(book, day)).toEqual([{ side: 'owes', cents: euros(600), loan: { kind: 'bank', at: 0 } }])
    expect(bankLoansOf(book, day)[0]?.owed).toBe(euros(600))
  })

  it('counts each month end at the share of that day, so a partner leaving the loan makes all of it yours from then', () => {
    const book = booksOf({ 'bank-loan': [{ ...LOAN, share: '50' }], 'loan-share': [{ id: 's1', loan: LOAN_UUID, from: '2026-03-01', share: '100' }] })
    const months = bankLoanMonths(book.bankLoans[0]!)

    expect(months[0]).toEqual({ month: '2026-01', owed: euros(1200), yours: euros(600) })
    // After the first instalment 1,105.38 is owed, half of it 552.69.
    expect(months[1]).toEqual({ month: '2026-02', owed: euros(1105.38), yours: euros(552.69) })
    expect(months[2]).not.toHaveProperty('yours')
    expect(owedByMonth(plannedLoans(book.bankLoans)).map((month) => month.total)).toEqual(months.map((month) => month.yours ?? month.owed))
  })

  it('takes your part of the loan off your part of the asset it is on', () => {
    const book = booksOf({ 'bank-loan': [{ ...LOAN, share: '50' }] })
    const asset = {
      id: recordIdOf(ASSET_RECORDS, 'a1'),
      name: 'Car',
      kind: 'other' as const,
      bought: civil('2026-01-05'),
      price: euros(2000),
      region: null,
      firstRegistration: null,
      loan: LOAN_UUID,
      share: percentFromBasisPoints(5000),
      note: '',
    }
    const day = civil('2026-01-20')
    const [shown] = assetsOnDay({ assets: [{ asset, valuations: [], shares: [], loanShared: false }] }, day, 'failed', assetLoansOf(bankLoansOf(book, day)))

    // Half of 2,000.00 less half of 1,200.00.
    expect(shown?.equity).toEqual({ value: euros(1000), whole: euros(2000), owed: euros(600), yours: euros(400) })
  })
})
