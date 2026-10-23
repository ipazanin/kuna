/**
 * Runs the accrual engine over an xlsx export of the workbook, a split row through its parts as the
 * screens count it, and compares every line of the year-end tab for one year with ours. The export
 * holds real company figures, so keep it outside the repository. This prints verdicts and
 * differences only, never a figure itself, and nothing from its output belongs in the repository
 * either.
 *
 *   npm run parity:year-end -- --workbook <path to export.xlsx> --year 2025
 *
 * Each line is `pass` when ours equals the accountant's to the cent with no judgement behind it,
 * `judgement` when it equals only because the engine took the accountant's figure for a choice the
 * ledger cannot show, with each judgement and the difference it carries, `recorded` for a date or
 * a decision the ledger cannot give, checked where the ledger can check it, and `FAIL` with the
 * residual otherwise. Konto lines are listed with their differences but take no verdict, because
 * one category can sit on several of them. The exit code is non-zero unless the bridge's steps add
 * up to our profit, that profit closes on the accountant's before and after tax to the cent, and no
 * line fails.
 */

import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { accrualYear } from '../src/packs/hr-doo/domain/accrual/accrualYear.ts'
import { amountOnLine } from '../src/packs/hr-doo/domain/accrual/closedYear.ts'
import { compareYearEnd } from '../src/packs/hr-doo/domain/yearEnd/yearEndComparison.ts'
import { ruleValue } from '../src/packs/hr-doo/ruleset/ruleset.ts'
import { presentedWorkbook } from '../src/features/transactions/application/presentedWorkbook.ts'
import { readSnapshot } from '../src/features/workbook/infrastructure/spreadsheetTab.ts'
import { readWorkbookFile } from '../src/features/workbook/infrastructure/workbookFile.ts'
import { amountOf, sumMoney } from '../src/shared/money/money.ts'
import { hrDooWorkbook } from '../src/packs/hr-doo/domain/hrDooPart.ts'
import { installHrDooPack } from './support/installPack.mjs'

const { values: options } = parseArgs({ options: { workbook: { type: 'string' }, year: { type: 'string' } } })
const year = Number(options.year)
if (options.workbook === undefined || !Number.isInteger(year)) {
  console.error('Usage: npm run parity:year-end -- --workbook <path to export.xlsx> --year <year>')
  process.exit(2)
}

installHrDooPack()
const bytes = readFileSync(options.workbook)
const { tabs, missingTabs } = await readWorkbookFile(bytes)
const read = readSnapshot({
  meta: { id: 'export', source: 'excel', title: options.workbook, syncedAt: new Date().toISOString(), lastExportedAt: null, unexportedSince: null, missingTabs },
  ...tabs,
}).workbook
const workbook = hrDooWorkbook(presentedWorkbook(read))
const accountant = workbook.yearEndLines.filter((line) => line.year === year)
if (accountant.length === 0) {
  console.error(`The year-end tab has no rows for ${year}.`)
  process.exit(2)
}
for (const problem of workbook.problems) {
  console.log(`problem  ${problem.tab}: ${problem.reason}`)
}

const accrual = accrualYear(workbook, year, { depreciation: workbook.companyFacts, citAdvancesPaid: null }, ruleValue)
const comparison = compareYearEnd(workbook, accrual)
const adjustments = new Map(accrual.adjustments.map((adjustment) => [adjustment.id, adjustment]))
const difference = (cents) => {
  const amount = amountOf(cents)
  return `${amount > 0 ? '+' : ''}${amount.toFixed(2)}`
}

let failures = 0
function report(verdict, subject, detail = '') {
  if (verdict === 'FAIL') {
    failures += 1
  }
  console.log(`${verdict.padEnd(9)}  ${subject}${detail === '' ? '' : `: ${detail}`}`)
}

/** What a judgement carries onto one line: a placement's move there, or the judgement's own difference. */
function judgementText(id, line) {
  const adjustment = adjustments.get(id)
  if (adjustment === undefined) {
    return id
  }
  const carried = difference(amountOnLine(adjustment, line))
  return `${adjustment.figure.label} (${adjustment.effect === 'placement' ? `${carried} here` : carried})`
}

const { bridge } = accrual
console.log(`Bridge for ${year}, from the app's cash net`)
for (const step of bridge.steps) {
  console.log(`  ${step.kind.padEnd(9)}  ${step.figure.label}${step.kind === 'judgement' ? ` (${difference(step.figure.amount)})` : ''}`)
}
console.log(`  ${bridge.corporateIncomeTax.kind.padEnd(9)}  ${bridge.corporateIncomeTax.figure.label}`)
for (const adjustment of accrual.adjustments.filter((candidate) => candidate.effect === 'tax-base')) {
  console.log(`  ${adjustment.kind.padEnd(9)}  ${adjustment.figure.label}, to the tax base (${difference(adjustment.figure.amount)})`)
}
const stepsLeftOver = bridge.profitBeforeTax.amount - sumMoney([bridge.cashNet.amount, ...bridge.steps.map((step) => step.figure.amount)])
report(stepsLeftOver === 0 ? 'pass' : 'FAIL', 'bridge steps add up from the cash net to our profit before tax', stepsLeftOver === 0 ? '' : `left over ${difference(stepsLeftOver)}`)
for (const [label, line, unexplained] of [
  ['profit before tax', 'profit-before-tax', bridge.unexplainedBeforeTax],
  ['profit after tax', 'profit-after-tax', bridge.unexplainedAfterTax],
]) {
  if (!accountant.some((candidate) => candidate.statement === 'pl' && candidate.line === line)) {
    report('FAIL', `bridge to ${label}`, 'the year-end tab has no such line')
  } else if (unexplained === null) {
    report('pass', `bridge closes ${label}`)
  } else {
    report('FAIL', `bridge to ${label}`, `residual ${difference(unexplained.figure.amount)}`)
  }
}

console.log(`Lines for ${year}`)
for (const compared of comparison.lines) {
  const subject = `${compared.statement} ${compared.line}`
  const detail = compared.residual !== null ? `residual ${difference(compared.residual)}` : compared.status === 'open' ? 'differs' : 'equal'
  if (compared.ours === null) {
    report('FAIL', subject, 'the engine does not compute it')
  } else if (compared.status === 'open') {
    report('FAIL', subject, detail)
  } else if (compared.status === 'judgement') {
    report('judgement', subject, detail)
    for (const id of compared.ours.judgements) {
      console.log(`             by ${judgementText(id, compared.line)}`)
    }
  } else {
    report('pass', subject, detail)
  }
}
for (const recorded of comparison.recorded) {
  const subject = `${recorded.accountant.statement} ${recorded.accountant.line}`
  if (recorded.check === null) {
    report('recorded', subject, 'a decision or a date the ledger cannot give')
  } else {
    report(recorded.check.holds ? 'recorded' : 'FAIL', subject, recorded.check.finding)
  }
}
if (comparison.distribution !== null) {
  const { residual } = comparison.distribution
  report(residual === 0 ? 'pass' : 'FAIL', 'distribution shares out the profit after tax', residual === 0 ? '' : `residual ${difference(residual)}`)
}

console.log('Konto lines by the categories they share, no verdict')
for (const group of comparison.konto) {
  console.log(`  konto ${group.konto.map((line) => line.line).join(', ')} (${group.categories.map((figure) => figure.label).join(' + ')}): differs by ${difference(group.difference)}`)
}
if (comparison.unnamedKonto.length > 0) {
  console.log(`  konto ${comparison.unnamedKonto.map((line) => line.line).join(', ')}: name no category`)
}

if (accrual.uninvoicedMonths.length > 0) {
  console.log(`Open: no invoice delivers in ${accrual.uninvoicedMonths.map((entry) => entry.month).join(', ')}, while a later invoice exists.`)
}
if (accrual.purchasesWithoutAsset.length > 0) {
  console.log(`Open: ${accrual.purchasesWithoutAsset.length} capital purchase(s) above the asset threshold with no asset row.`)
}
console.log(failures === 0 ? 'The bridge closes and every line passes, is a judgement or is recorded.' : `${failures} check(s) fail.`)
process.exit(failures === 0 ? 0 : 1)
