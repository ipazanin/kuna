/**
 * Reads the accountant's VAT returns and salary workbooks with the pack's readers and checks them
 * against an xlsx export of the workbook, as the Taxes cards do. VAT returns are the
 * `YYYY-MM-pdv.xlsx` files of `--vat-returns`, salary workbooks the `YYYY-MM-salary.xlsx` files
 * anywhere under `--payroll`, and `--downloads` adds xlsx downloads of the Google Sheets, named as in
 * Drive. A period held only as a Google Sheet is a stub on disk, so it is listed as not read.
 *
 *   npm run parity:accountant -- --workbook <export.xlsx> [--vat-returns <folder>] [--payroll <folder>] [--downloads <folder>] [--worked 2025-06=18]
 *
 * A part month needs its days worked as `--worked YYYY-MM=<days>` for its rules check. The
 * workbooks and the export hold real figures, so this prints only pass or fail and counts. Never
 * copy a figure from them into the repository.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { presentedWorkbook } from '../src/features/transactions/application/presentedWorkbook.ts'
import { readSnapshot } from '../src/features/workbook/infrastructure/spreadsheetTab.ts'
import { readWorkbookFile } from '../src/features/workbook/infrastructure/workbookFile.ts'
import { accountantFileNameOf, filingsByPeriod, sameReading } from '../src/packs/hr-doo/domain/accountant/accountantFile.ts'
import { salaryMonthChecks } from '../src/packs/hr-doo/domain/accountant/payrollReconciliation.ts'
import { readSalaryWorkbook } from '../src/packs/hr-doo/domain/accountant/salaryWorkbookReading.ts'
import { vatPeriods } from '../src/packs/hr-doo/domain/accountant/vatReconciliation.ts'
import { readVatReturn } from '../src/packs/hr-doo/domain/accountant/vatReturnReading.ts'
import { hrDooWorkbook } from '../src/packs/hr-doo/domain/hrDooPart.ts'
import { monthsFrom } from '../src/shared/calendar/monthKey.ts'
import { gridOf, sheetJs } from '../src/shared/files/sheetJs.ts'
import { installHrDooPack } from './support/installPack.mjs'

const { values: options } = parseArgs({
  options: {
    workbook: { type: 'string' },
    'vat-returns': { type: 'string', default: join(homedir(), 'gdrive/work/dss/dss-finance/vat-returns') },
    payroll: { type: 'string', default: join(homedir(), 'gdrive/work/dss/dss-finance/payroll') },
    downloads: { type: 'string', default: join(homedir(), 'Projects/personal/ledgerboard-exports/accountant') },
    worked: { type: 'string', multiple: true, default: [] },
  },
})
if (options.workbook === undefined) {
  console.error('Usage: npm run parity:accountant -- --workbook <path to export.xlsx> [--vat-returns <folder>] [--payroll <folder>] [--downloads <folder>] [--worked YYYY-MM=<days>]')
  process.exit(2)
}
const daysWorked = new Map(
  options.worked.map((entry) => {
    const match = /^(\d{4}-\d{2})=(\d+)$/.exec(entry)
    if (match === null) {
      console.error(`--worked takes YYYY-MM=<days>, not ${entry}.`)
      process.exit(2)
    }
    return [match[1], Number(match[2])]
  }),
)

installHrDooPack()
const { tabs, missingTabs } = await readWorkbookFile(readFileSync(options.workbook))
const read = readSnapshot({
  meta: { id: 'export', source: 'excel', title: options.workbook, syncedAt: new Date().toISOString(), lastExportedAt: null, unexportedSince: null, missingTabs },
  ...tabs,
}).workbook
const workbook = hrDooWorkbook(presentedWorkbook(read))
const XLSX = await sheetJs()

let failures = 0
function report(period, subject, verdict, detail = '') {
  if (verdict === 'FAIL') {
    failures += 1
  }
  console.log(`${period}  ${verdict.padEnd(9)}  ${subject}${detail === '' ? '' : `: ${detail}`}`)
}

/** Every workbook file under a folder by its name: an xlsx, or the `.gsheet` stub of a Google Sheet. */
function accountantFilesIn(folder) {
  if (!existsSync(folder)) {
    console.log(`No folder ${folder}, so nothing is read from it.`)
    return []
  }
  return readdirSync(folder, { recursive: true, withFileTypes: true }).flatMap((entry) => {
    const format = entry.name.endsWith('.xlsx') ? 'xlsx' : entry.name.endsWith('.gsheet') ? 'google-sheet' : null
    const fileName = entry.isFile() && format !== null ? accountantFileNameOf(entry.name.replace(/\.gsheet$/, '')) : null
    return fileName === null ? [] : [{ ...fileName, name: entry.name, format, path: join(entry.parentPath, entry.name) }]
  })
}

function tabsOf(path) {
  const book = XLSX.read(readFileSync(path), { type: 'buffer', cellText: false })
  return book.SheetNames.map((name) => ({ name, grid: gridOf(XLSX, book.Sheets[name]) }))
}

function readingOf(file) {
  return file.kind === 'vat-return' ? readVatReturn(file.period, tabsOf(file.path)) : readSalaryWorkbook(file.period, tabsOf(file.path))
}

const KIND_WORDS = { 'vat-return': 'VAT return', salary: 'salary workbook' }
const files = [...accountantFilesIn(options['vat-returns']), ...accountantFilesIn(options.payroll), ...accountantFilesIn(options.downloads)]
const documents = { 'vat-return': [], salary: [] }
const counts = { 'vat-return': { files: 0, read: 0 }, salary: { files: 0, read: 0 } }
const sheetsOnly = { 'vat-return': [], salary: [] }
for (const { file, alsoFiled } of filingsByPeriod(files)) {
  if (file.format === 'google-sheet') {
    sheetsOnly[file.kind].push(file.period)
    continue
  }
  counts[file.kind].files += 1
  const reading = readingOf(file)
  if ('refusal' in reading) {
    const { tab, row, reason } = reading.refusal
    report(file.period, `${KIND_WORDS[file.kind]} reads`, 'FAIL', [tab, row === null ? null : `row ${row}`, reason].filter((part) => part !== null).join(', '))
    continue
  }
  counts[file.kind].read += 1
  documents[file.kind].push(reading.document)
  report(file.period, `${KIND_WORDS[file.kind]} reads`, 'pass')
  for (const other of alsoFiled.filter((candidate) => candidate.format === 'xlsx')) {
    report(file.period, `${other.name} reads the same as ${file.name}`, sameReading(reading, readingOf(other)) ? 'pass' : 'FAIL')
  }
}

const verdictOf = (holds) => (holds ? 'pass' : 'FAIL')
const returns = documents['vat-return']
const vatFiled = [...new Set(files.filter((file) => file.kind === 'vat-return').map((file) => file.period))].sort()
const vatMonths =
  vatFiled.length === 0 ? [] : monthsFrom(vatFiled[0], vatFiled.at(-1)).filter((month) => !vatFiled.includes(month) || returns.some((vatReturn) => vatReturn.period === month))
let carries = 0
let salesHeld = 0
const notFiled = []
for (const period of vatPeriods(workbook, returns, vatMonths)) {
  if (period.kind === 'not-filed') {
    notFiled.push(period.period)
    continue
  }
  carries += period.carryHolds ? 1 : 0
  salesHeld += period.salesHold ? 1 : 0
  report(period.period, 'carry', verdictOf(period.carryHolds))
  const problems = period.sales.filter((check) => check.problem !== null).map((check) => check.problem)
  report(period.period, `sales, ${period.sales.length} line(s)`, verdictOf(period.salesHold), problems.join(', '))
}

const RULE_WORDS = { pass: 'pass', fail: 'FAIL', 'total-adds-gross-one': 'corrected' }
let banks = 0
const ruleCounts = { pass: 0, fail: 0, 'total-adds-gross-one': 0 }
const partMonths = []
for (const check of salaryMonthChecks(workbook, documents.salary, daysWorked)) {
  const month = check.salary.workedMonth
  banks += check.stateTake.holds && check.payout.holds ? 1 : 0
  report(month, 'bank, paid to the state in the payout week', verdictOf(check.stateTake.holds))
  report(month, 'bank, paid to the employee in the payout week', verdictOf(check.payout.holds))
  if (check.rules.kind === 'part-month') {
    partMonths.push(month)
    report(month, 'rules', 'not run', `a part month, which needs --worked ${month}=<days>`)
  } else if (check.rules.kind === 'unknown-city') {
    report(month, 'rules', 'FAIL', `the city in the tax note: ${check.rules.problem}`)
  } else {
    for (const line of check.rules.lines) {
      ruleCounts[line.verdict] += 1
      report(month, `rules, ${line.line}`, RULE_WORDS[line.verdict], line.verdict === 'total-adds-gross-one' ? 'the workbook adds gross I instead of gross II, and its own two shares add up to the engine\'s total' : '')
    }
  }
}

const vat = counts['vat-return']
const salary = counts.salary
console.log(`VAT returns: ${vat.read} of ${vat.files} xlsx read, carry ${carries} of ${returns.length}, sales ${salesHeld} of ${returns.length}.`)
console.log(
  `Salary workbooks: ${salary.read} of ${salary.files} xlsx read, bank ${banks} of ${documents.salary.length}, rules ${ruleCounts.pass} lines pass, ${ruleCounts['total-adds-gross-one']} stated correction(s), ${ruleCounts.fail} fail.`,
)
if (partMonths.length > 0) {
  console.log(`Rules not run for the part month ${partMonths.join(', ')}.`)
}
if (notFiled.length > 0) {
  console.log(`No VAT return filed for ${notFiled.join(', ')}.`)
}
for (const kind of ['vat-return', 'salary']) {
  if (sheetsOnly[kind].length > 0) {
    console.log(`Not read, held only as a Google Sheet: ${KIND_WORDS[kind]} ${sheetsOnly[kind].join(', ')}.`)
  }
}
console.log(failures === 0 ? 'Every workbook reads and every check passes or is a stated correction.' : `${failures} check(s) fail.`)
process.exit(failures === 0 ? 0 : 1)
