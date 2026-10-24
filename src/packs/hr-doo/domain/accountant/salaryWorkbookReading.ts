import { civilDate } from '../../../../shared/calendar/civilDate'
import { monthKey } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { basisPoints } from '../../ruleset/schema'
import { amountCell, labelText, gridRow, isBlankRow, readingOf, refuse } from './accountantDocument'
import type { DocumentReading, DocumentTab } from './accountantDocument'
import type { PaymentBesideSalary, SalaryWorkbook } from './salaryWorkbook'

/** The one tab, named after the employee as `Obračun plaće_<name>`. */
const SALARY_TAB = 'Obračun plaće'
const HEADER = 'Stavka'
const TITLE = /^Plaća (\d{1,2})\/(\d{2}) - datum isplate (\d{1,2})\.(\d{1,2})\.(\d{4})$/
const TAX_NOTE = /Grad (.+?) - (\d+(?:,\d+)?)%/
const BESIDE_SALARY = 'Neoporezive isplate'
const STATE_SHARE = '- Država'

type SalaryLine = 'employerCost' | 'health' | 'gross' | 'pensionPillarOne' | 'pensionPillarTwo' | 'income' | 'personalAllowance' | 'taxableIncome' | 'incomeTax' | 'net' | 'totalCompanyCost' | 'stateTake'

const SALARY_LINES: Readonly<Record<string, SalaryLine>> = {
  'Bruto plaća II': 'employerCost',
  'Zdravstveno osiguranje': 'health',
  'Bruto plaća I': 'gross',
  'Mirovinsko (I. stup)': 'pensionPillarOne',
  'Mirovinsko (II. stup)': 'pensionPillarTwo',
  Dohodak: 'income',
  'Osobni odbitak': 'personalAllowance',
  'Oporezivi dio dohotka': 'taxableIncome',
  'Porez na dohodak': 'incomeTax',
  'Neto plaća': 'net',
  'Ukupni trošak': 'totalCompanyCost',
  [STATE_SHARE]: 'stateTake',
}

/** Tax-free payments by the workbook's label, as the ruleset names them. */
const NONTAXABLE_PAYMENTS: Readonly<Record<string, string>> = {
  'Naknada za prijevoz': 'commuting-ticket',
  Prehrana: 'meal-allowance-flat',
  'Prigodne nagrade': 'occasional-gift',
  'Nagrade za radne rezultate': 'results-bonus',
  'Putni nalog': 'business-travel-cost',
  'Putni nalozi': 'business-travel-cost',
}
const RENT = 'Zakup poslovnog prostora'
const COST_REFUND = 'Refundacija troškova'

interface SalaryEntry {
  readonly amount: Money
  readonly note: string
}

/**
 * A salary workbook from its tab, read by the labels in column A with amounts in B and notes in C.
 * The title names the worked month, which must be the file's, and the payout date. The rows under
 * `Neoporezive isplate` up to `Ukupni trošak` are the payments beside the salary. The employee's
 * share of the total is the `- ` line other than the state's, since it carries the employee's name.
 */
export function readSalaryWorkbook(period: MonthKey, tabs: readonly DocumentTab[]): DocumentReading<SalaryWorkbook> {
  return readingOf(() => salaryWorkbookOf(period, tabs))
}

function salaryWorkbookOf(period: MonthKey, tabs: readonly DocumentTab[]): SalaryWorkbook {
  const unknown = tabs.find((tab) => !labelText(tab.name).startsWith(SALARY_TAB))
  if (unknown !== undefined) refuse(labelText(unknown.name), null, 'a tab this reader does not know')
  const [tab, second] = tabs
  if (tab === undefined) return refuse(null, null, `no ${SALARY_TAB} tab`)
  if (second !== undefined) refuse(labelText(second.name), null, `a second ${SALARY_TAB} tab`)
  const name = labelText(tab.name)

  const title = TITLE.exec(labelText(gridRow(tab.grid, 0)[0]))
  if (title === null) return refuse(name, 1, 'the title names no worked month and payout date')
  const workedMonth = monthKey(2000 + Number(title[2]), Number(title[1]))
  if (workedMonth !== period) refuse(name, 1, `the title names ${workedMonth}, the file ${period}`)
  const paidOn = civilDate(Number(title[5]), Number(title[4]), Number(title[3]))
  if (labelText(gridRow(tab.grid, 1)[0]) !== HEADER) refuse(name, 2, `the header is not ${HEADER}`)

  const lines = new Map<SalaryLine, SalaryEntry>()
  const besideSalary: PaymentBesideSalary[] = []
  let paidToEmployee: Money | null = null
  let underBesideSalary = false
  for (let rowIndex = 2; rowIndex < tab.grid.length; rowIndex += 1) {
    const cells = gridRow(tab.grid, rowIndex)
    if (isBlankRow(cells)) continue
    const label = labelText(cells[0])
    if (label === '') refuse(name, rowIndex + 1, 'an amount without a label')
    if (label === BESIDE_SALARY) {
      underBesideSalary = true
      continue
    }
    const line = SALARY_LINES[label]
    if (line === 'totalCompanyCost') underBesideSalary = false
    if (underBesideSalary) {
      besideSalary.push(paymentOf(label, amountCell(name, rowIndex, cells[1], label)))
      continue
    }
    if (line === undefined && label.startsWith('- ')) {
      if (paidToEmployee !== null) refuse(name, rowIndex + 1, 'a third share of the total')
      paidToEmployee = amountCell(name, rowIndex, cells[1], 'the employee\'s share')
      continue
    }
    if (line === undefined) return refuse(name, rowIndex + 1, `${label} is not a line of a salary workbook`)
    if (lines.has(line)) refuse(name, rowIndex + 1, `${label} is in the workbook twice`)
    // Pillar II is blank for an employee who is not a member.
    const amount = amountCell(name, rowIndex, cells[1], label, line === 'pensionPillarTwo' ? ZERO : undefined)
    lines.set(line, { amount, note: labelText(cells[2]) })
  }

  const required = (line: SalaryLine): SalaryEntry => {
    const found = lines.get(line)
    if (found !== undefined) return found
    const label = Object.entries(SALARY_LINES).find(([, candidate]) => candidate === line)?.[0] ?? line
    return refuse(name, null, `no ${label} line`)
  }
  if (paidToEmployee === null) return refuse(name, null, 'no share of the total for the employee')
  const gross = required('gross')
  const incomeTax = required('incomeTax')
  const taxNote = TAX_NOTE.exec(incomeTax.note)
  if (taxNote === null) return refuse(name, null, 'the note on Porez na dohodak names no city and rate')

  return {
    workedMonth,
    paidOn,
    employerCost: required('employerCost').amount,
    health: required('health').amount,
    gross: gross.amount,
    pensionPillarOne: required('pensionPillarOne').amount,
    pensionPillarTwo: required('pensionPillarTwo').amount,
    income: required('income').amount,
    personalAllowance: required('personalAllowance').amount,
    taxableIncome: required('taxableIncome').amount,
    incomeTax: incomeTax.amount,
    net: required('net').amount,
    besideSalary,
    totalCompanyCost: required('totalCompanyCost').amount,
    stateTake: required('stateTake').amount,
    paidToEmployee,
    residenceCity: taxNote[1] ?? '',
    statedLowerRate: basisPoints(Math.round(Number((taxNote[2] ?? '').replace(',', '.')) * 100)).basisPoints,
    directorMinimum: gross.note.includes('Minimalna osnovica za direktora'),
    partMonth: gross.note.includes('puni mjesec'),
  }
}

function paymentOf(label: string, amount: Money): PaymentBesideSalary {
  const payment = NONTAXABLE_PAYMENTS[label]
  if (payment !== undefined) return { kind: 'nontaxable', label, amount, payment }
  return { kind: label === RENT ? 'rent' : label === COST_REFUND ? 'cost-refund' : 'unknown', label, amount }
}
