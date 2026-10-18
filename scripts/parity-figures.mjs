/**
 * Compares every figure the app computes with the figure the Sheet's purple tabs show for it, both
 * taken from one xlsx export of the workbook. The app side reads the export's workbook tabs through
 * the same file reader and workbook reader an Excel import uses. The Sheet side is found
 * by label text. Nothing is written anywhere.
 *
 *   npm run parity:figures -- --workbook <path to export.xlsx> [--scripts <Apps Script folder>]
 *
 * The invoice figures read the export's `invoices` and `clients` tabs. An export from before those
 * tabs reads the register from `outgoing!A3:D` as one client, `nlc`, whose IBANs come from the
 * enabled `rules` rows filing credits as revenue, or else from `CLIENT_IBANS` in a `.gs` file of
 * `--scripts` (by default the shadow-accounting project in the Drive).
 *
 * A row is a match within one cent. It is corrected when the app deliberately defines the figure
 * differently and recomputing the Sheet's own definition reproduces the Sheet's figure, which
 * proves the difference is that correction and nothing else. Anything else is a MISMATCH, and any
 * MISMATCH makes the exit code non-zero. The export holds real bank data, so keep it outside the
 * repository and never copy a figure from this output into it.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import * as XLSX from 'xlsx'

import { findTable, isBlank, rowLabelled, tileValue, valueBeside } from './support/sheetFigures.mjs'
import { civilDateFromSerial } from '../src/shared/calendar/civilDate.ts'
import { rangeContains } from '../src/shared/calendar/dateRange.ts'
import { firstDayOf, lastDayOf, monthCountBetween, monthOf } from '../src/shared/calendar/monthKey.ts'
import { bucketTotals } from '../src/features/workbook/domain/bucketTotals.ts'
import { bookingOfAdvance, ledgerWindowOf } from '../src/features/workbook/domain/workbook.ts'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader.ts'
import { readWorkbookFile } from '../src/features/workbook/infrastructure/workbookFile.ts'
import { fold, normaliseIban } from '../src/shared/text/fold.ts'
import { daysToPaid } from '../src/features/receivables/domain/daysToPaid.ts'
import { receivablesOf } from '../src/features/receivables/domain/invoiceMatching.ts'
import { balanceSeries, latestBalances } from '../src/features/cash/domain/balances.ts'
import { euroSplit } from '../src/features/overview/domain/euroSplit.ts'
import { runway } from '../src/features/overview/domain/runway.ts'
import { windowAverages } from '../src/features/overview/domain/windowAverages.ts'
import { periodReview } from '../src/features/period-review/domain/periodReview.ts'
import { categoryTotals, outsideProfitAndLossTotals } from '../src/features/spending/domain/categoryTotals.ts'
import { topCounterparties } from '../src/features/spending/domain/topCounterparties.ts'
import { monthlyProfitAndLoss } from '../src/features/trends/domain/monthlyProfitAndLoss.ts'
import { effectiveTaxRate } from '../src/packs/hr-doo/domain/effectiveTaxRate.ts'
import { ownerCost } from '../src/packs/hr-doo/domain/ownerCost.ts'
import { netOwed, ownerAdvances } from '../src/packs/hr-doo/domain/ownerAdvances.ts'
import { ownerLoans } from '../src/packs/hr-doo/domain/ownerLoans.ts'
import { ownerTake } from '../src/packs/hr-doo/domain/ownerTake.ts'
import { payrollCadence } from '../src/packs/hr-doo/domain/payrollCadence.ts'
import { taxByType, typicalMonthlyAmount } from '../src/packs/hr-doo/domain/taxByType.ts'

const { values: options } = parseArgs({
  options: {
    workbook: { type: 'string' },
    scripts: { type: 'string', default: join(homedir(), 'gdrive/work/dss/dss-finance/shadow-accounting/scripts') },
  },
})
if (options.workbook === undefined) {
  console.error('Usage: npm run parity:figures -- --workbook <path to export.xlsx> [--scripts <Apps Script folder>]')
  process.exit(2)
}

const bytes = readFileSync(options.workbook)
const exported = XLSX.read(bytes, { type: 'buffer' })

/** An analysis tab as rows of raw values, row 1 first, with null in its blank cells. */
function gridOf(tab) {
  const sheet = exported.Sheets[tab]
  if (sheet === undefined) {
    throw new Error(`The export has no "${tab}" tab.`)
  }
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true, defval: null })
}

const { tabs } = await readWorkbookFile(bytes)
const workbook = readWorkbook({
  meta: { id: 'export', source: 'excel', title: options.workbook, syncedAt: new Date().toISOString(), ledgerSheetId: null, lastExportedAt: null, unexportedSince: null },
  ...tabs,
})
const window = ledgerWindowOf(workbook.transactions)
if (window === null) {
  console.error('The ledger tab holds no transaction.')
  process.exit(2)
}
const transactions = workbook.transactions
/** What profit and loss counts, the owner's advances included, as every screen counts it. */
const bookings = [...transactions, ...workbook.ownerAdvances.map(bookingOfAdvance)]

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
  if (kind === 'percent') {
    return typeof cell === 'number' ? cell : Number(String(cell).replace('%', '')) / 100
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
    case 'percent':
      // The Sheet writes the rate as text to one decimal place.
      return Math.abs(sheet - app) <= 0.0005 + 1e-9
    default:
      return sheet === app
  }
}

/** The Sheet's own all-time window starts at the ledger's first month, part-month or not. */
function sheetAllTime(line) {
  const range = { from: firstDayOf(window.firstMonth), to: lastDayOf(window.lastCompleteMonth) }
  const totals = bucketTotals(bookings.filter((booking) => rangeContains(range, booking.date)))
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
const averages = windowAverages(bookings, window)
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

const operatingLast12 = categoryTotals(bookings, { preset: 'l12' }, window).filter((total) => total.bucket === 'operating')
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
const review = periodReview(bookings, yearPeriod, window)
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

const yearRows = bookings.filter((booking) => rangeContains(review.current.range, booking.date))
const yearCategories = categoryTotals(bookings, yearPeriod, window)
const yearSheetShares = sheetCategoryShares(yearRows, (transaction) => transaction.bucket !== 'neutral' && transaction.family !== 'unclassified')
const yearOutside = outsideProfitAndLossTotals(bookings, yearPeriod, window)
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
const series = monthlyProfitAndLoss(bookings, window)
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
const allTimeCategories = categoryTotals(bookings, { preset: 'all' }, window)
const last12Categories = categoryTotals(bookings, { preset: 'l12' }, window)
const definedSlugs = new Set(workbook.categories.map((category) => category.slug))
const spendSheetShares = sheetCategoryShares(
  bookings,
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
// The Sheet prints each payee in folded capitals and the app in its most common spelling, so the two
// sides meet on the folded name.
for (const foldedLabel of union(topTable?.rows.map((row) => fold(String(row[0]))) ?? [], payees.map((payee) => fold(payee.label)))) {
  const row = topTable?.rows.find((candidate) => fold(String(candidate[0])) === foldedLabel)
  const payee = payees.find((candidate) => fold(candidate.label) === foldedLabel)
  check(`spend · top payee · ${foldedLabel} · total out`, 'money', row?.[1], payee?.total.amount ?? null)
  check(`spend · top payee · ${foldedLabel} · txns`, 'count', row?.[2], payee?.transactionCount ?? null)
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

// The d.o.o. pack: owner, owner-loans and taxes ----------------------------------------------------

/**
 * The pack selects categories by role. An export from before the `roles` column existed gets the
 * lists the Sheet's Code.gs hard-codes, which is what the column was seeded from.
 */
const SHEET_ROLES = {
  revenue: ['revenue'],
  'payroll-contributions': ['watched', 'owner-pay-tax'],
  'payroll-tax': ['owner-pay-tax'],
  'dividend-tax': ['owner-pay-tax'],
  'owner-loan-out': ['owner-loan-out'],
  'owner-loan-repaid': ['owner-loan-repaid'],
  'reimbursement-to-owner': ['reimbursement'],
  'reimbursement-from-owner': ['reimbursement'],
  'client-refund': ['client-refund'],
}
const exportHasRoles = workbook.categories.some((category) => category.roles.length > 0)
const packCategories = exportHasRoles ? workbook.categories : workbook.categories.map((category) => ({ ...category, roles: SHEET_ROLES[category.slug] ?? [] }))
const allTimePeriod = { preset: 'all' }
const last12Period = { preset: 'l12' }

const ownerTab = gridOf('owner')
const takeAllTime = ownerTake(bookings, packCategories, allTimePeriod, window)
const takeLast12 = ownerTake(bookings, packCategories, last12Period, window)
const costLast12 = ownerCost(bookings, packCategories, last12Period, window)
const loanBook = ownerLoans(transactions, packCategories)

check('owner · Total taken out (all time)', 'money', tileValue(ownerTab, 'Total taken out (all time)'), takeAllTime.total.amount)
check('owner · Taken out, last 12 months', 'money', tileValue(ownerTab, 'Taken out, last 12 months'), takeLast12.total.amount)
check('owner · Owner loan outstanding', 'money', tileValue(ownerTab, 'Owner loan outstanding'), loanBook.outstanding.amount)
check('owner · Gross cost of the owner, last 12 months', 'money', tileValue(ownerTab, 'Gross cost of the owner, last 12 months'), costLast12.gross.amount)
check('owner · Cost per euro received, last 12 months', 'ratio', tileValue(ownerTab, 'Cost per euro received, last 12 months'), costLast12.costPerEuroReceived)
const reimbursementRoleCategories = packCategories.filter((category) => category.roles.includes('reimbursement')).map((category) => category.slug)
const signedReimbursements = transactions.filter((transaction) => reimbursementRoleCategories.includes(transaction.category)).reduce((total, transaction) => total + transaction.amount, 0)
check(
  'owner · Net owed between owner and company',
  'money',
  tileValue(ownerTab, 'Net owed between owner and company'),
  netOwed(loanBook, ownerAdvances(workbook.ownerAdvances, transactions, packCategories), packCategories).amount,
  {
    rule: '#7',
    why: `one signed balance: the loan balance less the ${workbook.ownerAdvances.length} advance(s) not yet reimbursed, where the Sheet adds every reimbursement signed`,
    sheetDefinition: loanBook.outstanding.amount + signedReimbursements,
  },
)

const takeTable = findTable(ownerTab, ['Category', 'All time', 'Last 12 months'])
const takeLineOf = (take, category) => [...take.byCategory, ...take.reimbursements].find((line) => line.category === category)?.amount.amount ?? null
const takeCategories = [...takeAllTime.byCategory, ...takeAllTime.reimbursements].map((line) => line.category)
for (const category of union(takeTable?.rows.map((row) => row[0]) ?? [], takeCategories)) {
  const row = rowLabelled(takeTable, category)
  // A category with no rows is listed at zero on the Sheet and left out by the app.
  check(`owner · took out · ${category} · all time`, 'money', row?.[1], takeLineOf(takeAllTime, category) ?? (row === null ? null : 0))
  check(`owner · took out · ${category} · last 12`, 'money', row?.[2], takeLineOf(takeLast12, category) ?? (row === null ? null : 0))
}

const ownerLoansBox = findTable(ownerTab, ['Metric', 'Value'])
check('owner · Total lent to the owner', 'money', rowLabelled(ownerLoansBox, 'Total lent to the owner')?.[1], loanBook.lent.amount)
check('owner · Total repaid', 'money', rowLabelled(ownerLoansBox, 'Total repaid')?.[1], loanBook.repaid.amount)
check('owner · Outstanding', 'money', rowLabelled(ownerLoansBox, 'Outstanding')?.[1], loanBook.outstanding.amount)
check('owner · Open loans', 'count', rowLabelled(ownerLoansBox, 'Open loans')?.[1], loanBook.openCount)
check('owner · Oldest open loan', 'text', rowLabelled(ownerLoansBox, 'Oldest open loan')?.[1], loanBook.oldestOpen)

const loansTab = gridOf('owner-loans')
const loanList = findTable(loansTab, ['Lent', 'Amount', 'Repaid', 'Status'])
const loanCount = Math.max(loanList?.rows.length ?? 0, loanBook.loans.length)
for (let index = 0; index < loanCount; index += 1) {
  const row = loanList?.rows[index]
  const loan = loanBook.loans[index]
  const metric = `owner-loans · loan ${index + 1}`
  check(`${metric} · lent`, 'date', row?.[0], loan?.lentOn ?? null)
  check(`${metric} · amount`, 'money', row?.[1], loan?.amount ?? null)
  check(`${metric} · repaid`, 'date', row?.[2], loan?.repaidOn ?? null)
  check(`${metric} · status`, 'text', row?.[3], loan?.status ?? null)
}
const loanSums = findTable(loansTab, ['Sums', null])
check('owner-loans · Total lent', 'money', rowLabelled(loanSums, 'Total lent')?.[1], loanBook.lent.amount)
check('owner-loans · Total repaid', 'money', rowLabelled(loanSums, 'Total repaid')?.[1], loanBook.repaid.amount)
check('owner-loans · Outstanding', 'money', rowLabelled(loanSums, 'Outstanding')?.[1], loanBook.outstanding.amount)

const taxesTab = gridOf('taxes')
const cadenceBox = findTable(taxesTab, ['Metric', 'Value'])
const contributions = payrollCadence(transactions, packCategories, window).find((cadence) => cadence.category === 'payroll-contributions')
const partMonthPaid = contributions?.months.some((month) => month.month === window.partMonth && month.state === 'paid') ? 1 : 0
const notYetDue = { rule: '#2', why: `${window.partMonth} is still running, so it is not due yet and not counted` }
check('taxes · Months with a contributions payment', 'count', rowLabelled(cadenceBox, 'Months with a contributions payment')?.[1], contributions?.monthsPaid ?? null, contributions === undefined
  ? undefined
  : { ...notYetDue, sheetDefinition: contributions.monthsPaid + partMonthPaid })
check('taxes · Months elapsed since the first', 'count', rowLabelled(cadenceBox, 'Months elapsed since the first')?.[1], contributions?.monthsElapsed ?? null, contributions === undefined
  ? undefined
  : { ...notYetDue, sheetDefinition: contributions.monthsElapsed + 1 })
check('taxes · Months with no payment', 'count', rowLabelled(cadenceBox, 'Months with no payment')?.[1], contributions?.monthsMissed ?? null, contributions === undefined
  ? undefined
  : { ...notYetDue, sheetDefinition: contributions.monthsElapsed + 1 - contributions.monthsPaid - partMonthPaid })

const taxesAllTime = taxByType(bookings, packCategories, allTimePeriod, window)
/** The Sheet's typical month takes every ledger month, the part-months at either end included. */
const sheetTypical = (category) => typicalMonthlyAmount(taxesAllTime.months.map((month) => month.byCategory[category]?.amount ?? 0))
const typicalRule = { rule: '#2 and #4', why: 'part-months are never averaged' }
check('taxes · Typical monthly contributions', 'money', rowLabelled(cadenceBox, 'Typical monthly contributions')?.[1], contributions?.typicalMonth ?? null, {
  ...typicalRule,
  sheetDefinition: sheetTypical('payroll-contributions'),
})
const payrollTax = taxesAllTime.types.find((type) => type.category === 'payroll-tax')
check('taxes · Typical monthly payroll tax', 'money', rowLabelled(cadenceBox, 'Typical monthly payroll tax')?.[1], payrollTax?.typicalMonth ?? null, {
  ...typicalRule,
  sheetDefinition: sheetTypical('payroll-tax'),
})
const rateLast12 = effectiveTaxRate(bookings, packCategories, last12Period, window)
check('taxes · Effective rate, last 12 months', 'percent', rowLabelled(cadenceBox, 'Effective rate, last 12 months')?.[1], rateLast12.rate)
check('dashboard · Tax on every euro earned', 'ratio', tileValue(dashboard, 'Tax on every euro earned'), rateLast12.rate, {
  rule: '#1',
  why: 'net taxes over client revenue, not over all income',
  sheetDefinition: averages.last12.totals.income === 0 ? null : averages.last12.totals.taxes / averages.last12.totals.income,
})

const TAX_COLUMNS = [
  ['Payroll contributions', 'payroll-contributions'],
  ['Payroll tax', 'payroll-tax'],
  ['Corporate income tax', 'corporate-income-tax'],
  ['Dividend tax', 'dividend-tax'],
]
const taxMonthly = findTable(taxesTab, ['Month', ...TAX_COLUMNS.map(([label]) => label), 'Total'])
for (const month of union(taxMonthly?.rows.map((row) => row[0]) ?? [], taxesAllTime.months.map((entry) => entry.month))) {
  const row = rowLabelled(taxMonthly, month)
  const entry = taxesAllTime.months.find((candidate) => candidate.month === month)
  TAX_COLUMNS.forEach(([label, category], offset) => {
    check(`taxes · ${month} · ${label}`, 'money', row?.[offset + 1], entry === undefined ? null : (entry.byCategory[category]?.amount ?? 0))
  })
  check(`taxes · ${month} · total`, 'money', row?.[TAX_COLUMNS.length + 1], entry?.total.amount ?? null)
}

// outgoing: invoices against the revenue credits that paid them ---------------------------------

const outgoing = gridOf('outgoing')
const register = invoiceRegister()
const clients = workbook.clients.length > 0 ? workbook.clients : [{ slug: 'nlc', name: '', ibans: sheetClientIbans() }]
const receivables = receivablesOf(transactions, packCategories, register, clients)
const credits = transactions.filter((transaction) => packCategories.some((category) => category.slug === transaction.category && category.roles.includes('revenue')) && transaction.amount > 0)
/** The Sheet's own definition pools every revenue credit against the one register, whoever sent it. */
const pooled = receivablesOf(transactions, packCategories, register.map((invoice) => ({ ...invoice, client: 'everyone' })), [
  { slug: 'everyone', name: '', ibans: [...new Set(credits.map((credit) => credit.counterpartyIban))] },
]).clients[0]
const sumOver = (field) => receivables.clients.reduce((total, entry) => total + entry[field], 0)
const unattributed = receivables.unattributedCredits.length > 0
  ? { rule: 'Invoices and clients', why: `${receivables.unattributedCredits.length} revenue credit(s) from an IBAN no client names are unattributed, not pooled` }
  : null
const pooledCorrection = (figure) => (unattributed === null ? undefined : { ...unattributed, sheetDefinition: figure })

const outgoingSums = findTable(outgoing, ['Sums', null])
check('dashboard · Invoices outstanding', 'money', tileValue(dashboard, 'Invoices outstanding'), sumOver('outstanding'), pooledCorrection(pooled.outstanding))
check('outgoing · Outstanding', 'money', rowLabelled(outgoingSums, 'Outstanding')?.[1], sumOver('outstanding'), pooledCorrection(pooled.outstanding))
check('outgoing · Overpaid by client', 'money', rowLabelled(outgoingSums, 'Overpaid by client')?.[1], sumOver('overpaid'), pooledCorrection(pooled.overpaid))
check(
  'outgoing · Overpayments refunded by us',
  'money',
  rowLabelled(outgoingSums, 'Overpayments refunded by us')?.[1],
  sumOver('refunded'),
  receivables.unattributedRefunds.length === 0
    ? undefined
    : { rule: 'Invoices and clients', why: 'refunds to an IBAN no client names are not a client’s', sheetDefinition: sumOver('refunded') - receivables.unattributedRefunds.reduce((total, refund) => total + refund.transaction.amount, 0) },
)
check(
  'outgoing · Credits with no filed invoice PDF',
  'money',
  rowLabelled(outgoingSums, 'Credits with no filed invoice PDF')?.[1],
  sumOver('creditsWithNoInvoice'),
  pooledCorrection(pooled.creditsWithNoInvoice),
)

const matchedByRow = new Map(receivables.clients.flatMap((entry) => entry.invoices.map((matched) => [matched.invoice.sheetRow, matched])))
const registerList = findTable(outgoing, ['Number', 'Item', 'Amount', 'Invoiced', 'Received', 'Status', 'Note'])
registerList?.rows.forEach((row, index) => {
  const matched = workbook.invoices.length > 0
    ? receivables.clients.flatMap((entry) => entry.invoices).find((candidate) => candidate.invoice.number === String(row[0]))
    : matchedByRow.get(index + 3)
  const metric = `outgoing · invoice ${row[0]}`
  check(`${metric} · received`, 'date', row[4], matched?.received ?? null)
  check(`${metric} · status`, 'text', row[5], matched?.status ?? null)
  check(`${metric} · note`, 'text', row[6] === '' ? null : row[6], matched === undefined ? null : sheetNoteOf(matched))
})
for (const matched of receivables.clients.flatMap((entry) => entry.invoices)) {
  if (!registerList?.rows.some((row) => String(row[0]) === matched.invoice.number)) {
    check(`outgoing · invoice ${matched.invoice.number} · status`, 'text', null, matched.status)
  }
}

const paidAllTime = daysToPaid(receivables.clients.flatMap((entry) => entry.invoices), null)
check('dashboard · Days to get paid', 'ratio', tileValue(dashboard, 'Days to get paid'), paidAllTime.median, {
  rule: '#5',
  why: 'the median over the invoices paid in the period, with the mean in the tooltip',
  sheetDefinition: paidAllTime.mean,
})

/** The note the Sheet writes beside an invoice: "partially paid", then each overpayment newest first. */
function sheetNoteOf(matched) {
  const overpaid = matched.overpayments.map((overpayment) => `overpaid +${(overpayment.amount / 100).toFixed(2)} on ${overpayment.payment.transaction.date}`)
  const note = `${matched.status === 'partial' ? 'partially paid ' : ''}${overpaid.join('; ')}`.trim()
  return note === '' ? null : note
}

/** The `invoices` tab, or for an export from before it, the register the refresh copies into `outgoing!A3:D`. */
function invoiceRegister() {
  if (workbook.invoices.length > 0) {
    console.log(`invoices: ${workbook.invoices.length} rows from the invoices tab, ${workbook.clients.length} clients from the clients tab`)
    return workbook.invoices
  }
  const rows = outgoing.slice(2).map((cells, index) => ({ cells, sheetRow: index + 3 })).filter(({ cells }) => !isBlank(cells[0]))
  console.log(`invoices: no invoices tab, so ${rows.length} rows from outgoing!A3:D, all for one client, nlc`)
  return rows.map(({ cells, sheetRow }) => ({
    number: String(cells[0]),
    client: 'nlc',
    item: String(cells[1] ?? ''),
    amount: Math.round(Number(cells[2]) * 100),
    issued: civilDateFromSerial(Number(cells[3])),
    due: null,
    sheetRow,
  }))
}

/** The client's IBANs for an export without a clients tab: the revenue rules' IBANs, or CLIENT_IBANS in the Apps Script. */
function sheetClientIbans() {
  const revenue = new Set(packCategories.filter((category) => category.roles.includes('revenue')).map((category) => category.slug))
  const fromRules = workbook.rules.flatMap((rule) =>
    rule.enabled && revenue.has(rule.category) ? rule.conditions.flatMap((condition) => (condition.column === 'counterparty_iban' ? [condition.iban] : [])) : [],
  )
  if (fromRules.length > 0) {
    console.log(`clients: no clients tab, so nlc pays from the ${new Set(fromRules).size} IBAN(s) the revenue rules name`)
    return [...new Set(fromRules)]
  }
  for (const name of readdirSync(options.scripts).filter((file) => file.endsWith('.gs')).sort()) {
    const constant = /const CLIENT_IBANS = \[([^\]]*)\]/.exec(readFileSync(join(options.scripts, name), 'utf8'))
    if (constant !== null) {
      const ibans = [...constant[1].matchAll(/'([^']+)'/g)].map((match) => normaliseIban(match[1]))
      console.log(`clients: no clients tab and no revenue rules, so nlc pays from the ${ibans.length} IBAN(s) of CLIENT_IBANS in ${name}`)
      return ibans
    }
  }
  console.error(`The export has no clients tab and no revenue rules, and no .gs file in ${options.scripts} defines CLIENT_IBANS. Pass --scripts with an older copy of the project.`)
  process.exit(2)
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
  if (kind === 'ratio' || kind === 'percent') {
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
if (!exportHasRoles) {
  console.log('The export has no roles column, so the pack read the category lists of Code.gs.')
}
if (workbook.problems.length > 0) {
  console.log(`The reader left out ${workbook.problems.length} row(s):`)
  for (const problem of workbook.problems) {
    console.log(`  ${problem.tab} row ${problem.sheetRow}: ${problem.reason}`)
  }
}
process.exitCode = mismatches > 0 ? 1 : 0
