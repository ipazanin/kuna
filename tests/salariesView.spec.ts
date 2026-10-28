import { describe, expect, it } from 'vitest'

import { ledgerWindowOf } from '../src/apps/company/workbook/domain/workbook'
import { readDocument } from '../src/apps/company/workbook/infrastructure/documentStorePorts'
import { fakeWorkbookDocument, fakeWorkbookRecords } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { salaryReconciliation } from '../src/apps/company/packs/hr-doo/domain/salaries/salaryReconciliation'
import type { SalaryProblem, SalaryReconciliation } from '../src/apps/company/packs/hr-doo/domain/salaries/salaryReconciliation'
import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import { chosenPayday, PAY_PARTS, paydayYears, peopleRows, salaryMonthView, salaryYearRows } from '../src/apps/company/packs/hr-doo/presentation/salaries/salariesView'
import type { SalaryMonthView } from '../src/apps/company/packs/hr-doo/presentation/salaries/salariesView'
import type { MonthKey } from '../src/shared/calendar/monthKey'
import { sumMoney } from '../src/shared/money/money'
import { formatMoney } from '../src/shared/money/moneyFormat'
import { euros } from './fixtures/ledger'

const linkOf = () => null
const PROBLEMS = { hash: '#salary-problems' }

const SYNCED = '2026-10-16T08:00:00.000Z'

/** A fake variant's books as the fake build opens them on Drive, reconciled. */
function reconciled(variant: 'one-employee' | 'five-employees') {
  const read = readDocument({ id: 'fake', source: 'drive', title: 'Fake workbook', syncedAt: SYNCED }, fakeWorkbookDocument(SYNCED, 'drive', fakeStaffOf(variant)))
  const workbook = hrDooWorkbook(read.workbook)
  const window = ledgerWindowOf(workbook.transactions)
  if (window === null) throw new Error('the fake ledger is empty')
  return { workbook, reconciliation: salaryReconciliation(workbook), partMonth: window.partMonth }
}

function paydayOf(reconciliation: SalaryReconciliation, payday: string) {
  const found = reconciliation.paydays.find((entry) => entry.payday === payday)
  if (found === undefined) throw new Error(`no payday ${payday}`)
  return found
}

function problemKinds(problems: readonly SalaryProblem[]): string[] {
  return problems.map((problem) => `${problem.kind}${'employee' in problem && problem.employee !== null ? ` ${problem.employee.slug}` : ''}${problem.kind === 'line-differs' ? ` ${problem.check.line}` : ''}`)
}

function tile(view: SalaryMonthView, label: string) {
  const found = view.tiles.find((entry) => entry.label === label)
  if (found === undefined) throw new Error(`no tile ${label}`)
  return found
}

function monthOf(reconciliation: SalaryReconciliation, payday: string, partMonth: MonthKey, employee: string | null = null): SalaryMonthView {
  return salaryMonthView(paydayOf(reconciliation, payday), { payday: payday as MonthKey, employee }, partMonth, PROBLEMS, linkOf)
}

describe('the fake staffs', () => {
  it('pay no one in a variant without a staff', () => {
    expect(fakeStaffOf(null)).toBeNull()
    expect(fakeStaffOf('browser')).toBeNull()
  })

  it('leave the main account where the flat salary leaves it, so the statements folder’s sample carries it on', () => {
    const newestMain = (records: ReturnType<typeof fakeWorkbookRecords>) => records['ledger-row']?.find((row) => row.account === 'main')
    const flat = newestMain(fakeWorkbookRecords('drive'))
    for (const variant of ['one-employee', 'five-employees']) {
      const staffed = newestMain(fakeWorkbookRecords('drive', fakeStaffOf(variant)))
      expect([staffed?.date, staffed?.balance, staffed?.statement]).toEqual([flat?.date, flat?.balance, flat?.statement])
    }
  })

  it('read without a problem and pay the owner alone, every payday as the engine works it out', () => {
    const { workbook, reconciliation } = reconciled('one-employee')

    expect(workbook.problems).toEqual([])
    expect(workbook.director?.slug).toBe('alex')
    expect(reconciliation.paydays.map((payday) => payday.payday)).toEqual([
      '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
    ])
    expect(reconciliation.paydays.filter((payday) => payday.problems.length > 0)).toEqual([])
  })

  it('pay five, with a health insurance row 10.00 short on one payday', () => {
    const { workbook, reconciliation } = reconciled('five-employees')

    expect(workbook.problems).toEqual([])
    expect(workbook.employees.map((employee) => employee.slug)).toEqual(['alex', 'mia', 'tomo', 'lea', 'niko'])
    expect(paydayOf(reconciliation, '2026-09').employees).toHaveLength(5)
    const troubled = reconciliation.paydays.filter((payday) => payday.problems.length > 0)
    expect(troubled.map((payday) => [payday.payday, problemKinds(payday.problems)])).toEqual([['2026-09', ['line-differs health']]])
    // The engine works Niko out on the agreed gross of his row from the month he joins, and the bank agrees with it.
    const april = paydayOf(reconciliation, '2026-04')
    expect(april.employees.find((entry) => entry.employee.slug === 'niko')?.engine.kind).toBe('run')
    expect(april.contributions.every((check) => check.agrees && check.app !== null)).toBe(true)
    const health = paydayOf(reconciliation, '2026-09').contributions.find((check) => check.line === 'health')
    expect(health?.bank?.amount).toBe((health?.app?.amount ?? 0) - euros(10))
  })
})

describe('salaryMonthView', () => {
  it('opens on the newest payday that is not the month still running', () => {
    const { reconciliation, partMonth } = reconciled('one-employee')

    expect(chosenPayday(reconciliation, { year: null, payday: null }, partMonth)?.payday).toBe('2026-09')
    expect(chosenPayday(reconciliation, { year: 2025, payday: null }, partMonth)?.payday).toBe('2025-12')
    expect(chosenPayday(reconciliation, { year: null, payday: '2026-03' }, partMonth)?.payday).toBe('2026-03')
    expect(paydayYears(reconciliation)).toEqual([2026, 2025])
  })

  it('splits the director at the 2026 floor into the ring’s five parts, which add up to the cost, with pillar II out of the state’s share', () => {
    const { reconciliation, partMonth } = reconciled('one-employee')
    const view = monthOf(reconciliation, '2026-09', partMonth)

    // Gross II 1,509.20 and the 100.00 meal allowance.
    expect(view.ring.total).toBe(euros(1609.2))
    expect(view.ring.parts.map((part) => [part.key, part.value])).toEqual([
      ['employee', euros(1036.26)],
      ['pensionSavings', euros(64.77)],
      ['pension', euros(193.98)],
      ['incomeTax', euros(100.44)],
      ['health', euros(213.75)],
    ])
    expect(sumMoney(view.ring.parts.map((part) => part.value as never))).toBe(view.ring.total)
    expect(view.ring.parts.map((part) => part.key)).toEqual([...PAY_PARTS])
    // Pillar I 193.98, income tax 100.44 and health 213.75.
    expect(tile(view, 'To the state').value).toBe(formatMoney(euros(508.17)))
    expect(tile(view, 'Pension savings').value).toBe(formatMoney(euros(64.77)))
    expect(tile(view, 'Problems').value).toBe('0')
    expect(view.strip).toMatchObject({ name: 'Alex Example', gross: euros(1295.45), net: euros(936.26), paidOn: '12 Sept 2026' })
    // Of the 11 lines only health, both pension pillars and income tax are stated by the app and the bank alike.
    expect(view.compared).toBe(4)
    expect(view.agreeing).toBe(4)
  })

  it('runs the waterfall from gross II down to the net and up to what was paid', () => {
    const { reconciliation, partMonth } = reconciled('one-employee')
    const { bridge } = monthOf(reconciliation, '2026-09', partMonth)

    expect(bridge.map((bar) => [bar.label, bar.kind, bar.amount])).toEqual([
      ['Gross II', 'total', euros(1509.2)],
      ['Health insurance', 'step', euros(-213.75)],
      ['Gross I', 'total', euros(1295.45)],
      ['Pension, pillar I', 'step', euros(-193.98)],
      ['Pension, pillar II', 'step', euros(-64.77)],
      ['Income tax', 'step', euros(-100.44)],
      ['Net salary', 'total', euros(936.26)],
      ['Beside the salary', 'step', euros(100)],
      ['Paid', 'total', euros(1036.26)],
    ])
  })

  it('states what was paid to the employee as the bank paid it, since the app does not know what was paid beside the salary', () => {
    const { reconciliation, partMonth } = reconciled('one-employee')
    const view = monthOf(reconciliation, '2026-01', partMonth)

    expect(view.problems).toEqual([])
    // December 2025 at that year's floor with the 100.00 meal allowance, as the bank paid it.
    const paid = view.sections[0]?.lines.find((line) => line.key === 'paidToEmployee')
    expect([paid?.app, paid?.bank?.cents, paid?.verdict]).toEqual([null, euros(965.5), null])
    expect(tile(view, 'Paid to the employee').value).toBe(formatMoney(euros(965.5)))
  })

  it('sets everyone’s contributions apart, with a health insurance row 10.00 short a problem of everyone paid', () => {
    const { reconciliation, partMonth } = reconciled('five-employees')
    const everyone = monthOf(reconciliation, '2026-09', partMonth)
    const mia = monthOf(reconciliation, '2026-09', partMonth, 'mia')
    const lea = monthOf(reconciliation, '2026-09', partMonth, 'lea')

    expect(everyone.sections.map((section) => section.key)).toEqual(['alex', 'mia', 'tomo', 'lea', 'niko', 'contributions'])
    expect(tile(everyone, 'To the state').caption).toBe(`Bank ${formatMoney(euros(10))} less`)
    expect(tile(everyone, 'Company cost').caption).toBe(`Bank ${formatMoney(euros(10))} less`)
    expect(everyone.problems.map((problem) => problem.text)).toEqual([expect.stringMatching(/^Health insurance, everyone paid: app .+, bank .+\.$/)])
    expect(everyone.sections.find((section) => section.key === 'contributions')?.lines.find((line) => line.key === 'health')?.verdict).toBe('differs')
    expect(mia.sections.map((section) => section.key)).toEqual(['mia'])
    expect(mia.problems).toEqual([])
    expect(lea.problems).toEqual([])
    expect(mia.strip?.name).toBe('Mia Primjer')
    // Everyone else was paid that day too, so one employee's contributions have no bank figure of their own.
    expect(tile(mia, 'To the state').caption).toBe('Pillar I, income tax and health')
  })
})

describe('salaryYearRows and peopleRows', () => {
  it('give each payday of the year its parts and everyone paid with the total', () => {
    const { reconciliation, partMonth } = reconciled('five-employees')
    const rows = salaryYearRows(reconciliation, 2026, null, partMonth)
    const september = rows.find((row) => row.payday === '2026-09')
    const view = monthOf(reconciliation, '2026-09', partMonth)

    expect(rows.map((row) => row.payday)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
    expect(september?.cost).toBe(view.ring.total)
    expect(PAY_PARTS.map((part) => september?.parts[part])).toEqual(view.ring.parts.map((part) => part.value))
    expect(rows.find((row) => row.payday === '2026-09')?.problems).toBe(1)

    const { people, total } = peopleRows(paydayOf(reconciliation, '2026-09'))
    expect(people.map((person) => [person.slug, person.problems])).toEqual([
      ['alex', 0],
      ['mia', 0],
      ['tomo', 0],
      ['lea', 0],
      ['niko', 0],
    ])
    expect([total.cost, total.problems]).toEqual([view.ring.total, 1])
    expect(people.find((person) => person.slug === 'tomo')?.pensionSavings).toBe(euros(0))
  })
})
