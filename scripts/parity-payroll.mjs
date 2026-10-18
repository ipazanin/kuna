/**
 * Compares the payroll engine with the accountant's monthly salary workbooks, line by line to the
 * cent. Each workbook is the xlsx the accountant mails for a month, in `<folder>/YYYY/YYYY-MM/YYYY-MM-salary.xlsx`.
 * A Google Sheet stub converted from one cannot be read, so such a month is reported as unreadable.
 *
 *   npm run parity:payroll -- [--payroll <folder>] [--months 2025-06,2026-01,2026-06] [--worked 2025-06=18] [--dependants 0]
 *
 * The city comes from the tax line's note, membership of pillar II from the pillar II line, the
 * worked month and the payment date from the title. A salary noted as the director's minimum base
 * is run as an agreed gross below the floor, so the engine picks the floor itself. `--worked` gives
 * the days worked in a part month, against Monday to Friday of that month. The rows under
 * "Neoporezive isplate" are the payments beside the salary. Rent and refunds of costs are not
 * payroll, so they are added only to the two lines that include them.
 *
 * The workbooks hold real pay, so this prints only pass or fail per line and never a figure. Never
 * copy a figure from a workbook into the repository.
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import * as XLSX from 'xlsx'

import { payrollMonth } from '../src/packs/hr-doo/domain/payroll/payrollMonth.ts'
import { localRates } from '../src/packs/hr-doo/domain/payroll/incomeTax.ts'
import { ruleValue } from '../src/packs/hr-doo/ruleset/ruleset.ts'
import { civilDate } from '../src/shared/calendar/civilDate.ts'
import { lastDayOf, monthKey, parseMonthKey } from '../src/shared/calendar/monthKey.ts'
import { ZERO, addMoney, moneyFromAmount, sumMoney } from '../src/shared/money/money.ts'

const { values: options } = parseArgs({
  options: {
    payroll: { type: 'string', default: join(homedir(), 'gdrive/work/dss/dss-finance/payroll') },
    months: { type: 'string', default: '2025-06,2026-01,2026-06' },
    worked: { type: 'string', multiple: true, default: [] },
    dependants: { type: 'string', default: '0' },
  },
})

const daysWorkedByMonth = new Map(
  options.worked.map((entry) => {
    const match = /^(\d{4}-\d{2})=(\d+)$/.exec(entry)
    if (match === null) {
      console.error(`--worked takes YYYY-MM=<days>, not ${entry}.`)
      process.exit(2)
    }
    return [match[1], Number(match[2])]
  }),
)

/** Payments beside the salary, by the workbook's label, as the ruleset names them. */
const NONTAXABLE_PAYMENTS = new Map([
  ['Naknada za prijevoz', 'commuting-ticket'],
  ['Prehrana', 'meal-allowance-flat'],
  ['Prigodne nagrade', 'occasional-gift'],
  ['Nagrade za radne rezultate', 'results-bonus'],
  ['Putni nalog', 'business-travel-cost'],
  ['Putni nalozi', 'business-travel-cost'],
])
const OUTSIDE_PAYROLL = new Set(['Zakup poslovnog prostora', 'Refundacija troškova'])
const STATE_LINE = '- Država'

/** Monday to Friday, public holidays included, which is how the monthly fund of hours counts working days. */
function weekdaysIn(month) {
  const lastDay = Number(lastDayOf(month).slice(8, 10))
  const [year, monthNumber] = month.split('-').map(Number)
  return Array.from({ length: lastDay }, (_, index) => new Date(Date.UTC(year, monthNumber - 1, index + 1)).getUTCDay()).filter(
    (weekday) => weekday !== 0 && weekday !== 6,
  ).length
}

function readSalaryWorkbook(path) {
  const book = XLSX.read(readFileSync(path), { type: 'buffer' })
  const sheet = book.Sheets[book.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: false, defval: null })
  const title = String(rows[0]?.[0] ?? '')
  const titleMatch = /Plaća (\d{1,2})\/(\d{2}) - datum isplate (\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(title)
  if (titleMatch === null) {
    throw new Error('the title does not name the month and the payment date')
  }
  const lines = new Map()
  const besideSalary = []
  let underNontaxable = false
  for (const [label, amount, note] of rows.slice(2)) {
    const name = String(label ?? '').trim()
    if (name === 'Neoporezive isplate') {
      underNontaxable = true
      continue
    }
    if (name === 'Ukupni trošak') {
      underNontaxable = false
    }
    if (underNontaxable) {
      besideSalary.push({ label: name, amount: moneyFromAmount(Number(amount)) })
    } else if (name !== '') {
      lines.set(name, { amount: typeof amount === 'number' ? moneyFromAmount(amount) : null, note: note === null ? '' : String(note) })
    }
  }
  return {
    workedMonth: monthKey(2000 + Number(titleMatch[2]), Number(titleMatch[1])),
    paidOn: civilDate(Number(titleMatch[5]), Number(titleMatch[4]), Number(titleMatch[3])),
    lines,
    besideSalary,
  }
}

let failures = 0
const unreadable = []

/** Prints one line as pass, FAIL, or corrected with the reason, and counts the failures. */
function report(month, line, verdict, reason = '') {
  if (verdict === 'fail') {
    failures += 1
  }
  const word = { pass: 'pass', fail: 'FAIL', corrected: 'corrected' }[verdict]
  console.log(`${month}  ${word}  ${line}${reason === '' ? '' : `: ${reason}`}`)
}

function verdictOf(holds) {
  return holds ? 'pass' : 'fail'
}

for (const requested of options.months.split(',').map((text) => text.trim())) {
  const month = parseMonthKey(requested)
  if (month === null) {
    console.error(`${requested} is not a month.`)
    process.exit(2)
  }
  const folder = join(options.payroll, month.slice(0, 4), month)
  const path = join(folder, `${month}-salary.xlsx`)
  if (!existsSync(path)) {
    const stub = existsSync(join(folder, `${month}-salary.gsheet`))
    unreadable.push(`${month} (${stub ? 'a Google Sheet stub, which cannot be read' : 'no salary workbook'})`)
    continue
  }
  let workbook
  try {
    workbook = readSalaryWorkbook(path)
  } catch (error) {
    report(month, `the workbook reads: ${error.message}`, 'fail')
    continue
  }
  const { lines, besideSalary } = workbook
  const sheetAmount = (label) => lines.get(label)?.amount ?? null
  // The employee's share of the total is labelled with the employee's name, so it is found as the other share.
  const ownerLine = [...lines.keys()].find((label) => label.startsWith('- ') && label !== STATE_LINE) ?? null
  const taxNote = /Grad (.+?) - ([\d,]+)%/.exec(lines.get('Porez na dohodak')?.note ?? '')
  const grossLine = lines.get('Bruto plaća I')
  if (taxNote === null || grossLine === undefined || grossLine.amount === null || ownerLine === null) {
    report(month, 'the workbook names the city, the gross and the two shares of the total', 'fail')
    continue
  }
  const partMonth = grossLine.note.includes('puni mjesec')
  if (partMonth && !daysWorkedByMonth.has(month)) {
    report(month, `the days worked in this part month, given as --worked ${month}=<days>`, 'fail')
    continue
  }
  const unknownRows = besideSalary.filter((row) => !NONTAXABLE_PAYMENTS.has(row.label) && !OUTSIDE_PAYROLL.has(row.label))
  report(month, 'every payment beside the salary is a known kind', verdictOf(unknownRows.length === 0))

  const workingDaysInMonth = weekdaysIn(workbook.workedMonth)
  const facts = {
    residenceCity: taxNote[1],
    pensionPillarTwo: (sheetAmount('Mirovinsko (II. stup)') ?? ZERO) !== ZERO,
    dependants: Number(options.dependants),
    birthYear: null,
  }
  const nontaxablePayments = besideSalary
    .filter((row) => NONTAXABLE_PAYMENTS.has(row.label))
    .map((row) => ({ payment: NONTAXABLE_PAYMENTS.get(row.label), amount: row.amount }))
  const payroll = payrollMonth(
    {
      workedMonth: workbook.workedMonth,
      paidOn: workbook.paidOn,
      agreedMonthlyGross: grossLine.note.includes('Minimalna osnovica za direktora') ? ZERO : grossLine.amount,
      daysWorked: daysWorkedByMonth.get(month) ?? workingDaysInMonth,
      workingDaysInMonth,
      nontaxablePayments,
      basis: 'accountant',
    },
    facts,
    ruleValue,
  )
  const outsidePayroll = sumMoney(besideSalary.filter((row) => OUTSIDE_PAYROLL.has(row.label)).map((row) => row.amount))

  const comparisons = [
    ['Bruto plaća II', payroll.employerCost.amount],
    ['Zdravstveno osiguranje', payroll.health.amount],
    ['Bruto plaća I', payroll.gross.amount],
    ['Mirovinsko (I. stup)', payroll.pensionPillarOne.amount],
    ['Mirovinsko (II. stup)', payroll.pensionPillarTwo.amount],
    ['Dohodak', payroll.income.amount],
    ['Osobni odbitak', payroll.personalAllowance.amount],
    ['Oporezivi dio dohotka', payroll.taxableIncome.amount],
    ['Porez na dohodak', payroll.incomeTax.amount],
    ['Neto plaća', payroll.net.amount],
    [STATE_LINE, payroll.stateTake.amount],
  ]
  for (const [label, engineAmount] of comparisons) {
    report(month, label, verdictOf(sheetAmount(label) === engineAmount))
  }
  report(month, 'paid to the employee', verdictOf(sheetAmount(ownerLine) === addMoney(payroll.paidToEmployee.amount, outsidePayroll)))

  const engineTotal = addMoney(payroll.totalCompanyCost.amount, outsidePayroll)
  const sheetTotal = sheetAmount('Ukupni trošak')
  const sheetShares = addMoney(sheetAmount(STATE_LINE) ?? ZERO, sheetAmount(ownerLine) ?? ZERO)
  const totalWithoutHealth = addMoney(addMoney(payroll.gross.amount, payroll.nontaxablePayments.amount), outsidePayroll)
  if (sheetTotal === engineTotal) {
    report(month, 'Ukupni trošak', 'pass')
  } else if (sheetShares === engineTotal && sheetTotal === totalWithoutHealth) {
    report(month, 'Ukupni trošak', 'corrected', 'the workbook adds gross I instead of gross II, and its own two shares add up to the engine\'s total')
  } else {
    report(month, 'Ukupni trošak', 'fail')
  }

  const statedRate = Math.round(Number(taxNote[2].replace(',', '.')) * 100)
  report(month, 'the lower rate in the tax note', verdictOf(localRates(facts.residenceCity, workbook.paidOn, ruleValue).lowerRate === statedRate))
}

if (unreadable.length > 0) {
  console.log(`Not read: ${unreadable.join(', ')}.`)
}
console.log(failures === 0 ? 'Every line matches or is a stated correction.' : `${failures} line(s) fail.`)
process.exit(failures === 0 ? 0 : 1)
