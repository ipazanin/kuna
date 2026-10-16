/**
 * Compares every figure the app computes with the figure the Sheet's purple tabs show for it, both
 * taken from one xlsx export of the workbook. The app side reads the export's `ledger`,
 * `categories` and `accounts` tabs through the same reader the app uses. The Sheet side is found
 * by label text. Nothing is written anywhere.
 *
 *   npm run parity:figures -- --workbook <path to export.xlsx>
 *
 * A row is a match within one cent. It is corrected when the app deliberately defines the figure
 * differently and recomputing the Sheet's own definition reproduces the Sheet's figure, which
 * proves the difference is that correction and nothing else. Anything else is a MISMATCH, and any
 * MISMATCH makes the exit code non-zero. The export holds real bank data, so keep it outside the
 * repository and never copy a figure from this output into it.
 */

import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import * as XLSX from 'xlsx'

import { findTable, isBlank, rowLabelled, tileValue, valueBeside } from './support/sheetFigures.mjs'
import { civilDateFromSerial } from '../src/shared/calendar/civilDate.ts'
import { rangeContains } from '../src/shared/calendar/dateRange.ts'
import { firstDayOf, lastDayOf, monthCountBetween, monthOf } from '../src/shared/calendar/monthKey.ts'
import { bucketTotals } from '../src/features/workbook/domain/bucketTotals.ts'
import { ledgerWindowOf } from '../src/features/workbook/domain/workbook.ts'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader.ts'
import { CACHED_TABS, sheetRowsFromValues } from '../src/features/workbook/infrastructure/workbookSnapshot.ts'
import { balanceSeries, latestBalances } from '../src/features/cash/domain/balances.ts'
import { euroSplit } from '../src/features/overview/domain/euroSplit.ts'
import { runway } from '../src/features/overview/domain/runway.ts'
import { windowAverages } from '../src/features/overview/domain/windowAverages.ts'
import { periodReview } from '../src/features/period-review/domain/periodReview.ts'
import { categoryTotals, outsideProfitAndLossTotals } from '../src/features/spending/domain/categoryTotals.ts'
import { topCounterparties } from '../src/features/spending/domain/topCounterparties.ts'
import { monthlyProfitAndLoss } from '../src/features/trends/domain/monthlyProfitAndLoss.ts'

const { values: options } = parseArgs({ options: { workbook: { type: 'string' } } })
if (options.workbook === undefined) {
  console.error('Usage: npm run parity:figures -- --workbook <path to export.xlsx>')
  process.exit(2)
}

const exported = XLSX.read(readFileSync(options.workbook), { type: 'buffer' })

/**
 * A tab as rows of raw values, row 1 first. An analysis tab gets null in its blank cells. A data tab
 * gets nothing there, which is what the Sheets API sends for a blank cell.
 */
function gridOf(tab, { blankCell = null } = {}) {
  const sheet = exported.Sheets[tab]
  if (sheet === undefined) {
    throw new Error(`The export has no "${tab}" tab.`)
  }
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true, ...(blankCell === null ? { defval: null } : {}) })
}

const workbook = readWorkbook({
  meta: { spreadsheetId: 'export', title: options.workbook, syncedAt: new Date().toISOString(), ledgerSheetId: null },
  ...Object.fromEntries(CACHED_TABS.map((tab) => [tab, sheetRowsFromValues(gridOf(tab, { blankCell: 'absent' }))])),
})
const window = ledgerWindowOf(workbook.transactions)
if (window === null) {
  console.error('The ledger tab holds no transaction.')
  process.exit(2)
}
const transactions = workbook.transactions

// Comparison --------------------------------------------------------------------------------------

const checks = []

/**
 * @param {string} metric
 * @param {'money' | 'ratio' | 'count' | 'date' | 'text'} kind
 * @param {unknown} sheet the Sheet's cell, as exported
 * @param {unknown} app the app's figure: cents for money, a CivilDate for a date
 * @param {{ rule: string, why: string, sheetDefinition: unknown }} [correction]
 */
function check(metric, kind, sheet, app, correction) {
  const sheetValue = sheetSide(kind, sheet)
  const appValue = appSide(kind, app)
  let status = 'match'
  if (!agrees(kind, sheetValue, appValue)) {
    status =
      correction !== undefined && agrees(kind, sheetValue, appSide(kind, correction.sheetDefinition))
        ? `corrected (${correction.rule}: ${correction.why})`
        : 'MISMATCH'
  }
  checks.push({ metric, kind, sheet: sheetValue, app: appValue, status })
}

function sheetSide(kind, cell) {
  if (isBlank(cell) || cell === '–') {
    return null
  }
  if (kind === 'date') {
    return typeof cell === 'number' ? civilDateFromSerial(cell) : String(cell)
  }
  if (kind === 'text') {
    return String(cell)
  }
  return typeof cell === 'number' ? cell : Number(cell)
}

function appSide(kind, figure) {
  if (figure === null || figure === undefined) {
    return null
  }
  return kind === 'money' ? figure / 100 : figure
}

function agrees(kind, sheet, app) {
  if (sheet === null || app === null) {
    return sheet === app
  }
  switch (kind) {
    case 'money':
      return Math.abs(sheet - app) < 0.0100001
    case 'ratio':
      return Math.abs(sheet - app) <= Math.max(1e-9, Math.abs(sheet) * 1e-6)
    case 'count':
      return sheet === app
    default:
      return sheet === app
  }
}

/** The Sheet's own all-time window starts at the ledger's first month, part-month or not. */
function sheetAllTime(line) {
  const range = { from: firstDayOf(window.firstMonth), to: lastDayOf(window.lastCompleteMonth) }
  const totals = bucketTotals(transactions.filter((transaction) => rangeContains(range, transaction.date)))
  return totals[line] / monthCountBetween(window.firstMonth, window.lastCompleteMonth)
}

const opensPartMonth = window.firstMonth !== window.firstCompleteMonth

/** The Sheet's category magnitude: the absolute sum, whatever the direction. */
function sheetCategoryShares(rows, include) {
  const sums = new Map()
  for (const transaction of rows) {
    if (include(transaction)) {
      sums.set(transaction.category, (sums.get(transaction.category) ?? 0) + transaction.amount)
    }
  }
  const magnitudes = new Map([...sums].map(([category, sum]) => [category, Math.abs(sum)]))
  const grand = [...magnitudes.values()].reduce((total, magnitude) => total + magnitude, 0)
  return new Map([...magnitudes].map(([category, magnitude]) => [category, grand === 0 ? null : magnitude / grand]))
}

const LINE_LABELS = [
  ['Income', 'income'],
  ['Operating cost', 'operating'],
  ['Tax & contributions', 'taxes'],
  ['Owner pay', 'ownerPay'],
]

// dashboard ---------------------------------------------------------------------------------------

const dashboard = gridOf('dashboard')
const balances = latestBalances(transactions)
const averages = windowAverages(transactions, window)
const split = euroSplit(averages.last12.totals, 12, averages.last12.period)

check('dashboard · Cash on hand', 'money', tileValue(dashboard, 'Cash on hand'), balances.cashOnHand.amount)

const typicalMonth = findTable(dashboard, ['Per month', 'Last 3 months', 'Last 12 months', 'All time'])
for (const [label, line] of [...LINE_LABELS, ['Net', 'net'], ['Owner earns (pay + net)', 'ownerEarns']]) {
  const row = rowLabelled(typicalMonth, label)
  check(`dashboard · ${label} · last 3, per month`, 'money', row?.[1], averages.last3.lines[line].perMonth)
  check(`dashboard · ${label} · last 12, per month`, 'money', row?.[2], averages.last12.lines[line].perMonth)
  check(`dashboard · ${label} · all time, per month`, 'money', row?.[3], averages.allTime?.lines[line].perMonth ?? null, opensPartMonth
    ? { rule: '#4', why: `all time starts at ${window.firstCompleteMonth}, not the part-month ${window.firstMonth}`, sheetDefinition: sheetAllTime(line) }
    : undefined)
}

const everyEuro = findTable(dashboard, ['Every euro earned', 'Last 12 months', 'Per month'])
for (const [label, part] of [['Operating cost', 'operating'], ['Tax & contributions', 'taxes'], ['Owner pay', 'ownerPay'], ['Kept in the company', 'kept']]) {
  const row = rowLabelled(everyEuro, label)
  const slice = split.slices.find((candidate) => candidate.part === part)
  const total = slice?.total ?? (split.shortfall === null ? null : -split.shortfall.total)
  const perMonth = slice?.perMonth ?? (split.shortfall === null ? null : -split.shortfall.perMonth)
  check(`dashboard · every euro earned · ${label} · last 12`, 'money', row?.[1], total)
  check(`dashboard · every euro earned · ${label} · per month`, 'money', row?.[2], perMonth)
}

const ownerEarns = rowLabelled(findTable(dashboard, ['What the owner earns', 'Last 12 months', 'Per month']), 'Owner pay + kept in the company')
check('dashboard · owner pay + kept · last 12', 'money', ownerEarns?.[1], averages.last12.lines.ownerEarns.total)
check('dashboard · owner pay + kept · per month', 'money', ownerEarns?.[2], averages.last12.lines.ownerEarns.perMonth)

check('dashboard · Runway (months)', 'ratio', tileValue(dashboard, 'Runway'), runway(balances.cashOnHand, averages.last3).months)
check('dashboard · Kept per euro earned', 'ratio', tileValue(dashboard, 'Kept per euro earned'), split.keptPerEuroEarned)

const operatingLast12 = categoryTotals(transactions, { preset: 'l12' }, window).filter((total) => total.bucket === 'operating')
const costMix = findTable(dashboard, ['Category', 'Last 12 months', 'Per month'])
for (const category of union(costMix?.rows.map((row) => row[0]) ?? [], operatingLast12.map((total) => total.category))) {
  const row = rowLabelled(costMix, category)
  const app = operatingLast12.find((total) => total.category === category)?.amount.amount ?? null
  check(`dashboard · operating cost by category · ${category} · last 12`, 'money', row?.[1], app)
}

// year --------------------------------------------------------------------------------------------

const year = gridOf('year')
const selectedYear = Number(valueBeside(year, 'Year'))
const yearPeriod = { preset: 'year', year: selectedYear }
const review = periodReview(transactions, yearPeriod, window)
const yearPnl = findTable(year, ['Item', 'Selected year', 'Prior year', 'Change'])
for (const [label, line] of [...LINE_LABELS, ['Retained', 'net'], ['Owner earns (pay + retained)', 'ownerEarns']]) {
  const row = rowLabelled(yearPnl, label)
  const reviewLine = review.lines.find((candidate) => candidate.line === line)
  check(`year ${selectedYear} · ${label} · selected year`, 'money', row?.[1], reviewLine.current.amount)
  check(`year ${selectedYear} · ${label} · prior year`, 'money', row?.[2], reviewLine.prior?.amount ?? null)
  check(`year ${selectedYear} · ${label} · change`, 'money', row?.[3], reviewLine.change, reviewLine.prior !== null && review.prior?.partial
    ? { rule: '#9', why: `${selectedYear - 1} is a partial year`, sheetDefinition: reviewLine.current.amount - reviewLine.prior.amount }
    : undefined)
}

const yearSplit = euroSplit(review.current.totals, 12, yearPeriod)
const yearEveryEuro = findTable(year, ['Every euro earned', 'Amount'])
for (const [label, part] of [['Operating cost', 'operating'], ['Tax & contributions', 'taxes'], ['Owner pay', 'ownerPay'], ['Kept in the company', 'kept']]) {
  const slice = yearSplit.slices.find((candidate) => candidate.part === part)
  const total = slice?.total ?? (yearSplit.shortfall === null ? null : -yearSplit.shortfall.total)
  check(`year ${selectedYear} · every euro earned · ${label}`, 'money', rowLabelled(yearEveryEuro, label)?.[1], total)
}
check(
  `year ${selectedYear} · owner pay + kept`,
  'money',
  rowLabelled(findTable(year, ['What the owner earns', 'Amount']), 'Owner pay + kept in the company')?.[1],
  review.current.totals.ownerEarns,
)

const byMonth = findTable(year, ['Month', 'Income', 'Cost', 'Net'])
for (const month of union(byMonth?.rows.map((row) => row[0]) ?? [], review.months.map((entry) => entry.month))) {
  const row = rowLabelled(byMonth, month)
  const entry = review.months.find((candidate) => candidate.month === month)
  for (const [label, column, line] of [['income', 1, 'income'], ['cost', 2, 'cost'], ['net', 3, 'net']]) {
    // The Sheet lists only months the ledger touches. A month with no rows reads as zero there.
    check(`year ${selectedYear} · by month · ${month} · ${label}`, 'money', row?.[column] ?? (entry === undefined ? null : 0), entry?.[line].amount ?? null)
  }
}

const yearRows = transactions.filter((transaction) => rangeContains(review.current.range, transaction.date))
const yearCategories = categoryTotals(transactions, yearPeriod, window)
const yearSheetShares = sheetCategoryShares(yearRows, (transaction) => transaction.bucket !== 'neutral' && transaction.family !== 'unclassified')
const yearOutside = outsideProfitAndLossTotals(transactions, yearPeriod, window)
const yearByCategory = findTable(year, ['Category', 'Family', 'Amount', '% of year'])
const yearCategoryNames = [...yearCategories, ...yearOutside].map((total) => total.category)
for (const category of union(yearByCategory?.rows.map((row) => row[0]) ?? [], yearCategoryNames)) {
  const row = rowLabelled(yearByCategory, category)
  const metric = `year ${selectedYear} · by category · ${category}`
  const outside = yearOutside.find((total) => total.category === category)
  if (outside !== undefined) {
    // Period review lists financing categories under "Outside profit and loss", with no share.
    checkMagnitude(`${metric} · amount (outside profit and loss)`, row?.[2], outside.amount.amount)
    check(`${metric} · share (outside profit and loss)`, 'ratio', row?.[3], null, {
      rule: '#3',
      why: 'outside profit and loss, so no share of income or cost',
      sheetDefinition: yearSheetShares.get(category) ?? null,
    })
    continue
  }
  const app = yearCategories.find((total) => total.category === category) ?? null
  checkCategory(metric, row?.[2], row?.[3], app, yearSheetShares.get(category))
}

// monthly -----------------------------------------------------------------------------------------

const monthly = gridOf('monthly')
const series = monthlyProfitAndLoss(transactions, window)
const averagesBox = findTable(monthly, ['Metric', 'Value'])
const ledgerMonths = new Set(transactions.map((transaction) => monthOf(transaction.date)))
const sheetCompleteMonths = [...ledgerMonths].filter((month) => month <= window.lastCompleteMonth)
const sheetAverageOf = (line) =>
  series.filter((entry) => sheetCompleteMonths.includes(entry.month)).reduce((total, entry) => total + entry.lines[line].amount, 0) /
  sheetCompleteMonths.length
const averagesCorrection = (line) =>
  opensPartMonth ? { rule: '#4', why: `averages start at ${window.firstCompleteMonth}`, sheetDefinition: sheetAverageOf(line) } : undefined
check('monthly · Average monthly income', 'money', rowLabelled(averagesBox, 'Average monthly income')?.[1], averages.allTime?.lines.income.perMonth ?? null, averagesCorrection('income'))
check('monthly · Average monthly cost', 'money', rowLabelled(averagesBox, 'Average monthly cost')?.[1], averages.allTime?.lines.cost.perMonth ?? null, averagesCorrection('cost'))
check('monthly · Complete months', 'count', rowLabelled(averagesBox, 'Complete months')?.[1], averages.allTime?.span.monthCount ?? 0, opensPartMonth
  ? { rule: '#4', why: `${window.firstMonth} is a part-month`, sheetDefinition: sheetCompleteMonths.length }
  : undefined)

const monthlyTable = findTable(monthly, ['Month', 'Income', 'Operating', 'Taxes', 'Owner pay', 'Net', 'Owner earns', 'Cumulative net', '3-mo avg cost'])
for (const month of union(monthlyTable?.rows.map((row) => row[0]) ?? [], series.map((entry) => entry.month))) {
  const row = rowLabelled(monthlyTable, month)
  const position = series.findIndex((candidate) => candidate.month === month)
  const entry = series[position]
  const columns = [['income', 1], ['operating', 2], ['taxes', 3], ['ownerPay', 4], ['net', 5], ['ownerEarns', 6]]
  for (const [line, column] of columns) {
    check(`monthly · ${month} · ${line}`, 'money', row?.[column], entry?.lines[line].amount ?? null)
  }
  check(`monthly · ${month} · cumulative net`, 'money', row?.[7], entry?.cumulativeNet ?? null)
  const sheetRolling = position >= 2 ? series.slice(position - 2, position + 1).reduce((total, candidate) => total + candidate.lines.cost.amount, 0) / 3 : null
  const rollingRule = month === window.partMonth ? ['#2', 'the part-month is never averaged'] : ['#4', 'the window holds the opening part-month']
  check(`monthly · ${month} · 3-mo avg cost`, 'money', row?.[8], entry?.rolling3?.cost ?? null, sheetRolling === null
    ? undefined
    : { rule: rollingRule[0], why: rollingRule[1], sheetDefinition: sheetRolling })
}

// spend -------------------------------------------------------------------------------------------

const spend = gridOf('spend')
const allTimeCategories = categoryTotals(transactions, { preset: 'all' }, window)
const last12Categories = categoryTotals(transactions, { preset: 'l12' }, window)
const definedSlugs = new Set(workbook.categories.map((category) => category.slug))
const spendSheetShares = sheetCategoryShares(
  transactions,
  (transaction) => definedSlugs.has(transaction.category) && transaction.bucket !== 'neutral' && transaction.bucket !== 'financing',
)
const everyCategory = findTable(spend, ['Category', 'Family', 'Total', '% of total', 'Last 12 months'])
for (const category of union(everyCategory?.rows.map((row) => row[0]) ?? [], allTimeCategories.map((total) => total.category))) {
  const row = rowLabelled(everyCategory, category)
  const allTimeTotal = allTimeCategories.find((total) => total.category === category) ?? null
  const unused = row !== null && row[2] === 0 && allTimeTotal === null
  checkCategory(`spend · ${category} · all time`, row?.[2], row?.[3], unused ? zeroCategory() : allTimeTotal, spendSheetShares.get(category) ?? null)
  const recent = last12Categories.find((total) => total.category === category)
  checkMagnitude(`spend · ${category} · last 12`, row?.[4], recent?.amount.amount ?? (row === null ? null : 0))
}

const payees = topCounterparties(transactions, { preset: 'all' }, window, 15)
const topTable = findTable(spend, ['Payee', 'Total out', 'Txns'])
for (const label of union(topTable?.rows.map((row) => row[0]) ?? [], payees.map((payee) => payee.label))) {
  const row = rowLabelled(topTable, label)
  const payee = payees.find((candidate) => candidate.label === label)
  check(`spend · top payee · ${label} · total out`, 'money', row?.[1], payee?.total.amount ?? null)
  check(`spend · top payee · ${label} · txns`, 'count', row?.[2], payee?.transactionCount ?? null)
}

// cash --------------------------------------------------------------------------------------------

const cash = gridOf('cash')
const accountsTable = findTable(cash, ['Account', 'Balance', 'As of', 'First seen', 'Txns'])
for (const account of balances.accounts) {
  const row = rowLabelled(accountsTable, account.account.toUpperCase())
  check(`cash · ${account.account} · balance`, 'money', row?.[1], account.balance.amount)
  check(`cash · ${account.account} · as of`, 'date', row?.[2], account.asOf)
  check(`cash · ${account.account} · first seen`, 'date', row?.[3], account.firstSeen)
  check(`cash · ${account.account} · txns`, 'count', row?.[4], account.transactionCount)
}
const totalRow = rowLabelled(accountsTable, 'TOTAL')
check('cash · TOTAL · balance', 'money', totalRow?.[1], balances.cashOnHand.amount)
check('cash · TOTAL · txns', 'count', totalRow?.[4], transactions.length)

const balanceMonths = balanceSeries(transactions, window)
const monthTable = findTable(cash, ['Month', 'Total', 'By account'], 2 + balanceMonths.accounts.length)
const [accountNames = [], ...monthRows] = monthTable?.rows ?? []
for (const entry of balanceMonths.months) {
  const row = monthRows.find((candidate) => candidate[0] === entry.month)
  check(`cash · ${entry.month} · total`, 'money', row?.[1], entry.total.amount)
  for (const account of balanceMonths.accounts) {
    const column = accountNames.indexOf(account.toUpperCase())
    check(`cash · ${entry.month} · ${account}`, 'money', column === -1 ? undefined : row?.[column], entry.byAccount[account]?.amount ?? null)
  }
}

// Category helpers --------------------------------------------------------------------------------

function checkCategory(metric, sheetAmount, sheetShare, total, sheetShareDefinition) {
  checkMagnitude(`${metric} · amount`, sheetAmount, total?.amount.amount ?? null)
  check(`${metric} · share`, 'ratio', sheetShare, total?.share ?? null, total === null
    ? undefined
    : { rule: '#3', why: 'share within its direction, not of income and cost together', sheetDefinition: sheetShareDefinition ?? null })
}

/** The Sheet shows a category's absolute sum. The app signs it by direction, so a repayment reads negative. */
function checkMagnitude(metric, sheetAmount, appAmount) {
  check(metric, 'money', sheetAmount, appAmount, appAmount === null
    ? undefined
    : { rule: '#3', why: 'signed within its direction', sheetDefinition: Math.abs(appAmount) })
}

function zeroCategory() {
  return { amount: { amount: 0 }, share: 0 }
}

function union(left, right) {
  return [...new Set([...left, ...right])]
}

// Report ------------------------------------------------------------------------------------------

function shown(kind, value) {
  if (value === null) {
    return '—'
  }
  if (kind === 'money') {
    return value.toFixed(2)
  }
  if (kind === 'ratio') {
    return value.toFixed(6)
  }
  return String(value)
}

function difference(check) {
  if (check.sheet === null || check.app === null || typeof check.app !== 'number') {
    return ''
  }
  return check.kind === 'money' ? (check.app - check.sheet).toFixed(2) : String(Number((check.app - check.sheet).toPrecision(6)))
}

const header = ['metric', 'sheet', 'app', 'difference', 'status']
const lines = checks.map((entry) => [entry.metric, shown(entry.kind, entry.sheet), shown(entry.kind, entry.app), difference(entry), entry.status])
const widths = header.map((title, column) => Math.max(title.length, ...lines.map((line) => line[column].length)))
const format = (cells) => cells.map((cell, column) => (column === 0 || column === 4 ? cell.padEnd(widths[column]) : cell.padStart(widths[column]))).join('  ')
console.log(`Window: complete months ${window.firstCompleteMonth} to ${window.lastCompleteMonth}, part-month ${window.partMonth}. Year tab shows ${selectedYear}.`)
console.log(format(header))
console.log(widths.map((width) => '-'.repeat(width)).join('  '))
for (const line of lines) {
  console.log(format(line))
}
const mismatches = checks.filter((entry) => entry.status === 'MISMATCH').length
const corrected = checks.filter((entry) => entry.status.startsWith('corrected')).length
console.log(`\n${checks.length} figures: ${checks.length - mismatches - corrected} match, ${corrected} corrected, ${mismatches} MISMATCH.`)
if (workbook.problems.length > 0) {
  console.log(`The reader left out ${workbook.problems.length} row(s):`)
  for (const problem of workbook.problems) {
    console.log(`  ${problem.tab} row ${problem.sheetRow}: ${problem.reason}`)
  }
}
process.exitCode = mismatches > 0 ? 1 : 0
