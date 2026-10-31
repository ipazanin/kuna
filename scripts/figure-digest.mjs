/**
 * Reads the books through the app's read path, runs the engines behind each screen for a fixed day,
 * and prints one line per group of figures: its name, how many entries it holds and a short SHA-256
 * of them. It never prints a figure, so it is safe on a real export, and two trees compare with diff.
 *
 *   npm run check:figures -- --fake <drive, browser, one-employee or five-employees> [--today yyyy-mm-dd]
 *   npm run check:figures -- --workbook <path to an xlsx export or a Kuna file> [--today yyyy-mm-dd]
 *   npm run check:figures -- --loans <path to a Kuna Loans file> [--today yyyy-mm-dd]
 *   npm run check:figures -- --fake-loans <sample or house-and-car> [--today yyyy-mm-dd]
 *   npm run check:figures -- --investments <path to a Kuna Investments file> [--investments-prices <path to its prices file>] [--today yyyy-mm-dd]
 *   npm run check:figures -- --fake-investments sample [--today yyyy-mm-dd]
 *
 * A Loans or an Investments input goes with the others or alone, and its groups follow the company's, Loans before
 * Investments. An Investments file without its prices file is valued with no closes and no rates.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { billingTotals } from '../src/apps/company/billingPlan/domain/billingTotals.ts'
import { expectedInvoices } from '../src/apps/company/billingPlan/domain/expectedInvoices.ts'
import { fillRestOfYear } from '../src/apps/company/billingPlan/domain/fillRestOfYear.ts'
import { itemStatistics } from '../src/apps/company/billingPlan/domain/itemStatistics.ts'
import { plannedAgainstInvoiced } from '../src/apps/company/billingPlan/domain/plannedAgainstInvoiced.ts'
import { balanceSeries, latestBalances } from '../src/apps/company/cash/domain/balances.ts'
import { DEFAULT_FILTERS, periodRange, transactionsInPeriod } from '../src/apps/company/filters/domain/filterState.ts'
import { priorEqualPeriod } from '../src/apps/company/filters/domain/periodComparison.ts'
import { averagedPeriod, periodMonths } from '../src/apps/company/filters/domain/periodPresets.ts'
import { euroSplit } from '../src/apps/company/overview/domain/euroSplit.ts'
import { headline } from '../src/apps/company/overview/domain/headline.ts'
import { runway } from '../src/apps/company/overview/domain/runway.ts'
import { recentChange, windowAverages } from '../src/apps/company/overview/domain/windowAverages.ts'
import { waitingJobs } from '../src/apps/company/overview/presentation/waitingForYou.ts'
import { withOwnerParts } from '../src/apps/company/owner-share/domain/ownerParts.ts'
import { installedPack } from '../src/apps/company/packs/packContribution.ts'
import { categoryChanges } from '../src/apps/company/period-review/domain/categoryChanges.ts'
import { periodReview, reviewPeriodOf } from '../src/apps/company/period-review/domain/periodReview.ts'
import { ageingOf, amountsOwed } from '../src/apps/company/receivables/domain/ageing.ts'
import { daysToPaid } from '../src/apps/company/receivables/domain/daysToPaid.ts'
import { receivablesOf } from '../src/apps/company/receivables/domain/invoiceMatching.ts'
import { withoutDismissed } from '../src/apps/company/review/domain/dismissedSuggestions.ts'
import { categorise } from '../src/apps/company/rules/domain/categorise.ts'
import { ruleCoverage } from '../src/apps/company/rules/domain/ruleCoverage.ts'
import { categorisationContextOf } from '../src/apps/company/rules/domain/transactionFacts.ts'
import { accountUses, categoryUses } from '../src/apps/company/settings/application/namedRecordWrites.ts'
import { amountLocaleOf, unreadSettingKeys } from '../src/apps/company/settings/domain/settings.ts'
import { categoryTotals } from '../src/apps/company/spending/domain/categoryTotals.ts'
import { costGroups } from '../src/apps/company/spending/domain/costGroups.ts'
import { topCounterparties } from '../src/apps/company/spending/domain/topCounterparties.ts'
import { presentedWorkbook } from '../src/apps/company/transactions/application/presentedWorkbook.ts'
import { advancesLeftOutByBankFilters, filterTransactions, scopeOwnerAdvances, scopeTransactions } from '../src/apps/company/transactions/domain/filterTransactions.ts'
import { listedRows } from '../src/apps/company/transactions/domain/listedRows.ts'
import { groupTransactions } from '../src/apps/company/transactions/domain/transactionGroups.ts'
import { monthlyProfitAndLoss } from '../src/apps/company/trends/domain/monthlyProfitAndLoss.ts'
import { bucketTotals } from '../src/apps/company/workbook/domain/bucketTotals.ts'
import { counterpartyLabels } from '../src/apps/company/workbook/domain/counterpartyIdentity.ts'
import { needsReview } from '../src/apps/company/workbook/domain/needsReview.ts'
import { recordsOfKindIn } from '../src/apps/company/workbook/domain/readWorkbook.ts'
import { recordsOf } from '../src/shared/storage/domain/recordsRead.ts'
import { bookingOfAdvance, ledgerWindowOf, newestBookingOf } from '../src/apps/company/workbook/domain/workbook.ts'
import { decodeDocument } from '../src/shared/storage/infrastructure/documentFormat.ts'
import { COMPANY_APP, readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument.ts'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook.ts'
import { documentOfTabs } from '../src/apps/company/workbook/infrastructure/spreadsheetDocument.ts'
import { readWorkbookFile } from '../src/apps/company/workbook/infrastructure/workbookFile.ts'
import { accrualYear } from '../src/apps/company/packs/hr-doo/domain/accrual/accrualYear.ts'
import { assetBooks, depreciationByYear, doubledRatesEffect } from '../src/apps/company/packs/hr-doo/domain/assets/assetBooks.ts'
import { assetRegister } from '../src/apps/company/packs/hr-doo/domain/assets/assetRegister.ts'
import { accumulatedDepreciationOn, bookValueOn } from '../src/apps/company/packs/hr-doo/domain/assets/depreciationSchedule.ts'
import { dividendCapacity } from '../src/apps/company/packs/hr-doo/domain/dividend/dividendCapacity.ts'
import { effectiveTaxRate } from '../src/apps/company/packs/hr-doo/domain/effectiveTaxRate.ts'
import { forecastYear, planDefaults } from '../src/apps/company/packs/hr-doo/domain/forecast/forecastYear.ts'
import { planAgainstActual } from '../src/apps/company/packs/hr-doo/domain/forecast/planAgainstActual.ts'
import { clawbackExposure, deferredOn, grantResiduals } from '../src/apps/company/packs/hr-doo/domain/grants/grantRelease.ts'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart.ts'
import { owedInPeriod } from '../src/apps/company/packs/hr-doo/domain/owedInPeriod.ts'
import { ownerBenefits, dividendComparison } from '../src/apps/company/packs/hr-doo/domain/ownerBenefits.ts'
import { ownerCost } from '../src/apps/company/packs/hr-doo/domain/ownerCost.ts'
import { loanMonths } from '../src/apps/company/packs/hr-doo/domain/ownerLoans.ts'
import { ownerNetWithProfit } from '../src/apps/company/packs/hr-doo/domain/ownerNetWithProfit.ts'
import { netPayPerMonth, ownerTake, ownerTakeByMonth } from '../src/apps/company/packs/hr-doo/domain/ownerTake.ts'
import { payrollCadence } from '../src/apps/company/packs/hr-doo/domain/payrollCadence.ts'
import { salaryReconciliation } from '../src/apps/company/packs/hr-doo/domain/salaries/salaryReconciliation.ts'
import { payScenarios } from '../src/apps/company/packs/hr-doo/domain/scenarios/payScenarios.ts'
import { taxByType } from '../src/apps/company/packs/hr-doo/domain/taxByType.ts'
import { compareYearEnd } from '../src/apps/company/packs/hr-doo/domain/yearEnd/yearEndComparison.ts'
import { yearEndOpenItems } from '../src/apps/company/packs/hr-doo/domain/yearEnd/yearEndOpenItems.ts'
import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff.ts'
import { missingAccrualRoles } from '../src/apps/company/packs/hr-doo/presentation/accrualRoles.ts'
import { packWaitingJobs } from '../src/apps/company/packs/hr-doo/presentation/packWaitingJobs.ts'
import { paydayYears, salaryYearRows } from '../src/apps/company/packs/hr-doo/presentation/salaries/salariesView.ts'
import { unaccountedInView } from '../src/apps/company/packs/hr-doo/presentation/unaccountedInView.ts'
import { yearOptions } from '../src/apps/company/packs/hr-doo/presentation/year/yearChoice.ts'
import { ruleValue } from '../src/apps/company/packs/hr-doo/ruleset/ruleset.ts'
import { civilDate, parseCivilDate, yearOf } from '../src/shared/calendar/civilDate.ts'
import { yearOfMonth } from '../src/shared/calendar/monthKey.ts'
import { setMoneyFormat } from '../src/shared/money/moneyFormat.ts'
import { paidSoFar, paymentsByYear, splitOfRows } from '../src/apps/loans/bankLoans/domain/loanFigures.ts'
import { whatIfExtraPayment } from '../src/apps/loans/bankLoans/domain/whatIf.ts'
import { offerEks } from '../src/apps/loans/scenarios/domain/effectiveRate.ts'
import { moveBreakEven, scenarioOutcome } from '../src/apps/loans/scenarios/domain/scenarioOutcome.ts'
import { scenarioBaseOf, scenarioPlan } from '../src/apps/loans/scenarios/domain/scenarioPlan.ts'
import { againstBase, scenarioCards, scenarioKey, scenarioRows, scenarioTabs, slotted, tabComparison, workedScenarios } from '../src/apps/loans/scenarios/presentation/scenariosView.ts'
import { askedSlots, pickedOf, slotCount } from '../src/apps/loans/scenarios/presentation/useScenarioCompare.ts'
import { rateOfText } from '../src/apps/loans/bankLoans/domain/yearlyRate.ts'
import { bankLoanFigures, bankLoanMonths, planYears } from '../src/apps/loans/bankLoans/presentation/bankLoanView.ts'
import { informalBalances } from '../src/apps/loans/informalLoans/domain/informalBalance.ts'
import { informalLoanFigures, informalLoanMonths, movementLines } from '../src/apps/loans/informalLoans/presentation/informalLoanView.ts'
import { debtFreeOn, estimateFrom, interestAfter, interestInYear, outgoingByMonth, owedByMonth, plannedLoans, upcomingPayments } from '../src/apps/loans/overview/domain/loansTogether.ts'
import { owedTotals } from '../src/apps/loans/overview/presentation/owedTotals.ts'
import { fakeLoansDocument } from '../src/apps/loans/workbook/infrastructure/fake/fakeLoans.ts'
import { LOANS_DOCUMENT } from '../src/apps/loans/workbook/infrastructure/loansDocument.ts'
import { moneyFromAmount } from '../src/shared/money/money.ts'
import { latestRecords } from '../src/apps/investments/holdings/domain/latestRecords.ts'
import { figuresClose, portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures.ts'
import { gainSources, incomeAgainstLastYear, lastDayMovers, pricesNotice, valueByClass, valueByCurrency } from '../src/apps/investments/overview/domain/overviewFigures.ts'
import { valueOverTime } from '../src/apps/investments/overview/domain/valueOverTime.ts'
import { benchmarkState, comparedBenchmark } from '../src/apps/investments/performance/domain/benchmark.ts'
import { performancePeriods } from '../src/apps/investments/performance/domain/performancePeriod.ts'
import { dayValuer, firstDepositIn, performanceByYear, portfolioPerformance } from '../src/apps/investments/performance/domain/portfolioPerformance.ts'
import { periodKey } from '../src/apps/investments/performance/presentation/performanceLinks.ts'
import { decodePricesFile, emptyPricesFile } from '../src/apps/investments/prices/domain/pricesFile.ts'
import { pricesFileBook, pricesFileRateBook } from '../src/apps/investments/prices/domain/pricesFileBooks.ts'
import { fakePricesFile } from '../src/apps/investments/prices/infrastructure/fake/fakePrices.ts'
import { fakeInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/fake/fakeInvestments.ts'
import { INVESTMENTS_DOCUMENT } from '../src/apps/investments/workbook/infrastructure/investmentsDocument.ts'
import { installHrDooPack } from './support/installPack.mjs'

const { values: options } = parseArgs({
  options: {
    fake: { type: 'string' },
    workbook: { type: 'string' },
    loans: { type: 'string' },
    'fake-loans': { type: 'string' },
    investments: { type: 'string' },
    'investments-prices': { type: 'string' },
    'fake-investments': { type: 'string' },
    today: { type: 'string', default: '2026-10-28' },
  },
})
const today = parseCivilDate(options.today)
const knownFake = options.fake === 'drive' || options.fake === 'browser' || (options.fake !== undefined && fakeStaffOf(options.fake) !== null)
const companyAsked = options.fake !== undefined || options.workbook !== undefined
const loansAsked = options.loans !== undefined || options['fake-loans'] !== undefined
const investmentsAsked = options.investments !== undefined || options['fake-investments'] !== undefined
if (
  (options.fake !== undefined && options.workbook !== undefined) ||
  (options.loans !== undefined && options['fake-loans'] !== undefined) ||
  (options.investments !== undefined && options['fake-investments'] !== undefined) ||
  (options['investments-prices'] !== undefined && options.investments === undefined) ||
  (!companyAsked && !loansAsked && !investmentsAsked) ||
  (options.fake !== undefined && !knownFake) ||
  (options['fake-loans'] !== undefined && options['fake-loans'] !== 'sample' && options['fake-loans'] !== 'house-and-car') ||
  (options['fake-investments'] !== undefined && options['fake-investments'] !== 'sample') ||
  today === null
) {
  console.error(
    'Usage: npm run check:figures -- [--fake <drive, browser, one-employee or five-employees> | --workbook <path to .xlsx or .json>] [--loans <path to .json> | --fake-loans <sample or house-and-car>] [--investments <path to .json> [--investments-prices <path to .json>] | --fake-investments sample] [--today yyyy-mm-dd]',
  )
  process.exit(2)
}

installHrDooPack()
// An xlsx file gives a ledger row without an id a new one, so the ids count up instead, the same on every run.
let madeIds = 0
crypto.randomUUID = () => `00000000-0000-4000-8000-${String(++madeIds).padStart(12, '0')}`

const AT = '2026-01-01T00:00:00.000Z'
async function documentOfInput() {
  if (options.fake !== undefined) {
    return fakeWorkbookDocument(AT, options.fake === 'browser' ? 'browser' : 'drive', fakeStaffOf(options.fake))
  }
  if (options.workbook.toLowerCase().endsWith('.json')) {
    return decodeDocument(readFileSync(options.workbook, 'utf8'))
  }
  return documentOfTabs(COMPANY_APP, (await readWorkbookFile(readFileSync(options.workbook))).tabs, AT)
}

const groups = []
const group = (name, figures) => groups.push([name, figures])

if (companyAsked) {
  const { records, workbook: raw } = readDocument({ id: 'figures', source: 'browser', title: 'figures', syncedAt: AT }, await documentOfInput())
  setMoneyFormat({ currency: raw.settings.currency, locale: amountLocaleOf(raw.settings) })
  const booked = presentedWorkbook(raw)
  const cash = withOwnerParts(booked)
  const books = hrDooWorkbook(booked)
  const window = ledgerWindowOf(cash.transactions)
  const asOf = newestBookingOf(cash.transactions)
  const scoped = scopeTransactions(cash.transactions, DEFAULT_FILTERS)
  const rows = [...scoped, ...scopeOwnerAdvances(cash.ownerAdvances, DEFAULT_FILTERS).map(bookingOfAdvance)]
  const context = categorisationContextOf(cash)
  const forecastOf = (year) => forecastYear(books, year, asOf)

  group('read.records', records)
  group('read.workbook', raw)
  group('settings.problems', booked.problems)
  group('settings.unread-keys', unreadSettingKeys(recordsOf(records.settings), installedPack().workbook?.settings ?? null))
  group('settings.uses', () => [categoryUses((kind) => recordsOfKindIn(records, kind)), accountUses((kind) => recordsOfKindIn(records, kind))])

  const averages = windowAverages(rows, window)
  const months = monthlyProfitAndLoss(rows, window)
  const balances = latestBalances(cash.transactions)
  group('overview.averages', averages)
  group('overview.recent-change', () => Object.keys(averages.last3.lines).map((line) => recentChange(averages.last3.lines[line].perMonth, averages.last12.lines[line].perMonth)))
  group('overview.balances', [balances, balanceSeries(cash.transactions, window)])
  group('overview.runway', () => [runway(balances.cashOnHand, averages.last3), runway(balances.cashOnHand, averages.last12)])
  group('overview.months', months)
  group('overview.headline', () => headline(months))
  group('overview.euro-split', () => euroSplit(bucketTotals(transactionsInPeriod(rows, { preset: 'l12' }, window)), { preset: 'l12' }))
  group('overview.waiting', () => waitingJobs(booked, raw.transactions))
  group('overview.pack-waiting', () => packWaitingJobs(books, asOf))

  group('review.queue', () =>
    scopeTransactions(raw.transactions, DEFAULT_FILTERS)
      .filter(needsReview)
      .map((row) => categorise(row, cash.rules, context)),
  )
  group('review.rules', () => withoutDismissed(ruleCoverage(raw.transactions, raw.rules, context), raw.dismissals))
  group('review.unaccounted', () => unaccountedInView({ booked, filters: DEFAULT_FILTERS }))

  const invoiceDay = newestBookingOf(raw.transactions)
  const receivables = receivablesOf(booked.transactions, booked.categories, booked.invoices, booked.clients)
  const matched = receivables.clients.flatMap((client) => client.invoices)
  group('invoicing.receivables', receivables)
  group('invoicing.owed', () => [amountsOwed(matched, invoiceDay), receivables.clients.map((client) => ageingOf(client.invoices, invoiceDay))])
  group('invoicing.plan', () => [
    billingTotals(raw.billingPlan, raw.invoices),
    plannedAgainstInvoiced(raw.billingPlan, raw.invoices),
    itemStatistics(raw.billingPlan),
    expectedInvoices(raw.billingPlan, raw.invoices),
  ])
  group('invoicing.fill-year', () => fillRestOfYear(raw.billingPlan, raw.settings.billing, invoiceDay))

  const ledgerYears = Array.from({ length: yearOf(asOf) - yearOfMonth(window.firstMonth) + 1 }, (_, index) => yearOfMonth(window.firstMonth) + index)
  for (const period of [{ preset: 'l3' }, { preset: 'l12' }, { preset: 'all' }, ...ledgerYears.map((year) => ({ preset: 'year', year }))]) {
    const at = period.preset === 'year' ? `year-${period.year}` : period.preset
    const filters = { ...DEFAULT_FILTERS, period }
    const listed = listedRows(filterTransactions(cash.transactions, filters, window), transactionsInPeriod(scopeOwnerAdvances(cash.ownerAdvances, filters), period, window))
    group(`transactions.${at}.listed`, listed)
    group(`transactions.${at}.groups`, () =>
      ['month', 'category', 'counterparty'].map((grouping) => groupTransactions(listed, grouping, { window, counterpartyLabels: counterpartyLabels(cash.transactions) })),
    )
    group(`transactions.${at}.advances-left-out`, advancesLeftOutByBankFilters(booked.ownerAdvances, filters, window))
    const prior = priorEqualPeriod(period, window)
    group(`analysis.${at}.breakdown`, () => [costGroups(categoryTotals(rows, period, window), prior && categoryTotals(rows, prior, window)), topCounterparties(scoped, period, window)])
    group(`analysis.${at}.over-time`, () => months.filter((month) => periodMonths(period, window).includes(month.month)))
    group(`analysis.${at}.compare`, () => {
      const review = periodReview(rows, reviewPeriodOf(period, window), window)
      return [review, categoryChanges(rows, review.current.range, review.prior, window)]
    })
    group(`invoicing.${at}.days-to-paid`, () => daysToPaid(matched, periodRange(period, window)))
    const take = ownerTake(rows, cash.categories, period, window)
    const averaged = averagedPeriod(period, window)
    const averagedTake = ownerTake(rows, cash.categories, averaged, window)
    group(`owner.${at}.taken`, () => [
      take,
      netPayPerMonth(averagedTake, averaged, window),
      ownerTakeByMonth(rows, cash.categories, periodMonths(period, window), window),
      ownerCost(rows, cash.categories, period, window),
    ])
    group(`owner.${at}.benefits`, () => {
      const benefits = ownerBenefits(rows, cash.categories, period, window)
      return [benefits, benefits && books.companyFacts.companyRegistered !== null && dividendComparison(benefits.byYear, 'Benefits', (year) => forecastOf(year).liability.rate)]
    })
    group(`owner.${at}.net`, () =>
      ownerNetWithProfit(averagedTake, books, period, window, asOf, { profitBeforeTax: (year) => forecastOf(year).profitBeforeTax, corporateRate: (year) => forecastOf(year).liability.rate }),
    )
    group(`owner.${at}.owed`, () => [owedInPeriod(books, period, window, asOf), loanMonths(books.transactions, books.categories, periodMonths(period, window), window)])
  }

  const bookings = [...books.transactions, ...books.ownerAdvances.map(bookingOfAdvance)]
  const accountantYears = [...new Set(books.yearEndLines.map((line) => line.year))]
  group('year.roles', missingAccrualRoles(books.categories))
  group('year.payroll-cadence', () => payrollCadence(bookings, books.categories, window))
  for (const { year, view } of yearOptions(accountantYears, yearOfMonth(window.firstMonth), yearOf(asOf))) {
    const yearPeriod = { preset: 'custom', range: { from: civilDate(year, 1, 1), to: civilDate(year, 12, 31) } }
    group(`year.${year}.taxes`, () => [taxByType(bookings, books.categories, yearPeriod, window), effectiveTaxRate(bookings, books.categories, yearPeriod, window)])
    group(`year.${year}.forecast`, () => {
      const forecast = forecastOf(year)
      return [forecast, dividendCapacity(year, forecast, books), planAgainstActual(forecast), planDefaults(books, year, asOf)]
    })
    group(`year.${year}.pay-scenarios`, () => payScenarios(books, year, asOf))
    group(`year.${year}.accrual`, () => {
      const accrual = accrualYear(books, year, { depreciation: books.companyFacts, citAdvancesPaid: null })
      return view === 'closed' ? [accrual, compareYearEnd(books, accrual), yearEndOpenItems(books, accrual)] : accrual
    })
  }
  group('year.assets', () => {
    const asBooks = assetBooks(books.assets, books.grants, books.companyFacts)
    const revenueOf = (year) => effectiveTaxRate(books.transactions, books.categories, { preset: 'custom', range: { from: civilDate(year, 1, 1), to: civilDate(year, 12, 31) } }, window).revenue.amount
    const onToday = [asBooks.schedules.map((schedule) => [bookValueOn(schedule, today), accumulatedDepreciationOn(schedule, today)]), asBooks.grants.map((schedule) => deferredOn(schedule, today))]
    const threshold = ruleValue('hr.cit.asset-threshold', civilDate(yearOf(today), 1, 1))
    return [
      asBooks,
      doubledRatesEffect(books.assets, books.grants, asBooks, revenueOf),
      depreciationByYear(asBooks.schedules),
      assetRegister(books.assets, books.transactions, books.categories),
      onToday,
      books.grants.map((grant) => clawbackExposure(grant, today)),
      grantResiduals(asBooks.grants, books.yearEndLines),
      threshold,
    ]
  })

  const salaryBooks = hrDooWorkbook(raw)
  const reconciliation = salaryReconciliation(salaryBooks)
  group('salaries.paydays', reconciliation)
  group('salaries.years', () => paydayYears(reconciliation).map((year) => salaryYearRows(reconciliation, year, null, ledgerWindowOf(salaryBooks.transactions).partMonth)))
}

if (loansAsked) {
  loansGroups(group)
}

if (investmentsAsked) {
  investmentsGroups(group)
}

/**
 * The Loans groups: the records and problems, then per loan, named by its place in the file and never
 * by its name, the plan or the balances and the figures each screen shows on the day. The what-if
 * tries 1,000.00 extra on the day. The totals are the Overview's figures over every loan. Each scenario
 * is worked out from the day, an offer over its whole loan, with a move's break-even month and an
 * offer's effective rate. The Scenarios screen's tabs each compare their first scenarios against A
 * with savings earning 3%: the side by side, the cards, the bars and the list.
 */
function loansGroups(add) {
  const document = options.loans === undefined ? fakeLoansDocument(AT, options['fake-loans']) : decodeDocument(readFileSync(options.loans, 'utf8'))
  const { records, workbook } = LOANS_DOCUMENT.read({ meta: { id: 'figures', source: 'browser', title: 'figures', syncedAt: AT }, document })
  add('loans.read.records', records)
  add('loans.read.problems', workbook.problems)
  for (const [index, book] of workbook.bankLoans.entries()) {
    const at = `loans.bank-loan-${index + 1}`
    add(`${at}.plan`, book.plan)
    add(`${at}.figures`, () => [bankLoanFigures(book, today), book.plan && paidSoFar(book.plan, book.lateInstalments, today)])
    add(`${at}.years`, () => planYears(book, today))
    add(`${at}.payments`, () => book.plan && [...paymentsByYear(book.plan), splitOfRows(book.plan)])
    add(`${at}.months`, () => bankLoanMonths(book))
    add(`${at}.what-if`, () => whatIfExtraPayment(book, today, moneyFromAmount(1000)))
  }
  for (const [index, { scenario, changes }] of workbook.scenarios.entries()) {
    const at = `loans.scenario-${index + 1}`
    const base = scenarioBaseOf(scenario, workbook.bankLoans)
    const from = scenario.start.kind === 'loan' ? today : null
    const plan = base && scenarioPlan(base, changes, from)
    add(`${at}.plan`, plan)
    add(`${at}.outcome`, () => {
      if (plan === null || 'refused' in plan) return null
      const withoutMove = scenarioPlan(
        base,
        changes.filter((change) => change.kind !== 'move'),
        from,
      )
      return [scenarioOutcome(plan, from), 'refused' in withoutMove ? withoutMove : moveBreakEven(plan, withoutMove), scenario.start.kind === 'offer' ? offerEks(base, changes) : null]
    })
  }
  add('loans.scenarios', () =>
    scenarioTabs(workbook, today).map((tab) => {
      const offers = tab.kind === 'offers'
      const worked = workedScenarios(tab, today)
      const picked = pickedOf(
        askedSlots(
          null,
          tab.scenarios.map((book) => scenarioKey(book.scenario)),
          slotCount(offers),
        ),
        offers,
      )
      const compared = slotted(worked, picked)
      const base = picked[0]?.key ?? ''
      return [tab.value, tabComparison(tab, compared, base, rateOfText('3')), scenarioCards(tab, compared, base, today), againstBase(compared, base), scenarioRows(worked, compared, base)]
    }),
  )
  for (const [index, book] of workbook.informalLoans.entries()) {
    const at = `loans.informal-loan-${index + 1}`
    add(`${at}.balances`, () => informalBalances(book.loan, book.movements))
    add(`${at}.figures`, () => [informalLoanFigures(book, today), movementLines(book)])
    add(`${at}.months`, () => informalLoanMonths(book, today))
  }
  const planned = plannedLoans(workbook.bankLoans)
  add('loans.totals', () => [
    owedTotals({ bank: workbook.bankLoans.map((book) => bankLoanFigures(book, today)), informal: workbook.informalLoans.map((book) => informalLoanFigures(book, today)) }),
    owedByMonth(planned),
    outgoingByMonth(planned),
    upcomingPayments(planned, today),
    interestInYear(planned, yearOf(today)),
    interestAfter(planned, today),
    debtFreeOn(workbook.bankLoans),
    estimateFrom(planned, today),
  ])
}

/** The prices file of an Investments input: the fake one for the fake set, the one given, or none. */
function pricesOfInput() {
  if (options['fake-investments'] !== undefined) {
    return fakePricesFile('sample', today)
  }
  if (options['investments-prices'] === undefined) {
    return emptyPricesFile()
  }
  const read = decodePricesFile(readFileSync(options['investments-prices'], 'utf8'))
  if (read.kind !== 'read') {
    console.error(`The prices file is refused: ${read.reason}`)
    process.exit(2)
  }
  return read.file
}

/**
 * The Investments groups: the records and problems, then per instrument and per account, named by its place in the
 * file and never by its name, what the Overview, Holdings and a holding's page show on the day, then the portfolio's
 * figures, its last day, the Overview's cards and its value over time, then the benchmark's closes, Performance over
 * each period it offers and its returns by year.
 */
function investmentsGroups(add) {
  const document = options.investments === undefined ? fakeInvestmentsDocument(AT) : decodeDocument(readFileSync(options.investments, 'utf8'))
  const { records, workbook } = INVESTMENTS_DOCUMENT.read({ meta: { id: 'figures', source: 'browser', title: 'figures', syncedAt: AT }, document })
  add('investments.read.records', records)
  add('investments.read.problems', workbook.problems)
  const prices = pricesOfInput()
  const sources = { book: workbook.book, prices: pricesFileBook(prices, workbook.book.prices), rates: pricesFileRateBook(prices), today }
  const figures = portfolioFigures(sources)
  for (const [index, instrument] of workbook.book.instruments.entries()) {
    add(`investments.holding-${index + 1}`, figures.holdings.find((holding) => holding.instrument.id === instrument.id) ?? null)
  }
  for (const [index, account] of workbook.book.accounts.entries()) {
    add(
      `investments.account-${index + 1}.cash`,
      figures.cash.filter((balance) => balance.account === account.id),
    )
  }
  const { holdings, cash, lastDay, ...portfolio } = figures
  add('investments.portfolio', portfolio)
  add('investments.last-day', lastDay)
  add('investments.overview', [
    figuresClose(figures),
    pricesNotice(figures),
    gainSources(figures),
    valueByClass(figures),
    valueByCurrency(figures),
    lastDayMovers(figures, 3),
    incomeAgainstLastYear(workbook.book, today),
    latestRecords(workbook.book, sources.rates, 5),
  ])
  add('investments.value-over-time', valueOverTime(sources, { kind: 'all' }))
  const benchmark = benchmarkState(sources)
  add('investments.performance.benchmark', benchmark)
  const compared = comparedBenchmark(benchmark, workbook.book, prices.splits)
  const valuedOn = dayValuer(sources)
  for (const period of performancePeriods(firstDepositIn(workbook.book), today)) {
    add(`investments.performance.${periodKey(period)}`, () => portfolioPerformance(sources, compared, period, valuedOn))
  }
  add('investments.performance.years', () => performanceByYear(sources, compared, valuedOn))
}

const digests = new WeakMap()
const sha256 = (text) => createHash('sha256').update(text).digest('hex')

/** A SHA-256 of the figures as plain data: keys sorted, functions and undefined fields left out, and a part shared by several figures hashed once. */
function digestOf(value) {
  if (value === null || typeof value !== 'object') {
    // A decimal is a bigint, which JSON cannot write, so it is hashed as its digits with an n.
    return sha256(typeof value === 'bigint' ? `${value}n` : typeof value === 'number' && !Number.isFinite(value) ? String(value) : (JSON.stringify(value) ?? String(value)))
  }
  if (!digests.has(value)) {
    const entries =
      value instanceof Map
        ? [...value].map(([key, entry]) => [digestOf(key), entry])
        : value instanceof Set || Array.isArray(value)
          ? [...value].map((entry, index) => [index, entry])
          : Object.keys(value)
              .sort()
              .flatMap((key) => (typeof value[key] === 'function' || value[key] === undefined ? [] : [[key, value[key]]]))
    const shape = value instanceof Map ? 'map' : Array.isArray(value) || value instanceof Set ? 'list' : 'record'
    digests.set(value, sha256(`${shape}(${entries.map(([key, entry]) => `${key}:${digestOf(entry)}`).join(',')})`))
  }
  return digests.get(value)
}

for (const [name, figures] of groups) {
  let value
  try {
    value = typeof figures === 'function' ? figures() : figures
  } catch (failure) {
    value = { threw: failure.name, message: failure.message }
  }
  const count = Array.isArray(value)
    ? value.length
    : value instanceof Map || value instanceof Set
      ? value.size
      : value === null || value === false
        ? 0
        : typeof value === 'object'
          ? Object.keys(value).length
          : 1
  console.log(`${name.padEnd(42)} ${(value?.threw === undefined ? String(count) : 'threw').padStart(6)}  ${digestOf(value).slice(0, 16)}`)
}
