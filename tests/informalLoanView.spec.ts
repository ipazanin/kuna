import { describe, expect, it } from 'vitest'

import { informalClosedOn, informalLoanMonths, informalLoanMoves, movementLines, whoOwes } from '../src/apps/loans/informalLoans/presentation/informalLoanView'
import { civil, euros } from './fixtures/ledger'
import { informalLoan, movement } from './fixtures/loans'

// Luka borrowed 300.00 on 1 Feb 2026 and 200.00 on 10 Mar, and paid it all back on 24 Jun.
const toLuka = informalLoan({ name: 'Small loans', counterparty: 'Luka', direction: 'owed-to-you', openingBalance: euros(0), start: civil('2026-02-01') })
const movements = [movement(toLuka, '2026-02-01', 'borrowed', 300), movement(toLuka, '2026-03-10', 'borrowed', 200), movement(toLuka, '2026-06-24', 'repaid', 500)]
const book = { loan: toLuka, movements }

describe('an informal loan on its card and chart', () => {
  it('draws what is owed the way the loan runs, so a loan owed to you stays above zero', () => {
    expect(informalLoanMonths(book, civil('2026-07-15')).map((entry) => [entry.month, entry.owed])).toEqual([
      ['2026-02', euros(300)],
      ['2026-03', euros(500)],
      ['2026-04', euros(500)],
      ['2026-05', euros(500)],
      ['2026-06', euros(0)],
      ['2026-07', euros(0)],
    ])
  })

  it('is settled on the day of its last movement once nothing is owed, and open while a movement is still to come', () => {
    expect(informalClosedOn(book, civil('2026-07-15'))).toBe(civil('2026-06-24'))
    expect(informalClosedOn(book, civil('2026-05-01'))).toBeNull()
    expect(informalClosedOn({ loan: toLuka, movements: [...movements, movement(toLuka, '2026-08-01', 'borrowed', 50)] }, civil('2026-07-15'))).toBeNull()
  })

  it('stays open while it starts at zero and nothing has moved yet, since nothing was ever owed on it', () => {
    expect(informalClosedOn({ loan: toLuka, movements: [] }, civil('2026-07-15'))).toBeNull()
  })

  it('says nobody owes anything after the repayment that settled it, and who owes after every other movement', () => {
    expect(movementLines(book).map((line) => [line.kind, line.change, whoOwes(line.owedAfter)])).toEqual([
      ['Repaid', euros(-500), 'Nobody owes anything'],
      ['Borrowed', euros(200), 'They owe you'],
      ['Borrowed', euros(300), 'They owe you'],
    ])
  })

  it('marks borrowing as raising what is owed and every other movement as lowering it', () => {
    expect(informalLoanMoves(book).map((move) => [move.kind, move.amount, move.effect])).toEqual([
      ['Borrowed', euros(300), 'raises'],
      ['Borrowed', euros(200), 'raises'],
      ['Repaid', euros(500), 'lowers'],
    ])
  })
})
