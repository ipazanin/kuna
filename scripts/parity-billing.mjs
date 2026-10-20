/**
 * Compares the billing plan figures the app computes from the outgoing-plan and invoices tabs with
 * the formula block beside the rows of the Sheet's outgoing-plan tab, in an xlsx export of it. The
 * export holds real company figures, so keep it outside the repository. This prints verdicts,
 * differences and row numbers only, never a figure itself, and nothing from its output belongs in
 * the repository either.
 *
 *   npm run parity:billing -- --workbook <path to export.xlsx>
 *
 * The block's figures are found by their labels: Total Amount, Invoiced Amount, Not Invoiced
 * Amount, and the year rows under Actual. Each formula is first run again over the export's own
 * cells, so a figure the export did not recalculate fails. A figure is `pass` when the app's equals
 * the tab's to the cent, `corrected` with the reason when the tab's formula misses rows or adds
 * unrounded formula amounts the app reads to the cent, and `FAIL` otherwise. The exit code is
 * non-zero on any FAIL.
 */

import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import * as XLSX from 'xlsx'

import { billingTotals } from '../src/features/billingPlan/domain/billingTotals.ts'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader.ts'
import { readWorkbookFile } from '../src/features/workbook/infrastructure/workbookFile.ts'
import { civilDateFromSerial, yearOf } from '../src/shared/calendar/civilDate.ts'
import { amountOf, moneyFromAmount } from '../src/shared/money/money.ts'

const PLAN_TAB = 'outgoing-plan'
const RANGE = /(?:([A-Za-z_][\w-]*|'[^']+')!)?\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)/g

const { values: options } = parseArgs({ options: { workbook: { type: 'string' } } })
if (options.workbook === undefined) {
  console.error('Usage: npm run parity:billing -- --workbook <path to export.xlsx>')
  process.exit(2)
}

const bytes = readFileSync(options.workbook)
const { tabs, missingTabs } = await readWorkbookFile(bytes)
if (missingTabs.includes(PLAN_TAB)) {
  console.error(`The export has no ${PLAN_TAB} tab.`)
  process.exit(2)
}
const workbook = readWorkbook({
  meta: { id: 'export', source: 'excel', title: options.workbook, syncedAt: new Date().toISOString(), ledgerSheetId: null, lastExportedAt: null, unexportedSince: null, missingTabs },
  ...tabs,
})
for (const problem of workbook.problems.filter((candidate) => candidate.tab === PLAN_TAB || candidate.tab === 'invoices')) {
  console.log(`problem    ${problem.tab} row ${problem.sheetRow}: ${problem.reason}`)
}
const totals = billingTotals(workbook.billingPlan, workbook.invoices)

const book = XLSX.read(bytes, { type: 'buffer', cellFormula: true })
const sheetOf = (tab) => book.Sheets[book.SheetNames.find((name) => name.trim().toLowerCase() === tab) ?? '']
const planSheet = sheetOf(PLAN_TAB)
const cellAt = (sheet, column, row) => sheet?.[`${column}${row}`]

/** Every cell of the plan tab with a text label, so a figure is found by its label rather than its address. */
const labels = Object.keys(planSheet)
  .filter((address) => !address.startsWith('!') && typeof planSheet[address].v === 'string')
  .map((address) => ({ ...XLSX.utils.decode_cell(address), text: planSheet[address].v.trim().toLowerCase() }))
  .sort((upper, lower) => upper.r - lower.r || upper.c - lower.c)

/** The figure to the right of a label: its cached value and its formula. */
function figureBeside(at) {
  const cell = planSheet[XLSX.utils.encode_cell({ r: at.r, c: at.c + 1 })]
  return cell === undefined || typeof cell.v !== 'number' ? null : { value: cell.v, formula: cell.f ?? '', address: XLSX.utils.encode_cell({ r: at.r, c: at.c + 1 }) }
}

function labelled(text) {
  const at = labels.find((label) => label.text === text)
  return at === undefined ? null : figureBeside(at)
}

/** The year rows of a section: under its label, a Year header, then one row per year in the same column. */
function yearRowsOf(section) {
  const heading = labels.find((label) => label.text === section)
  if (heading === undefined) return []
  const years = []
  for (let row = heading.r + 1; ; row += 1) {
    const cell = planSheet[XLSX.utils.encode_cell({ r: row, c: heading.c })]
    if (typeof cell?.v === 'string' && cell.v.trim().toLowerCase() === 'year') continue
    if (typeof cell?.v !== 'number' || !Number.isInteger(cell.v)) break
    const figure = figureBeside({ r: row, c: heading.c })
    if (figure !== null) years.push({ year: cell.v, ...figure })
  }
  return years
}

/** The ranges a SUM or SUMIFS formula reads, each on its tab. */
function rangesOf(formula) {
  return [...formula.matchAll(RANGE)].map((match) => ({
    tab: match[1] === undefined ? PLAN_TAB : match[1].replace(/^'|'$/g, '').toLowerCase(),
    column: match[2],
    from: Number(match[3]),
    to: Number(match[5]),
  }))
}

/** How a figure's formula counts: which column it sums, and for a year row which date column it tests. */
function readingOf(formula, year) {
  const ranges = rangesOf(formula)
  if (/^SUM\(/i.test(formula) && ranges.length === 1) {
    return { sum: ranges[0], date: null, year: null }
  }
  if (/^SUMIFS\(/i.test(formula) && ranges.length >= 2 && year !== null) {
    return { sum: ranges[0], date: ranges[1], year }
  }
  return null
}

/** Rows the reading counts among `rows`, with their unrounded amounts. */
function countedRows(reading, rows) {
  const sheet = sheetOf(reading.sum.tab)
  return rows.flatMap((row) => {
    const amount = cellAt(sheet, reading.sum.column, row)?.v
    if (typeof amount !== 'number') return []
    if (reading.date !== null) {
      const serial = cellAt(sheet, reading.date.column, row)?.v
      if (typeof serial !== 'number' || yearOf(civilDateFromSerial(serial)) !== reading.year) return []
    }
    return [{ row, amount }]
  })
}

/** The rows of a tab below its header that hold a number in the column, which is what its formulas should read. */
function dataRowsOf(tab, column) {
  const sheet = sheetOf(tab)
  const last = XLSX.utils.decode_range(sheet['!ref']).e.r + 1
  return Array.from({ length: last - 1 }, (_, index) => index + 2).filter((row) => typeof cellAt(sheet, column, row)?.v === 'number')
}

const inclusive = (from, to) => Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index)
const sumOf = (rows) => rows.reduce((total, row) => total + row.amount, 0)
const centsOfRows = (rows) => rows.reduce((total, row) => total + moneyFromAmount(row.amount), 0)
const signed = (cents) => `${cents > 0 ? '+' : ''}${amountOf(cents).toFixed(2)}`
const rowList = (rows) => rows.map((row) => row.row).join(', ').replace(/, (\d+)$/, ' and $1')

/**
 * An export holds every formula's cached value to about ten significant digits, the amount cells
 * that are formulas among them, so a recomputed figure is compared at the precision of the largest
 * amount behind it.
 */
const agrees = (cached, recomputed, scale = Math.abs(recomputed)) => Math.abs(cached - recomputed) <= scale * 1e-9 + 1e-9

/** An unrounded sum to the cent as the Sheet shows it. Twelve significant digits drop the float noise first, so 0.705 shows as 0.71. */
function shownCents(sum) {
  const cents = Number((sum * 100).toPrecision(12))
  return Math.sign(cents) * Math.round(Math.abs(cents)) + 0
}

let failures = 0
function report(verdict, subject, detail = '') {
  if (verdict === 'FAIL') failures += 1
  console.log(`${verdict.padEnd(9)}  ${subject}${detail === '' ? '' : `: ${detail}`}`)
}

/**
 * One figure of the block. The tab's figure must follow from its own formula over its own range.
 * `appCents` must equal each row taken to the cent over every data row the formula's criteria
 * count. Returns the verdict and the tab's unrounded figure, or null when the figure cannot be checked.
 */
function compare(subject, figure, appCents, year = null) {
  if (figure === null) {
    report('FAIL', subject, 'the tab has no such figure')
    return null
  }
  const reading = readingOf(figure.formula, year)
  if (reading === null) {
    report('FAIL', subject, `the formula in ${figure.address} is not a SUM or SUMIFS the check can follow`)
    return null
  }
  const own = sumOf(countedRows(reading, inclusive(reading.sum.from, reading.sum.to)))
  if (!agrees(figure.value, own)) {
    report('FAIL', subject, `the cached value in ${figure.address} does not follow from its formula, so the export was not recalculated`)
    return null
  }
  const dataRows = dataRowsOf(reading.sum.tab, reading.sum.column)
  const counted = countedRows(reading, dataRows)
  if (appCents !== centsOfRows(counted)) {
    report('FAIL', subject, `the app is ${signed(appCents - centsOfRows(counted))} from the ${reading.sum.tab} rows it should count. Check the problems above`)
    return { verdict: 'FAIL', own }
  }
  const reasons = []
  const missed = dataRows.filter((row) => row < reading.sum.from || row > reading.sum.to)
  if (missed.length > 0) {
    const missedCounted = counted.filter((row) => missed.includes(row.row))
    reasons.push(
      `the formula reads rows ${reading.sum.from} to ${reading.sum.to} and misses ${reading.sum.tab} row${missed.length === 1 ? '' : 's'} ${rowList(missed.map((row) => ({ row })))}. ` +
        (missedCounted.length === 0 ? 'None of them counts here, so the figure agrees for now' : `Rows ${rowList(missedCounted)} count here and the tab leaves them out`),
    )
  }
  if (appCents !== shownCents(sumOf(counted))) {
    const fractional = counted.filter((row) => moneyFromAmount(row.amount) / 100 !== row.amount)
    reasons.push(`the tab adds the unrounded amounts of the formula cells on rows ${rowList(fractional)}, and the app takes each row to the cent as it is invoiced, ${signed(appCents - shownCents(sumOf(counted)))} apart`)
  }
  const tabCents = shownCents(own)
  const verdict = reasons.length > 0 ? 'corrected' : appCents === tabCents ? 'pass' : 'FAIL'
  const detail = reasons.map((reason, index) => (index === 0 ? reason : reason[0].toUpperCase() + reason.slice(1))).join('. ')
  report(verdict, subject, reasons.length > 0 ? detail : verdict === 'FAIL' ? `the app is ${signed(appCents - tabCents)} from the tab` : '')
  return { verdict, own }
}

/** Not invoiced is Total amount less Invoiced amount on the tab, so it carries their verdicts. */
function compareDifference(subject, figure, total, invoiced) {
  if (figure === null || total === null || invoiced === null) {
    report('FAIL', subject, figure === null ? 'the tab has no such figure' : 'it needs Total amount and Invoiced amount, which did not check')
    return
  }
  if (!agrees(figure.value, total.own - invoiced.own, Math.max(Math.abs(total.own), Math.abs(invoiced.own)))) {
    report('FAIL', subject, `the cached value in ${figure.address} is not Total amount less Invoiced amount`)
    return
  }
  const tabCents = shownCents(total.own - invoiced.own)
  if (totals.notInvoiced === tabCents) {
    report('pass', subject)
  } else if ([total.verdict, invoiced.verdict].includes('corrected')) {
    report('corrected', subject, `it is Total amount less Invoiced amount, so it carries their corrections, ${signed(totals.notInvoiced - tabCents)} apart`)
  } else {
    report('FAIL', subject, `the app is ${signed(totals.notInvoiced - tabCents)} from the tab`)
  }
}

console.log(`Billing plan parity: ${workbook.billingPlan.length} plan rows, ${workbook.invoices.length} invoices`)
const total = compare('Total amount', labelled('total amount'), totals.planned)
const invoiced = compare('Invoiced amount', labelled('invoiced amount'), totals.invoiced)
compareDifference('Not invoiced', labelled('not invoiced amount'), total, invoiced)
const yearOfApp = (year) => totals.years.find((entry) => entry.year === year)
for (const row of yearRowsOf('actual')) {
  compare(`Actual ${row.year}`, row, yearOfApp(row.year)?.invoiced ?? 0, row.year)
}
const listed = new Set(yearRowsOf('actual').map((row) => row.year))
for (const entry of totals.years.filter((candidate) => candidate.invoiced !== 0 && !listed.has(candidate.year))) {
  console.log(`note       ${entry.year} has invoices and no row under Actual in the tab's block`)
}

console.log(failures === 0 ? '\nbilling parity: no failures' : `\nbilling parity: ${failures} FAIL`)
process.exitCode = failures === 0 ? 0 : 1
