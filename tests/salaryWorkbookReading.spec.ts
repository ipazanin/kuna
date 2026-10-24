import { describe, expect, it } from 'vitest'

import type { DocumentTab } from '../src/packs/hr-doo/domain/accountant/accountantDocument'
import { outsidePayroll } from '../src/packs/hr-doo/domain/accountant/salaryWorkbook'
import { readSalaryWorkbook } from '../src/packs/hr-doo/domain/accountant/salaryWorkbookReading'
import { localRates } from '../src/packs/hr-doo/domain/payroll/incomeTax'
import { ruleValue } from '../src/packs/hr-doo/ruleset/ruleset'
import { month, salaryTabs, withCell } from './fixtures/accountantWorkbooks'
import type { SalarySpec } from './fixtures/accountantWorkbooks'
import { civil, euros } from './fixtures/ledger'

const TAB = 'Obračun plaće_Ana Primjer'

/** The 2026 layout: commuting and meals beside the salary, rent on its own payment order. */
const MARCH_2026: SalarySpec = {
  worked: '2026-03',
  paid: '2026-04-10',
  agreed: 1500,
  nontaxable: [
    { label: 'Naknada za prijevoz', amount: 40, payment: 'commuting-ticket' },
    { label: 'Prehrana', amount: 100, payment: 'meal-allowance-flat' },
  ],
}

/** The 2025-06 layout: a part month at the director's minimum, rent and a cost refund beside the salary, and a range down to row 1000. */
const JUNE_2025: SalarySpec = {
  worked: '2025-06',
  paid: '2025-07-10',
  agreed: 'director-minimum',
  daysWorked: 12,
  nontaxable: [
    { label: 'Naknada za prijevoz', amount: 20, payment: 'commuting-ticket' },
    { label: 'Prigodne nagrade', amount: 50, payment: 'occasional-gift' },
    { label: 'Nagrade za radne rezultate', amount: 60, payment: 'results-bonus' },
    { label: 'Putni nalozi', amount: 30, payment: 'business-travel-cost' },
  ],
  outside: [
    { label: 'Zakup poslovnog prostora', amount: 300 },
    { label: 'Refundacija troškova', amount: 25.5 },
  ],
  blankRowsBelow: 977,
}

function read(tabs: readonly DocumentTab[], period = '2026-03') {
  return readSalaryWorkbook(month(period), tabs)
}

function salaryOf(spec: SalarySpec) {
  const reading = read(salaryTabs(spec), spec.worked)
  if ('refusal' in reading) throw new Error(`refused: ${reading.refusal.reason}`)
  return reading.document
}

function refusalOf(tabs: readonly DocumentTab[]) {
  const reading = read(tabs)
  if (!('refusal' in reading)) throw new Error('the workbook was read')
  return reading.refusal
}

describe('readSalaryWorkbook', () => {
  it('reads the 2026 layout, its title, its notes and the payments beside the salary', () => {
    const salary = salaryOf(MARCH_2026)
    expect(salary.workedMonth).toBe(month('2026-03'))
    expect(salary.paidOn).toBe(civil('2026-04-10'))
    expect(salary.gross).toBe(euros(1500))
    expect(salary.besideSalary).toEqual([
      { kind: 'nontaxable', label: 'Naknada za prijevoz', amount: euros(40), payment: 'commuting-ticket' },
      { kind: 'nontaxable', label: 'Prehrana', amount: euros(100), payment: 'meal-allowance-flat' },
    ])
    expect(salary.residenceCity).toBe('Zagreb')
    expect(salary.statedLowerRate).toBe(localRates('Zagreb', civil('2026-04-10'), ruleValue).lowerRate)
    expect([salary.partMonth, salary.directorMinimum]).toEqual([false, false])
    expect(outsidePayroll(salary)).toBe(euros(0))
  })

  it('reads the 2025-06 layout with a part month, rent, a refund and blank rows down to row 1000', () => {
    const tabs = salaryTabs(JUNE_2025)
    expect(tabs[0]!.grid).toHaveLength(1000)
    const salary = salaryOf(JUNE_2025)
    expect([salary.partMonth, salary.directorMinimum]).toEqual([true, true])
    expect(salary.besideSalary.map((payment) => payment.kind)).toEqual(['nontaxable', 'nontaxable', 'nontaxable', 'nontaxable', 'rent', 'cost-refund'])
    expect(outsidePayroll(salary)).toBe(euros(325.5))
  })

  it('keeps a payment beside the salary it does not know, for the rules check to fail on', () => {
    // Row 15 is the first row under Neoporezive isplate, the meal allowance.
    const salary = read(withCell(salaryTabs(MARCH_2026), TAB, 15, 1, 'Dar za dijete'))
    expect('document' in salary && salary.document.besideSalary[1]).toEqual({ kind: 'unknown', label: 'Dar za dijete', amount: euros(100) })
  })

  it('refuses a title that names another month than the file', () => {
    expect(read(salaryTabs(MARCH_2026), '2026-04')).toEqual({ refusal: { tab: TAB, row: 1, reason: 'the title names 2026-03, the file 2026-04' } })
  })

  it('refuses a workbook without one of its lines', () => {
    const [tab] = salaryTabs(MARCH_2026)
    const without = { ...tab!, grid: tab!.grid.filter((row) => row[0] !== 'Oporezivi dio dohotka') }
    expect(refusalOf([without])).toEqual({ tab: TAB, row: null, reason: 'no Oporezivi dio dohotka line' })
  })

  it('refuses a line it does not know outside the payments beside the salary', () => {
    expect(refusalOf(withCell(salaryTabs(MARCH_2026), TAB, 8, 1, 'Dohodak prije odbitka'))).toEqual({ tab: TAB, row: 8, reason: 'Dohodak prije odbitka is not a line of a salary workbook' })
  })

  it('refuses a tax note without the city and its rate', () => {
    expect(refusalOf(withCell(salaryTabs(MARCH_2026), TAB, 11, 3, 'Porez'))).toEqual({ tab: TAB, row: null, reason: 'the note on Porez na dohodak names no city and rate' })
  })

  it('refuses an amount that is not a number', () => {
    expect(refusalOf(withCell(salaryTabs(MARCH_2026), TAB, 12, 2, 'n/a'))).toEqual({ tab: TAB, row: 12, reason: 'Neto plaća is not a number' })
  })

  it('refuses a tab it does not know', () => {
    expect(refusalOf([...salaryTabs(MARCH_2026), { name: 'Bilješke', grid: [] }])).toEqual({ tab: 'Bilješke', row: null, reason: 'a tab this reader does not know' })
  })
})
