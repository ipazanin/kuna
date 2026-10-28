import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { BANK_LOAN_WRITES, EXTRA_PAYMENT_WRITES, LATE_INSTALMENT_WRITES, RATE_PERIOD_WRITES, removeBankLoan } from '../src/apps/loans/bankLoans/application/bankLoanWrites'
import { INFORMAL_LOAN_WRITES, MOVEMENT_WRITES, removeInformalLoan } from '../src/apps/loans/informalLoans/application/informalLoanWrites'
import { informalBalanceOn } from '../src/apps/loans/informalLoans/domain/informalBalance'
import { LATE_INSTALMENT_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import type { LoansBooks } from '../src/apps/loans/workbook/domain/loansBooks'
import { emptyLoansDocument } from '../src/apps/loans/workbook/infrastructure/loansDocument'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { recordsChangeInWords } from '../src/shared/storage/presentation/recordsChangeInWords'
import { civil, euros } from './fixtures/ledger'
import { LOAN_UUID, bankLoan, extraPayment, informalLoan, lateInstalment, movement, ratePeriod } from './fixtures/loans'
import { LOANS, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const LOAN = bankLoan()
const FIRST_RATE = ratePeriod(LOAN, '2026-02-05', '12')
const FRIEND = informalLoan()
const EMPTY_FILE = emptyLoansDocument('2026-10-16T09:00:00.000Z')

/** A store whose file holds the car loan at 12% and the loan from a friend. */
async function storeWithLoans(): Promise<WorkbookStore<LoansBooks>> {
  const { store } = await browserHarness(used, EMPTY_FILE, LOANS)
  await store.write('Added', (unit) => {
    unit.of(BANK_LOAN_WRITES).add(LOAN)
    unit.of(RATE_PERIOD_WRITES).add(FIRST_RATE)
    unit.of(INFORMAL_LOAN_WRITES).add(FRIEND)
  })
  return store
}

function bankBook(store: WorkbookStore<LoansBooks>) {
  return store.state.workbook!.bankLoans[0]!
}

describe('Loans writes', () => {
  it('adds a bank loan with its first rate period, stores the loan by its bare UUID, and one Undo takes both out', async () => {
    const { store, held } = await browserHarness(used, EMPTY_FILE, LOANS)

    await store.write('Added', (unit) => {
      unit.of(BANK_LOAN_WRITES).add(LOAN)
      unit.of(RATE_PERIOD_WRITES).add(FIRST_RATE)
    })

    expect(bankBook(store).plan).toHaveLength(12)
    expect((await held()).records['rate-period']).toEqual([{ id: 'period-2026-02-05', loan: LOAN_UUID, from: '2026-02-05', rate: '12', rate_type: 'fixed' }])
    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.bankLoans).toEqual([])
  })

  it('refuses a bank loan without a rate from its first instalment, and a rate period off its due dates', async () => {
    const { store } = await browserHarness(used, EMPTY_FILE, LOANS)

    await expect(store.write('Added', (unit) => unit.of(BANK_LOAN_WRITES).add(LOAN))).rejects.toThrow(
      'The new bank loan "Car loan" would read with a problem: no rate period starts at its first instalment on 2026-02-05, so its plan cannot be worked out.',
    )
    await expect(
      store.write('Added', (unit) => {
        unit.of(BANK_LOAN_WRITES).add(LOAN)
        unit.of(RATE_PERIOD_WRITES).add(ratePeriod(LOAN, '2026-02-06', '12'))
      }),
    ).rejects.toThrow('from 2026-02-06 is not a due date of "Car loan"')
    expect(store.state.writes).toEqual([])
  })

  it('changes the plan with a second rate period, and refuses to take away the rate from the first instalment', async () => {
    const store = await storeWithLoans()
    const later = ratePeriod(LOAN, '2026-08-05', '6')

    await store.write('Added', (unit) => unit.of(RATE_PERIOD_WRITES).add(later))
    expect(bankBook(store).plan![6]!.payment).toBe(euros(104.79))

    await expect(store.write('Removed', (unit) => unit.of(RATE_PERIOD_WRITES).remove(FIRST_RATE))).rejects.toThrow(
      'The bank loan "Car loan" would then read with a problem: no rate period starts at its first instalment on 2026-02-05, so its plan cannot be worked out.',
    )
    await store.write('Removed', (unit) => unit.of(RATE_PERIOD_WRITES).remove(later))
    expect(bankBook(store).plan![6]!.payment).toBe(euros(106.62))
  })

  it('refuses a change to a loan that leaves its rate periods off its due dates', async () => {
    const store = await storeWithLoans()

    await expect(store.write('Changed', (unit) => unit.of(BANK_LOAN_WRITES).change(LOAN, { ...LOAN, firstInstalment: civil('2026-02-10') }))).rejects.toThrow(
      'The rate period "12%, from 2026-02-05" would then be left out: from 2026-02-05 is not a due date of "Car loan".',
    )
    await store.write('Changed', (unit) => {
      unit.of(BANK_LOAN_WRITES).change(LOAN, { ...LOAN, firstInstalment: civil('2026-02-10') })
      unit.of(RATE_PERIOD_WRITES).change(FIRST_RATE, { ...FIRST_RATE, from: civil('2026-02-10') })
    })
    expect(bankBook(store).plan![0]!.date).toBe('2026-02-10')
  })

  it('marks an instalment late once, and refuses an extra payment that would end the plan before it', async () => {
    const store = await storeWithLoans()
    const late = lateInstalment(LOAN, '2026-11-05', '2026-11-12')

    await store.write('Added', (unit) => unit.of(LATE_INSTALMENT_WRITES).add(late))
    await expect(store.write('Added', (unit) => unit.of(LATE_INSTALMENT_WRITES).add({ ...late, id: recordIdOf(LATE_INSTALMENT_RECORDS, 'late-copy') }))).rejects.toThrow(
      'another late instalment of "Car loan" names the due date 2026-11-05 too',
    )
    await expect(store.write('Added', (unit) => unit.of(EXTRA_PAYMENT_WRITES).add(extraPayment(LOAN, '2026-07-05', 600, 'shorter-term')))).rejects.toThrow(
      'The late instalment "due 2026-11-05, paid 2026-11-12" would then be left out: due 2026-11-05 is not a due date of "Car loan".',
    )
    await expect(store.write('Added', (unit) => unit.of(EXTRA_PAYMENT_WRITES).add(extraPayment(LOAN, '2026-01-01', 100, 'shorter-term')))).rejects.toThrow(
      'date 2026-01-01 is before "Car loan" was drawn on 2026-01-05',
    )

    await store.write('Added', (unit) => unit.of(EXTRA_PAYMENT_WRITES).add(extraPayment(LOAN, '2026-07-05', 300, 'lower-instalment')))
    expect(bankBook(store)).toMatchObject({ extraPayments: [{ amount: euros(300) }], lateInstalments: [{ due: '2026-11-05', paid: '2026-11-12' }] })
  })

  it('deletes a bank loan with every record that names it in one write, which one Undo puts back', async () => {
    const store = await storeWithLoans()
    await store.write('Added', (unit) => {
      unit.of(RATE_PERIOD_WRITES).add(ratePeriod(LOAN, '2026-08-05', '6'))
      unit.of(EXTRA_PAYMENT_WRITES).add(extraPayment(LOAN, '2026-07-05', 300, 'lower-instalment'))
      unit.of(LATE_INSTALMENT_WRITES).add(lateInstalment(LOAN, '2026-03-05', '2026-03-23'))
    })
    const before = bankBook(store)

    await expect(store.write('Deleted', (unit) => unit.of(BANK_LOAN_WRITES).remove(LOAN))).rejects.toThrow('The rate period "12%, from 2026-02-05" would then be left out: names no bank loan in the file.')

    const receipt = await store.write('Deleted', (unit) => removeBankLoan(unit, store.state.records!, LOAN))
    expect(recordsChangeInWords(receipt!, null)).toBe('Deleted the bank loan "Car loan", deleted 2 rate periods, deleted the extra payment "2026-07-05, 300" and deleted the late instalment "due 2026-03-05, paid 2026-03-23"')
    expect(store.state.workbook!.bankLoans).toEqual([])
    expect(store.state.workbook!.problems).toEqual([])
    expect(store.state.workbook!.informalLoans).toHaveLength(1)

    await store.undo(store.state.writes[0]!)
    expect(bankBook(store)).toEqual(before)
  })

  it('keeps an informal loan with its movements, borrowing back included, and deletes them together', async () => {
    const store = await storeWithLoans()
    const movements = [movement(FRIEND, '2026-04-01', 'repaid', 3000), movement(FRIEND, '2026-04-20', 'borrowed', 250)]

    await store.write('Added', (unit) => movements.forEach((step) => unit.of(MOVEMENT_WRITES).add(step)))
    const book = store.state.workbook!.informalLoans[0]!
    expect(informalBalanceOn(book.loan, book.movements, civil('2026-04-30'))).toBe(euros(250))

    await expect(store.write('Added', (unit) => unit.of(MOVEMENT_WRITES).add(movement(FRIEND, '2026-02-01', 'borrowed', 10)))).rejects.toThrow(
      'date 2026-02-01 is before "From Ana" starts on 2026-03-01',
    )
    await expect(store.write('Changed', (unit) => unit.of(INFORMAL_LOAN_WRITES).change(FRIEND, { ...FRIEND, start: civil('2026-04-10') }))).rejects.toThrow(
      'The movement "2026-04-01, repaid, 3000" would then be left out: date 2026-04-01 is before "From Ana" starts on 2026-04-10.',
    )
    await expect(store.write('Deleted', (unit) => unit.of(INFORMAL_LOAN_WRITES).remove(FRIEND))).rejects.toThrow('names no informal loan in the file')

    await store.write('Deleted', (unit) => removeInformalLoan(unit, store.state.records!, FRIEND))
    expect(store.state.workbook!.informalLoans).toEqual([])
    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.informalLoans[0]!.movements).toHaveLength(2)
  })
})
