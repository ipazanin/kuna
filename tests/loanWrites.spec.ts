import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { BANK_LOAN_WRITES, EXTRA_PAYMENT_WRITES, LATE_INSTALMENT_WRITES, RATE_PERIOD_WRITES, removeBankLoan } from '../src/apps/loans/bankLoans/application/bankLoanWrites'
import { INFORMAL_LOAN_WRITES, MOVEMENT_WRITES, removeInformalLoan } from '../src/apps/loans/informalLoans/application/informalLoanWrites'
import { LOAN_SCENARIO_WRITES, SCENARIO_CHANGE_WRITES, copyScenario, newLoanScenario, removeScenario, saveScenario } from '../src/apps/loans/scenarios/application/scenarioWrites'
import { NO_COSTS } from '../src/apps/loans/scenarios/domain/loanScenario'
import type { LoanChange, LoanScenario } from '../src/apps/loans/scenarios/domain/loanScenario'
import { informalBalanceOn } from '../src/apps/loans/informalLoans/domain/informalBalance'
import { LATE_INSTALMENT_RECORDS, SCENARIO_CHANGE_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import type { LoansBooks } from '../src/apps/loans/workbook/domain/loansBooks'
import { emptyLoansDocument } from '../src/apps/loans/workbook/infrastructure/loansDocument'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { recordsChangeInWords } from '../src/shared/storage/presentation/recordsChangeInWords'
import { civil, euros } from './fixtures/ledger'
import { LOAN_UUID, bankLoan, extraPayment, informalLoan, lateInstalment, movement, percent, ratePeriod } from './fixtures/loans'
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

const PAY_EXTRA = newLoanScenario({ name: ' Pay extra ', start: { kind: 'loan', loan: LOAN.id } })
const OFFER = newLoanScenario({
  name: 'Other Bank offer',
  start: {
    kind: 'offer',
    terms: {
      lender: 'Other Bank',
      principal: euros(1000),
      drawdown: civil('2026-03-01'),
      firstInstalment: civil('2026-04-01'),
      instalments: 10,
      interimInterest: null,
      subsidy: null,
      costs: NO_COSTS,
      bankEks: null,
    },
  },
})
const EXTRA: LoanChange = { kind: 'extra-payment', date: civil('2026-07-05'), amount: euros(300), effect: 'shorter-term' }
const MOVE: LoanChange = { kind: 'move', on: civil('2026-06-05'), lender: 'Other Bank', rate: percent('8'), rateType: 'fixed', instalments: 6, costs: NO_COSTS }

function scenarioNamed(store: WorkbookStore<LoansBooks>, name: string) {
  return store.state.workbook!.scenarios.find((book) => book.scenario.name === name)!
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

    await expect(store.write('Deleted', (unit) => unit.of(BANK_LOAN_WRITES).remove(LOAN))).rejects.toThrow(
      'The rate period "12%, from 2026-02-05" would then be left out: names no bank loan in the file.',
    )

    const receipt = await store.write('Deleted', (unit) => removeBankLoan(unit, store.state.records!, LOAN))
    expect(recordsChangeInWords(receipt!, null)).toBe(
      'Deleted the bank loan "Car loan", deleted 2 rate periods, deleted the extra payment "2026-07-05, 300" and deleted the late instalment "due 2026-03-05, paid 2026-03-23"',
    )
    expect(store.state.workbook!.bankLoans).toEqual([])
    expect(store.state.workbook!.problems).toEqual([])
    expect(store.state.workbook!.informalLoans).toHaveLength(1)

    await store.undo(store.state.writes[0]!)
    expect(bankBook(store)).toEqual(before)
  })

  it('saves a scenario with its changes in one write, replaces its changes on the next save, and one Undo puts them back', async () => {
    const store = await storeWithLoans()

    await store.write('Saved', (unit) => saveScenario(unit, store.state.records!, PAY_EXTRA, [EXTRA, MOVE], null))
    const saved = scenarioNamed(store, 'Pay extra')
    expect(saved.changes.map((change) => change.kind)).toEqual(['extra-payment', 'move'])
    expect(store.state.workbook!.bankLoans).toHaveLength(1)

    const renamed: LoanScenario = { ...saved.scenario, name: 'Pay extra in July' }
    await store.write('Saved', (unit) => saveScenario(unit, store.state.records!, renamed, [{ ...EXTRA, amount: euros(400) }], saved.scenario))
    expect(scenarioNamed(store, 'Pay extra in July').changes).toMatchObject([{ kind: 'extra-payment', amount: euros(400) }])
    expect(store.state.workbook!.scenarios).toHaveLength(1)

    await store.undo(store.state.writes[0]!)
    expect(scenarioNamed(store, 'Pay extra')).toEqual(saved)
  })

  it('refuses a second move in a scenario, and a scenario deleted without its changes', async () => {
    const store = await storeWithLoans()
    await store.write('Saved', (unit) => saveScenario(unit, store.state.records!, PAY_EXTRA, [MOVE], null))
    const { scenario } = scenarioNamed(store, 'Pay extra')

    await expect(
      store.write('Added', (unit) => unit.of(SCENARIO_CHANGE_WRITES).add({ ...MOVE, on: civil('2026-08-05'), id: recordIdOf(SCENARIO_CHANGE_RECORDS, 'second-move'), scenario: scenario.id })),
    ).rejects.toThrow('another change of "Pay extra" is a move too, and a scenario moves once')
    await expect(store.write('Deleted', (unit) => unit.of(LOAN_SCENARIO_WRITES).remove(scenario))).rejects.toThrow('names no scenario in the file')

    await store.write('Deleted', (unit) => removeScenario(unit, store.state.records!, scenario))
    expect(store.state.workbook!.scenarios).toEqual([])
    expect(store.state.workbook!.readings.scenarioChanges).toEqual({ facts: [], problems: [] })
  })

  it('copies a scenario under a new name with copies of its changes', async () => {
    const store = await storeWithLoans()
    await store.write('Saved', (unit) => saveScenario(unit, store.state.records!, PAY_EXTRA, [EXTRA, MOVE], null))
    const original = scenarioNamed(store, 'Pay extra')

    await store.write('Copied', (unit) => copyScenario(unit, original, 'Pay extra, copy'))
    const copy = scenarioNamed(store, 'Pay extra, copy')

    expect(copy.scenario.id).not.toBe(original.scenario.id)
    expect(copy.scenario.start).toEqual(original.scenario.start)
    expect(copy.changes.map(({ id: _id, scenario: _scenario, ...change }) => change)).toEqual(original.changes.map(({ id: _id, scenario: _scenario, ...change }) => change))
    expect(copy.changes.every((change) => !original.changes.some((kept) => kept.id === change.id))).toBe(true)
  })

  it('deletes a bank loan with its scenarios and their changes, keeping the offers, and one Undo puts them back', async () => {
    const store = await storeWithLoans()
    await store.write('Saved', (unit) => {
      saveScenario(unit, store.state.records!, PAY_EXTRA, [EXTRA], null)
      saveScenario(unit, store.state.records!, OFFER, [{ kind: 'rate-change', from: civil('2026-04-01'), rate: percent('9'), rateType: 'fixed' }], null)
    })
    const before = store.state.workbook!.scenarios

    await expect(store.write('Deleted', (unit) => removeBankLoan(unit, { ...store.state.records!, loanScenarios: { ...store.state.records!.loanScenarios, records: [] } }, LOAN))).rejects.toThrow(
      'names no bank loan in the file',
    )
    await store.write('Deleted', (unit) => removeBankLoan(unit, store.state.records!, LOAN))
    expect(store.state.workbook!.scenarios.map((book) => book.scenario.name)).toEqual(['Other Bank offer'])
    expect(store.state.workbook!.problems).toEqual([])

    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.scenarios).toHaveLength(2)
    expect(store.state.workbook!.scenarios).toEqual(expect.arrayContaining([...before]))
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
