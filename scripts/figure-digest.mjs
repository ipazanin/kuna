/**
 * Reads the books through the app's read path, runs the engines behind each screen for a fixed day,
 * and prints one line per group of figures: its name, how many entries it holds and a short SHA-256
 * of them. It never prints a figure, so it is safe on a real export, and two trees compare with diff.
 *
 *   npm run check:figures -- --fake <drive, browser, browser-donations, one-employee or five-employees> [--today yyyy-mm-dd]
 *   npm run check:figures -- --workbook <path to an xlsx export or a Kuna file> [--today yyyy-mm-dd]
 *   npm run check:figures -- --loans <path to a Kuna Loans file> [--today yyyy-mm-dd]
 *   npm run check:figures -- --fake-loans <sample, house-and-car or equal-principal> [--today yyyy-mm-dd]
 *   npm run check:figures -- --investments <path to a Kuna Investments file> [--investments-prices <path to its prices file>] [--today yyyy-mm-dd]
 *   npm run check:figures -- --fake-investments sample [--today yyyy-mm-dd]
 *   npm run check:figures -- --assets <path to a Kuna Assets file> [--house-index <path to a saved answer of the DZS>] [--today yyyy-mm-dd]
 *   npm run check:figures -- --fake-assets <sample, house-and-car or loan-gone> [--today yyyy-mm-dd]
 *   npm run check:figures -- --spending <path to a Kuna Spending file> [--rates <path to a Kuna exchange rates file>] [--today yyyy-mm-dd]
 *   npm run check:figures -- --fake-spending <sample, foreign, over, statements, cash or receipts> [--today yyyy-mm-dd]
 *
 * A Loans, an Investments, an Assets or a Spending input goes with the others or alone, and its groups follow the
 * company's, in that order. With two or more, a last group adds them up as Net worth does. An Investments file
 * without its prices file is valued with no closes and no rates, and an Assets file without a saved DZS answer as if
 * the house price index failed. The fake Assets sets take the fake index. An asset's loan is read from the Loans input,
 * and without one Loans counts as not set up. A Spending file reads its rates from the
 * exchange rates file, and without one leaves its foreign rows unrated. The fake Spending sets take the fake ECB through
 * the rates file, as the page does.
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
import { vatOnPrivateShare } from '../src/apps/company/packs/hr-doo/domain/vat/vatSplit.ts'
import { installedPack } from '../src/apps/company/packs/packContribution.ts'
import { categoryChanges } from '../src/apps/company/period-review/domain/categoryChanges.ts'
import { periodReview, reviewPeriodOf } from '../src/apps/company/period-review/domain/periodReview.ts'
import { ageingOf, amountsOwed } from '../src/apps/company/receivables/domain/ageing.ts'
import { daysToPaid } from '../src/apps/company/receivables/domain/daysToPaid.ts'
import { receivablesOf } from '../src/apps/company/receivables/domain/invoiceMatching.ts'
import { withoutDismissed } from '../src/apps/company/rules/domain/dismissedSuggestions.ts'
import { categorise } from '../src/shared/categorising/domain/categorise.ts'
import { ruleCoverage } from '../src/apps/company/rules/domain/ruleCoverage.ts'
import { categorisationContextOf } from '../src/apps/company/rules/domain/categorisationContext.ts'
import { accountUses, categoryUses } from '../src/apps/company/settings/application/namedRecordWrites.ts'
import { amountLocaleOf, unreadSettingKeys } from '../src/apps/company/settings/domain/settings.ts'
import { categoryTotals } from '../src/apps/company/spending/domain/categoryTotals.ts'
import { costGroups } from '../src/apps/company/spending/domain/costGroups.ts'
import { topCounterparties } from '../src/apps/company/spending/domain/topCounterparties.ts'
import { presentedWorkbook } from '../src/apps/company/transactions/domain/presentedWorkbook.ts'
import { advancesLeftOutByBankFilters, filterTransactions, scopeOwnerAdvances, scopeTransactions } from '../src/apps/company/transactions/domain/filterTransactions.ts'
import { listedRows } from '../src/apps/company/transactions/domain/listedRows.ts'
import { groupTransactions } from '../src/apps/company/transactions/domain/transactionGroups.ts'
import { monthlyProfitAndLoss } from '../src/apps/company/trends/domain/monthlyProfitAndLoss.ts'
import { bucketTotals } from '../src/apps/company/workbook/domain/bucketTotals.ts'
import { counterpartyLabels } from '../src/apps/company/workbook/domain/counterpartyIdentity.ts'
import { needsReview } from '../src/apps/company/workbook/domain/needsReview.ts'
import { recordsOfKindIn } from '../src/apps/company/workbook/domain/readWorkbook.ts'
import { rowsOfOneItem } from '../src/apps/company/workbook/domain/splits.ts'
import { storesItems } from '../src/apps/company/workbook/domain/rowItems.ts'
import { recordsOf } from '../src/shared/storage/domain/recordsRead.ts'
import { bookingOfAdvance, ledgerWindowOf, newestBookingOf } from '../src/apps/company/workbook/domain/workbook.ts'
import { decodeDocument } from '../src/shared/storage/infrastructure/documentFormat.ts'
import { COMPANY_APP } from '../src/apps/company/workbook/domain/companyApp.ts'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument.ts'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook.ts'
import { documentOfTabs } from '../src/apps/company/workbook/infrastructure/spreadsheetDocument.ts'
import { readWorkbookFile } from '../src/apps/company/workbook/infrastructure/workbookFile.ts'
import { accrualYear } from '../src/apps/company/packs/hr-doo/domain/accrual/accrualYear.ts'
import { assetBooks, depreciationByYear, doubledRatesEffect } from '../src/apps/company/packs/hr-doo/domain/assets/assetBooks.ts'
import { assetCostsOf, assetRegister } from '../src/apps/company/packs/hr-doo/domain/assets/assetRegister.ts'
import { accumulatedDepreciationOn, bookValueOn } from '../src/apps/company/packs/hr-doo/domain/assets/depreciationSchedule.ts'
import { dividendCapacity } from '../src/apps/company/packs/hr-doo/domain/dividend/dividendCapacity.ts'
import { effectiveTaxRate } from '../src/apps/company/packs/hr-doo/domain/effectiveTaxRate.ts'
import { forecastNeed, forecastYear, planDefaults } from '../src/apps/company/packs/hr-doo/domain/forecast/forecastYear.ts'
import { planAgainstActual } from '../src/apps/company/packs/hr-doo/domain/forecast/planAgainstActual.ts'
import { clawbackExposure, deferredOn, grantResiduals } from '../src/apps/company/packs/hr-doo/domain/grants/grantRelease.ts'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart.ts'
import { owedInPeriod } from '../src/apps/company/packs/hr-doo/domain/owedInPeriod.ts'
import { ownerBenefits, dividendComparison } from '../src/apps/company/packs/hr-doo/domain/ownerBenefits.ts'
import { ownerCost } from '../src/apps/company/packs/hr-doo/domain/ownerCost.ts'
import { loanMonths } from '../src/apps/company/packs/hr-doo/domain/ownerLoans.ts'
import { ownerNetWithProfit } from '../src/apps/company/packs/hr-doo/domain/ownerNetWithProfit.ts'
import { netPayPerMonth, ownerTake, ownerTakeByMonth } from '../src/apps/company/packs/hr-doo/domain/ownerTake.ts'
import { unaccountedInView } from '../src/apps/company/packs/hr-doo/domain/ownerAdvances.ts'
import { payrollCadence } from '../src/apps/company/packs/hr-doo/domain/payrollCadence.ts'
import { salaryReconciliation } from '../src/apps/company/packs/hr-doo/domain/salaries/salaryReconciliation.ts'
import { payScenarios, payScenariosNeed } from '../src/apps/company/packs/hr-doo/domain/scenarios/payScenarios.ts'
import { missingAccrualRoles } from '../src/apps/company/packs/hr-doo/domain/accrual/accrualRoles.ts'
import { packWaiting } from '../src/apps/company/packs/hr-doo/domain/packWaiting.ts'
import { paydayYears, salaryYearRows } from '../src/apps/company/packs/hr-doo/domain/salaries/salaryFigures.ts'
import { nextTripNumber } from '../src/apps/company/packs/hr-doo/domain/trips/tripDefaults.ts'
import { tripSettlement } from '../src/apps/company/packs/hr-doo/domain/trips/tripSettlement.ts'
import { tripWarnings } from '../src/apps/company/packs/hr-doo/domain/trips/tripWarnings.ts'
import { filedBySettlement, tripRowProblems, tripRowSuggestions, tripRowsSplit } from '../src/apps/company/packs/hr-doo/domain/trips/tripBankRows.ts'
import { tripReports } from '../src/apps/company/packs/hr-doo/domain/trips/tripPayments.ts'
import { taxByType } from '../src/apps/company/packs/hr-doo/domain/taxByType.ts'
import { yearOptions } from '../src/apps/company/packs/hr-doo/domain/yearChoice.ts'
import { compareYearEnd } from '../src/apps/company/packs/hr-doo/domain/yearEnd/yearEndComparison.ts'
import { yearEndOpenItems } from '../src/apps/company/packs/hr-doo/domain/yearEnd/yearEndOpenItems.ts'
import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff.ts'
import { ruleValue } from '../src/apps/company/packs/hr-doo/ruleset/ruleset.ts'
import { civilDate, parseCivilDate, yearOf } from '../src/shared/calendar/civilDate.ts'
import { addMonths, monthOf, monthsFrom, yearOfMonth } from '../src/shared/calendar/monthKey.ts'
import { setMoneyFormat } from '../src/shared/money/moneyFormat.ts'
import { paidSoFar, paymentsByYear, splitOfRows } from '../src/apps/loans/bankLoans/domain/loanFigures.ts'
import { triedRate, whatIfChange, whatIfExtraPayment } from '../src/apps/loans/bankLoans/domain/whatIf.ts'
import { offerEks } from '../src/apps/loans/scenarios/domain/effectiveRate.ts'
import { moveBreakEven, scenarioOutcome } from '../src/apps/loans/scenarios/domain/scenarioOutcome.ts'
import { scenarioBaseOf, scenarioPlan } from '../src/apps/loans/scenarios/domain/scenarioPlan.ts'
import { MOST_COMPARED, askedSlots, pickedOf } from '../src/apps/loans/scenarios/domain/scenarioSlots.ts'
import { scenarioKey, workedOffers } from '../src/apps/loans/scenarios/domain/workedScenario.ts'
import { offersComparison, scenarioRows, slotted } from '../src/apps/loans/scenarios/presentation/scenariosView.ts'
import { rateOfText } from '../src/apps/loans/bankLoans/domain/yearlyRate.ts'
import { bankLoanFigures, bankLoanMonths, bankLoanPaidOffOn } from '../src/apps/loans/bankLoans/domain/bankLoanFigures.ts'
import { statementPaymentsFrom } from '../src/apps/loans/bankLoans/application/statementPayments.ts'
import { instalmentStandings } from '../src/apps/loans/bankLoans/domain/instalmentPayments.ts'
import { bankLoanMoves, planYearsOnScreen } from '../src/apps/loans/bankLoans/presentation/bankLoanView.ts'
import { savedTries } from '../src/apps/loans/bankLoans/presentation/savedTries.ts'
import { planStanding, plannedOwed } from '../src/apps/loans/informalLoans/domain/expectedPlan.ts'
import { informalBalances } from '../src/apps/loans/informalLoans/domain/informalBalance.ts'
import { informalClosedOn, informalLoanFigures, informalLoanMonths } from '../src/apps/loans/informalLoans/domain/informalLoanFigures.ts'
import { informalLoanMoves, movementLines } from '../src/apps/loans/informalLoans/presentation/informalLoanView.ts'
import { debtFreeOn, estimateFrom, interestAfter, interestInYear, outgoingByMonth, owedByMonth, plannedLoans, upcomingPayments } from '../src/apps/loans/overview/domain/loansTogether.ts'
import { owedOnDay } from '../src/apps/loans/overview/domain/owedTotals.ts'
import { bankLoansOf, loanTargetsOf } from '../src/apps/loans/facts.ts'
import { loansNetWorthParts } from '../src/apps/loans/home/domain/loansNetWorthParts.ts'
import { fakeLoansDocument } from '../src/apps/loans/workbook/infrastructure/fake/fakeLoans.ts'
import { LOANS_APP, LOANS_DOCUMENT } from '../src/apps/loans/workbook/infrastructure/loansDocument.ts'
import { moneyFromAmount } from '../src/shared/money/money.ts'
import { closedPositions } from '../src/apps/investments/holdings/domain/closedPositions.ts'
import { accountIntakes } from '../src/apps/investments/imports/domain/accountIntake.ts'
import { holdingMix, holdingMixes } from '../src/apps/investments/holdings/domain/holdingMix.ts'
import { depositSplit, targetGaps, targetedMix } from '../src/apps/investments/holdings/domain/targetMix.ts'
import { incomeForecast } from '../src/apps/investments/income/domain/incomeForecast.ts'
import { latestRecords } from '../src/apps/investments/holdings/domain/latestRecords.ts'
import { investingRhythm } from '../src/apps/investments/income/domain/investingRhythm.ts'
import { recentCosts, yearlyCosts } from '../src/apps/investments/income/domain/yearlyCosts.ts'
import { figuresClose, portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures.ts'
import { gainSources, incomeAgainstLastYear, lastDayMovers, pricesNotice } from '../src/apps/investments/overview/domain/overviewFigures.ts'
import { portfolioChecks } from '../src/apps/investments/overview/domain/portfolioChecks.ts'
import { valueOverTime } from '../src/apps/investments/overview/domain/valueOverTime.ts'
import { benchmarkState, comparedBenchmark } from '../src/apps/investments/performance/domain/benchmark.ts'
import { performancePeriods } from '../src/apps/investments/performance/domain/performancePeriod.ts'
import { monthlyReturns } from '../src/apps/investments/performance/domain/monthlyReturns.ts'
import { periodGains } from '../src/apps/investments/performance/domain/periodGains.ts'
import { dayValuer, firstDepositIn, performanceByYear, portfolioPerformance } from '../src/apps/investments/performance/domain/portfolioPerformance.ts'
import { underwater } from '../src/apps/investments/performance/domain/underwater.ts'
import { foreignIncomeYear } from '../src/apps/investments/tax/domain/foreignIncome.ts'
import { capitalGainsYear, taxYearsOf } from '../src/apps/investments/tax/domain/taxYear.ts'
import { periodKey } from '../src/apps/investments/performance/presentation/performanceLinks.ts'
import { fetchedFactsBook } from '../src/apps/investments/prices/domain/factsBook.ts'
import { decodePricesFile, emptyPricesFile } from '../src/apps/investments/prices/domain/pricesFile.ts'
import { pricesFileBook, pricesFileRateBook } from '../src/apps/investments/prices/domain/pricesFileBooks.ts'
import { fakePricesFile } from '../src/apps/investments/prices/infrastructure/fake/fakePrices.ts'
import { fakeInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/fake/fakeInvestments.ts'
import { MIXES } from '../src/apps/investments/workbook/domain/mixGroup.ts'
import { INVESTMENTS_DOCUMENT } from '../src/apps/investments/workbook/infrastructure/investmentsDocument.ts'
import { investmentsHubFigures } from '../src/apps/investments/home/presentation/investmentsHubFigures.ts'
import { assetsHubFigures } from '../src/apps/assets/home/presentation/assetsHubFigures.ts'
import { houseIndexOfAnswer } from '../src/apps/assets/houseIndex/infrastructure/dzsHouseIndex.ts'
import { FAKE_HOUSE_INDEX_ANSWER } from '../src/apps/assets/houseIndex/infrastructure/fake/fakeHouseIndex.ts'
import { assetLoansOf } from '../src/apps/assets/loans/application/assetLoans.ts'
import { assetsOnDay, assetsTotal } from '../src/apps/assets/values/presentation/assetsOnDay.ts'
import { ASSETS_DOCUMENT } from '../src/apps/assets/workbook/infrastructure/assetsDocument.ts'
import { fakeAssetsDocument } from '../src/apps/assets/workbook/infrastructure/fake/fakeAssets.ts'
import { rowLinksOf } from '../src/apps/spending/facts.ts'
import { accountOnDay } from '../src/apps/spending/rates/domain/euroRows.ts'
import { receiptMatches } from '../src/apps/spending/receipts/domain/receiptMatch.ts'
import { SAMPLE_RECEIPT_TOTALS } from '../src/apps/spending/receipts/infrastructure/fake/sampleReceiptPhoto.ts'
import { revolutStatement } from '../src/apps/spending/statements/domain/revolutStatement.ts'
import { reviewQueue } from '../src/apps/spending/statements/domain/reviewQueue.ts'
import { withCashLeg } from '../src/apps/spending/pairing/domain/cashWithdrawals.ts'
import { itemizedRow } from '../src/apps/spending/workbook/domain/rowItems.ts'
import { readBanks } from '../src/apps/spending/bankSync/application/bankRead.ts'
import { startDays, startedAccount } from '../src/apps/spending/bankSync/domain/bankAccountSetup.ts'
import { balanceDifferences } from '../src/apps/spending/bankSync/domain/bankBalance.ts'
import { fakeBankSync } from '../src/apps/spending/bankSync/infrastructure/fake/fakeBankSync.ts'
import { rowsAfterDryRun, statementDryRun } from '../src/apps/spending/statements/domain/statementDryRun.ts'
import { SAMPLE_REVOLUT_FILE_NAME, sampleRevolutCsv } from '../src/apps/spending/statements/infrastructure/fake/sampleRevolutFiles.ts'
import { readFirstSheet } from '../src/shared/xlsx/sheetGrids.ts'
import { ratesNeeded } from '../src/apps/spending/rates/domain/ratesNeeded.ts'
import { monthFlow } from '../src/apps/spending/analytics/domain/monthFlow.ts'
import { spendingFigures } from '../src/apps/spending/analytics/presentation/spendingFigures.ts'
import { spendingHubFigures } from '../src/apps/spending/home/presentation/spendingHubFigures.ts'
import { fakeSpendingDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending.ts'
import { SPENDING_APP } from '../src/apps/spending/workbook/domain/spendingBooks.ts'
import { SPENDING_DOCUMENT } from '../src/apps/spending/workbook/infrastructure/spendingDocument.ts'
import { decodeRatesFile, emptyRatesFile } from '../src/shared/rates/domain/ratesFile.ts'
import { everydayBook } from '../src/shared/rates/domain/rateBooks.ts'
import { NO_RATES } from '../src/shared/money/rateBook.ts'
import { fakeRatesState } from '../src/shared/rates/infrastructure/fake/fakeRatesState.ts'
import { personalNet } from '../src/shared/app/personalNet.ts'
import { DEFAULT_MONEY_FORMAT } from '../src/shared/money/moneyFormat.ts'
import { installHrDooPack } from './support/installPack.mjs'
import { companyFiguresOf, investmentsFiguresOf, spendingFiguresOf } from './support/figureFields.mjs'

const { values: options } = parseArgs({
  options: {
    fake: { type: 'string' },
    workbook: { type: 'string' },
    loans: { type: 'string' },
    'fake-loans': { type: 'string' },
    investments: { type: 'string' },
    'investments-prices': { type: 'string' },
    'fake-investments': { type: 'string' },
    assets: { type: 'string' },
    'house-index': { type: 'string' },
    'fake-assets': { type: 'string' },
    spending: { type: 'string' },
    rates: { type: 'string' },
    'fake-spending': { type: 'string' },
    today: { type: 'string', default: '2026-10-28' },
  },
})
const today = parseCivilDate(options.today)
const knownFake = ['drive', 'browser', 'browser-donations'].includes(options.fake) || (options.fake !== undefined && fakeStaffOf(options.fake) !== null)
const companyAsked = options.fake !== undefined || options.workbook !== undefined
const loansAsked = options.loans !== undefined || options['fake-loans'] !== undefined
const investmentsAsked = options.investments !== undefined || options['fake-investments'] !== undefined
const assetsAsked = options.assets !== undefined || options['fake-assets'] !== undefined
const spendingAsked = options.spending !== undefined || options['fake-spending'] !== undefined
if (
  (options.fake !== undefined && options.workbook !== undefined) ||
  (options.loans !== undefined && options['fake-loans'] !== undefined) ||
  (options.investments !== undefined && options['fake-investments'] !== undefined) ||
  (options['investments-prices'] !== undefined && options.investments === undefined) ||
  (options.assets !== undefined && options['fake-assets'] !== undefined) ||
  (options['house-index'] !== undefined && options.assets === undefined) ||
  (options.spending !== undefined && options['fake-spending'] !== undefined) ||
  (options.rates !== undefined && options.spending === undefined) ||
  (!companyAsked && !loansAsked && !investmentsAsked && !assetsAsked && !spendingAsked) ||
  (options.fake !== undefined && !knownFake) ||
  (options['fake-loans'] !== undefined && !['sample', 'house-and-car', 'equal-principal'].includes(options['fake-loans'])) ||
  (options['fake-investments'] !== undefined && options['fake-investments'] !== 'sample') ||
  (options['fake-assets'] !== undefined && !['sample', 'house-and-car', 'loan-gone'].includes(options['fake-assets'])) ||
  (options['fake-spending'] !== undefined && !['sample', 'foreign', 'over', 'statements', 'cash', 'receipts'].includes(options['fake-spending'])) ||
  today === null
) {
  console.error(
    'Usage: npm run check:figures -- [--fake <drive, browser, browser-donations, one-employee or five-employees> | --workbook <path to .xlsx or .json>] [--loans <path to .json> | --fake-loans <sample, house-and-car or equal-principal>] [--investments <path to .json> [--investments-prices <path to .json>] | --fake-investments sample] [--assets <path to .json> [--house-index <path to .json>] | --fake-assets <sample, house-and-car or loan-gone>] [--spending <path to .json> [--rates <path to kuna-rates.json>] | --fake-spending <sample, foreign, over, statements, cash or receipts>] [--today yyyy-mm-dd]',
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
    return fakeWorkbookDocument(AT, options.fake.startsWith('browser') ? 'browser' : 'drive', fakeStaffOf(options.fake), options.fake.endsWith('donations'))
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
  const cash = withOwnerParts(booked, vatOnPrivateShare)
  const books = hrDooWorkbook(booked)
  const window = ledgerWindowOf(cash.transactions)
  const asOf = newestBookingOf(cash.transactions)
  const scoped = scopeTransactions(cash.transactions, DEFAULT_FILTERS)
  const rows = [...scoped, ...scopeOwnerAdvances(cash.ownerAdvances, DEFAULT_FILTERS).map(bookingOfAdvance)]
  const context = categorisationContextOf(cash)
  const forecastOf = (year) => forecastYear(books, year, asOf)
  // Where the forecast waits for a fact, Year shows what it needs in its place, and a group holds that need instead of figures.
  const forecastWaits = forecastNeed(books)

  group('read.records', companyFiguresOf(records))
  // The categories' other fields, which the digest of a category leaves out, so a change to the tab still shows here.
  group('read.workbook', [raw, raw.categories.map((category) => [category.label, category.family, category.colour.stored, category.roles])])
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
  group('overview.pack-waiting', () => packWaiting(books, asOf))

  group('review.queue', () =>
    scopeTransactions(raw.transactions, DEFAULT_FILTERS)
      .filter(needsReview)
      .map((row) => categorise(row, cash.rules, context)),
  )
  group('review.rules', () => withoutDismissed(ruleCoverage(rowsOfOneItem(raw.transactions, raw.splits), raw.rules, context), raw.dismissals))
  group('review.unaccounted', () => unaccountedInView(books, DEFAULT_FILTERS))

  const invoiceDay = newestBookingOf(raw.transactions)
  const receivables = receivablesOf(booked)
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
      return [benefits, benefits && forecastWaits === null && dividendComparison(benefits.byYear, 'Benefits', (year) => forecastOf(year).liability.rate)]
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
      if (forecastWaits !== null) return { needs: forecastWaits }
      const forecast = forecastOf(year)
      return [forecast, dividendCapacity(year, forecast, books), planAgainstActual(forecast), planDefaults(books, year, asOf)]
    })
    group(`year.${year}.pay-scenarios`, () => {
      const need = payScenariosNeed(books)
      return need === null ? payScenarios(books, year, asOf) : { needs: need }
    })
    group(`year.${year}.accrual`, () => {
      const accrual = accrualYear(books, year, { depreciation: books.companyFacts, citAdvancesPaid: null })
      return view === 'closed' ? [accrual, compareYearEnd(books, accrual), yearEndOpenItems(books, accrual)] : accrual
    })
  }
  group('year.assets', () => {
    const asBooks = assetBooks(books.assets, books.grants, books.companyFacts, ruleValue, assetCostsOf(books).costOf)
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

  const salaryBooks = books
  const reconciliation = salaryReconciliation(salaryBooks)
  group('salaries.paydays', reconciliation)
  group('salaries.years', () => paydayYears(reconciliation).map((year) => salaryYearRows(reconciliation, year, null, ledgerWindowOf(salaryBooks.transactions).partMonth)))

  if (salaryBooks.trips.length > 0) {
    group('trips.settlements', () => salaryBooks.trips.map((file) => [file.trip.number, tripSettlement(file, ruleValue)]))
    group('trips.warnings', () => salaryBooks.trips.map((file) => tripWarnings(file, salaryBooks.employees.find((employee) => employee.slug === file.trip.traveller) ?? null, ruleValue)))
    group('trips.code-17', () => tripReports(salaryBooks.trips, ruleValue, NO_RATES))
    group('trips.bank-rows', () =>
      salaryBooks.trips.map((file) => {
        const settlement = tripSettlement(file, ruleValue)
        const worked = settlement.kind === 'worked' ? settlement : null
        const traveller = salaryBooks.employees.find((employee) => employee.slug === file.trip.traveller) ?? null
        const trips = salaryBooks.trips.map((entry) => entry.trip)
        const split = worked === null ? null : tripRowsSplit(file, worked, salaryBooks, salaryBooks.categories, storesItems(records))
        return {
          number: file.trip.number,
          problems: tripRowProblems([file.trip], salaryBooks),
          suggestions: tripRowSuggestions(file, worked, traveller, trips, salaryBooks).map((suggestion) => [suggestion.link, suggestion.row.id]),
          split: split === null || 'refused' in split ? split : split.rows.map((row) => ({ link: row.link, parts: row.parts, filed: filedBySettlement(row) })),
        }
      }),
    )
    group('trips.next-number', () =>
      nextTripNumber(
        today,
        salaryBooks.trips.map((file) => file.trip),
      ),
    )
  }
}

const loans = loansAsked ? loansGroups(group) : null
const personal = [
  ...(loans === null ? [] : [{ name: 'Loans', figures: loans.hub }]),
  ...(investmentsAsked ? [{ name: 'Investments', figures: investmentsGroups(group) }] : []),
  ...(assetsAsked ? [{ name: 'Assets', figures: assetsGroups(group, loans?.book ?? null) }] : []),
  ...(spendingAsked ? [{ name: 'Spending', figures: await spendingGroups(group) }] : []),
]
if (personal.length >= 2) {
  group('hub.personal', () => personalNet(personal.map(({ name, figures }) => ({ name, notSetUp: false, currency: DEFAULT_MONEY_FORMAT.currency, figures: figures() }))))
}

/**
 * The Loans groups: the records and problems, then per loan, named by its place in the file and never
 * by its name, the plan or the balances and the figures each screen shows on the day, with what its
 * balance chart marks as dots, and an informal loan's standing against its expected plan with the plan's
 * line of what it would owe at each month end. The what-if
 * tries 1,000.00 extra on the day. The totals are the Overview's figures over every loan, and the
 * closed group the days the loans at zero were paid off or settled. Each scenario
 * is worked out from the day, an offer over its whole loan, with a move's break-even month and an
 * offer's effective rate. Scenarios compares the first offers against A with savings earning 3%: the side
 * by side and the list. Each bank loan's page lists the tries saved for it and tries a 3% rate from its next due date.
 * The published group is the bank loans Loans gives another app. The statements group is how each instalment
 * stands against the statement rows linked to it, kept apart so the plan's years and moves read as before
 * statements. Returns how Net worth reads the file, and the loans it read.
 */
function loansGroups(add) {
  const document = options.loans === undefined ? fakeLoansDocument(AT, options['fake-loans']) : decodeDocument(readFileSync(options.loans, 'utf8'))
  const { records, workbook } = LOANS_DOCUMENT.read({ meta: { id: 'figures', source: 'browser', title: 'figures', syncedAt: AT }, document })
  const statements = statementsOfRun()
  add('loans.read.records', records)
  add('loans.read.problems', workbook.problems)
  for (const [index, book] of workbook.bankLoans.entries()) {
    const at = `loans.bank-loan-${index + 1}`
    add(`${at}.plan`, book.plan)
    add(`${at}.figures`, () => [bankLoanFigures(book, today), book.plan && paidSoFar(book.plan, book.lateInstalments, today)])
    add(`${at}.years`, () => planYearsOnScreen(book, today, instalmentStandings(book, [], today)))
    add(`${at}.payments`, () => book.plan && [...paymentsByYear(book.plan), splitOfRows(book.plan)])
    add(`${at}.months`, () => bankLoanMonths(book))
    add(`${at}.what-if`, () => whatIfExtraPayment(book, today, moneyFromAmount(1000)))
    add(`${at}.moves`, () => bankLoanMoves(book, today, instalmentStandings(book, [], today)))
    add(`${at}.statements`, () => instalmentStandings(book, statements, today))
    add(`${at}.saved-tries`, () => savedTries(book, workbook.scenarios, today))
    add(`${at}.what-if-rate`, () => {
      const next = book.plan?.find((row) => row.kind === 'instalment' && row.date > today) ?? null
      return next && whatIfChange(book, triedRate(book, next.date, rateOfText('3')))
    })
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
  add('loans.scenarios', () => {
    const offers = workbook.scenarios.filter(({ scenario }) => scenario.start.kind === 'offer')
    const worked = workedOffers(offers)
    const picked = pickedOf(
      askedSlots(
        null,
        offers.map((book) => scenarioKey(book.scenario)),
        MOST_COMPARED,
      ),
    )
    const compared = slotted(worked, picked)
    const base = picked[0]?.key ?? ''
    return [offersComparison(compared, base, rateOfText('3')), scenarioRows(worked, compared, base)]
  })
  for (const [index, book] of workbook.informalLoans.entries()) {
    const at = `loans.informal-loan-${index + 1}`
    add(`${at}.balances`, () => informalBalances(book.loan, book.movements))
    add(`${at}.figures`, () => [informalLoanFigures(book, today), movementLines(book)])
    add(`${at}.months`, () => informalLoanMonths(book, today))
    add(`${at}.moves`, () => informalLoanMoves(book))
    add(`${at}.plan`, () => planStanding(book.loan, book.movements, today))
    add(`${at}.expected`, () => plannedOwed(book.loan, book.movements, today))
  }
  const planned = plannedLoans(workbook.bankLoans)
  add('loans.totals', () => [
    owedOnDay(workbook, today),
    owedByMonth(planned),
    outgoingByMonth(planned),
    upcomingPayments(planned, workbook.informalLoans, today, Number.POSITIVE_INFINITY),
    interestInYear(planned, yearOf(today)),
    interestAfter(planned, today),
    debtFreeOn(workbook.bankLoans),
    estimateFrom(planned, today),
  ])
  add('loans.closed', () => [workbook.bankLoans.map((book) => bankLoanPaidOffOn(book, today)), workbook.informalLoans.map((book) => informalClosedOn(book, today))])
  add('loans.published', () => bankLoansOf(workbook, today))
  add('loans.published.targets', () => loanTargetsOf(workbook))
  return { hub: () => ({ parts: loansNetWorthParts(workbook, today), notes: [] }), book: workbook }
}

/** The statement rows a Loans run checks its instalments against: those of the Spending file the run names, or of the fake Spending set, which links the fake home loan, for a fake Loans set. */
function statementsOfRun() {
  if (options.spending === undefined && options.loans !== undefined) return []
  const document = options.spending === undefined ? fakeSpendingDocument(AT, options['fake-spending'], today) : decodeDocument(readFileSync(options.spending, 'utf8'))
  const { workbook } = SPENDING_DOCUMENT.read({ meta: { id: 'figures', source: 'browser', title: 'figures', syncedAt: AT }, document })
  return statementPaymentsFrom([{ app: SPENDING_APP, links: rowLinksOf(workbook) }], LOANS_APP)
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
 * The Investments groups: the records, how each account's rows come in and the problems, then per instrument and per account, named by its place in the
 * file and never by its name, what the Overview, Holdings and a holding's page show on the day, then the portfolio's
 * figures, its last day, the Overview's cards, the five mixes, the target mix with what €2,000.00 would buy and the
 * closed positions of Holdings and its value over time, then the benchmark's closes, Performance over each period it
 * offers with where its gain came from and its falls below a peak, its returns by year and by month, the costs, the
 * saving and the Overview's portfolio checks, then each tax year's capital gains and foreign income. Returns how Net
 * worth reads the portfolio.
 */
function investmentsGroups(addGroup) {
  const add = (name, figures) => addGroup(name, typeof figures === 'function' ? () => investmentsFiguresOf(figures()) : investmentsFiguresOf(figures))
  const document = options.investments === undefined ? fakeInvestmentsDocument(AT, 'sample', today) : decodeDocument(readFileSync(options.investments, 'utf8'))
  const { records, workbook } = INVESTMENTS_DOCUMENT.read({ meta: { id: 'figures', source: 'browser', title: 'figures', syncedAt: AT }, document })
  add('investments.read.records', records)
  // How each account's rows come in, as the file says or Kuna reads it, has a group of its own, so the records keep their digest.
  addGroup('investments.read.sources', [...accountIntakes(workbook.book).values()])
  add('investments.read.problems', workbook.problems)
  const prices = pricesOfInput()
  const sources = { book: workbook.book, prices: pricesFileBook(prices, workbook.book.prices), rates: pricesFileRateBook(prices), today }
  const facts = fetchedFactsBook(prices.facts)
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
    holdingMix(figures, workbook.book, facts, 'class').parts,
    holdingMix(figures, workbook.book, facts, 'currency').parts,
    lastDayMovers(figures, 3),
    incomeAgainstLastYear(workbook.book, today),
    latestRecords(workbook.book, sources.rates, 5),
  ])
  for (const mix of MIXES) {
    add(`investments.holdings.mix.${mix}`, holdingMix(figures, workbook.book, facts, mix))
  }
  const targeted = targetedMix(workbook.book.targets)
  if (targeted !== null) {
    const mix = holdingMix(figures, workbook.book, facts, targeted.mix)
    add('investments.holdings.targets', [targetGaps(mix, targeted.targets), depositSplit(mix, targeted.targets, 200_000)])
  }
  add('investments.holdings.closed', closedPositions(figures))
  add('investments.income.coming', incomeForecast(sources, facts).months)
  add('investments.value-over-time', valueOverTime(sources, { kind: 'all' }))
  const benchmark = benchmarkState(sources)
  add('investments.performance.benchmark', benchmark)
  const compared = comparedBenchmark(benchmark, workbook.book, prices.splits)
  const valuedOn = dayValuer(sources)
  const figuresOf = (period) => {
    const performance = portfolioPerformance(sources, compared, period, valuedOn)
    return performance.kind === 'figures' ? performance : null
  }
  for (const period of performancePeriods(firstDepositIn(workbook.book), today)) {
    add(`investments.performance.${periodKey(period)}`, () => portfolioPerformance(sources, compared, period, valuedOn))
    add(`investments.performance.${periodKey(period)}.sources`, () => {
      const performance = figuresOf(period)
      return performance === null ? null : periodGains(sources, performance, valuedOn)
    })
    add(`investments.performance.${periodKey(period)}.falls`, () => underwater(figuresOf(period)?.growth ?? []))
  }
  add('investments.performance.years', () => performanceByYear(sources, compared, valuedOn))
  add('investments.performance.months', () => monthlyReturns(figuresOf({ kind: 'all' })?.growth ?? []))
  add('investments.income.costs', () => yearlyCosts(sources, valuedOn, facts))
  add('investments.income.saving', investingRhythm(workbook.book, today))
  add('investments.overview.checks', () => portfolioChecks(figures, holdingMixes(figures, workbook.book, facts), recentCosts(sources, valuedOn, facts), workbook.book.targets, workbook.book.checks))
  for (const year of taxYearsOf(workbook.book, today)) {
    add(`investments.tax.${year}`, () => capitalGainsYear(workbook.book, sources.rates, year))
    add(`investments.tax.${year}.foreign`, () => foreignIncomeYear(workbook.book, sources.rates, year))
  }
  return () => investmentsHubFigures(figures)
}

/** The house price index of an Assets input: the fake one for a fake set, the saved DZS answer given, or failed without one. */
function houseIndexOfInput() {
  if (options['fake-assets'] !== undefined) {
    return houseIndexOfAnswer(FAKE_HOUSE_INDEX_ANSWER)
  }
  return options['house-index'] === undefined ? 'failed' : houseIndexOfAnswer(JSON.parse(readFileSync(options['house-index'], 'utf8')))
}

/**
 * The Assets groups: the records and problems, then per asset, named by its place in the file and never by its name,
 * its value on the day with how it was reached, and how its loan stands with what is counted and yours, then the total
 * and Net worth's part. Returns how Net worth reads the file.
 */
function assetsGroups(add, loansBook) {
  const document = options.assets === undefined ? fakeAssetsDocument(AT, options['fake-assets']) : decodeDocument(readFileSync(options.assets, 'utf8'))
  const { records, workbook } = ASSETS_DOCUMENT.read({ meta: { id: 'figures', source: 'browser', title: 'figures', syncedAt: AT }, document })
  add('assets.read.records', records)
  add('assets.read.problems', workbook.problems)
  const index = houseIndexOfInput()
  const loans = loansBook === null ? null : assetLoansOf(bankLoansOf(loansBook, today))
  for (const [place, asset] of assetsOnDay(workbook, today, index, loans).entries()) {
    add(`assets.asset-${place + 1}.value`, asset.value)
    add(`assets.asset-${place + 1}.equity`, [asset.link, asset.equity])
  }
  add('assets.totals', () => assetsTotal(workbook, today, index, loans))
  add('assets.hub', () => assetsHubFigures(workbook, today, index, loans))
  return () => assetsHubFigures(workbook, today, index, loans)
}

/** The rates of a Spending input as the page holds them: the fake ECB's through the rates file for a fake set, else the rates file given, or none. */
async function ratesOfInput(workbook) {
  if (options['fake-spending'] !== undefined) {
    return fakeRatesState(ratesNeeded(workbook), today)
  }
  if (options.rates === undefined) {
    return { everyday: everydayBook(emptyRatesFile()), failed: false }
  }
  const read = decodeRatesFile(readFileSync(options.rates, 'utf8'))
  if (read.kind === 'refused') {
    console.error(`The rates file does not read: ${read.reason}.`)
    process.exit(2)
  }
  return { everyday: everydayBook(read.file), failed: false }
}

/**
 * The Spending groups: the records, where each account's rows come from and the problems, then per account, named by its place in the file and never by its
 * name, its balance on the day in its currency and in euros, then income, spending and saved for every month from the
 * oldest row to the day's, then for the newest complete month and the day's month what each category and group counts
 * and each limit with its carry, then Net worth's part. Returns how Net worth reads the file.
 */
async function spendingGroups(addGroup) {
  const add = (name, figures) => addGroup(name, typeof figures === 'function' ? () => spendingFiguresOf(figures()) : spendingFiguresOf(figures))
  const document = options.spending === undefined ? fakeSpendingDocument(AT, options['fake-spending'], today) : decodeDocument(readFileSync(options.spending, 'utf8'))
  const { records, workbook } = SPENDING_DOCUMENT.read({ meta: { id: 'figures', source: 'browser', title: 'figures', syncedAt: AT }, document })
  // The bank's fields and the kinds only statements use have a group of their own, so a file with none of them keeps this digest.
  const { accounts, categories, transactions, budgets, rules } = records
  add('spending.read.records', { accounts, categories, budgets, transactions })
  add('spending.read.statements', {
    rules,
    // A row the bank marks as a withdrawal adds the mark, so a file with none keeps this digest.
    bankFields: transactions.records.map(({ record: { description, counterpartyIban, importKey, statement, categorisedBy, movedAt, pocket, cashWithdrawal } }) => [
      description,
      counterpartyIban,
      importKey,
      statement,
      categorisedBy,
      movedAt,
      pocket,
      ...(cashWithdrawal ? [cashWithdrawal] : []),
    ]),
  })
  add(
    'spending.read.sources',
    accounts.records.map(({ record }) => record.rowsFrom),
  )
  add('spending.read.problems', workbook.problems)
  add('spending.published.links', () => rowLinksOf(workbook))
  const rates = await ratesOfInput(workbook)
  for (const [place, account] of workbook.accounts.entries()) {
    const { balance, euros } = accountOnDay(account, workbook.transactions, today, rates.everyday)
    add(`spending.account-${place + 1}.balance`, [balance, euros])
  }
  const figures = spendingFigures(workbook, rates.everyday)
  const thisMonth = monthOf(today)
  // The book keeps its rows oldest first.
  const oldest = workbook.transactions[0]?.date ?? null
  add('spending.months', () => monthFlow(oldest === null ? [] : monthsFrom(monthOf(oldest), thisMonth).map((month) => figures.totalsOf(month))))
  for (const month of [addMonths(thisMonth, -1), thisMonth]) {
    add(`spending.month.${month}.categories`, () => {
      const { byCategory, byGroup } = figures.totalsOf(month)
      return [byCategory, byGroup]
    })
    add(`spending.budgets.${month}`, () => figures.limitsIn(month))
  }
  add('spending.hub', () => spendingHubFigures(workbook, rates, today))
  add('spending.review', () => reviewQueue(workbook, today))
  add('spending.rules', workbook.rules)
  if (options['fake-spending'] === 'statements') {
    const reading = revolutStatement(await readFirstSheet(sampleRevolutCsv(today)), SAMPLE_REVOLUT_FILE_NAME, workbook)
    add('spending.import.revolut', () => ('statement' in reading ? statementDryRun(workbook, reading.statement, today) : reading))
    // The bank sync reads only accounts the bank fills, which the fake file's are once the sync is set up. `pocket` adds a savings account to the file, so each variant reads the file it is built against.
    const linkedBook = (variant) =>
      SPENDING_DOCUMENT.read({ meta: { id: 'figures', source: 'browser', title: 'figures', syncedAt: AT }, document: fakeSpendingDocument(AT, 'statements', today, variant) }).workbook
    const linked = linkedBook('linked')
    for (const [variant, group] of [
      ['linked', 'spending.import.bank-sync'],
      ['exchange', 'spending.import.bank-sync.exchange'],
      ['pocket', 'spending.import.bank-sync.pocket'],
      ['withdrawal', 'spending.import.bank-sync.withdrawal'],
    ]) {
      const book = variant === 'pocket' ? linkedBook(variant) : linked
      const bankRead = await readBanks(fakeBankSync(variant, today), book, today)
      add(group, () => {
        let place = 0
        return statementDryRun(book, bankRead.statement, today, () => `fa4e3000-0000-4000-8000-${String((place += 1)).padStart(12, '0')}`)
      })
    }
    // The accounts a link drafts, each starting on the day of the fetch and on the earliest day its bank's rows reach, with the opening its bank's rows and balance give then, and the opening a differing balance offers.
    let drafted = 0
    const proposed = await readBanks(fakeBankSync('new-accounts', today), linked, today, [], () => `account:fa4e3100-0000-4000-8000-${String((drafted += 1)).padStart(12, '0')}`)
    add('spending.import.bank-sync.new-accounts', () =>
      proposed.proposals.map((proposal) => [proposal.fetchedOn, startDays(proposal).earliest].map((startsOn) => startedAccount({ proposal, startsOn }))),
    )
    const offBy = await readBanks(fakeBankSync('opening-off', today), linked, today)
    let row = 0
    const offByRun = statementDryRun(linked, offBy.statement, today, () => `fa4e3200-0000-4000-8000-${String((row += 1)).padStart(12, '0')}`)
    add('spending.import.bank-sync.opening-off', () => balanceDifferences(offBy.stated, rowsAfterDryRun(linked.transactions, offByRun), today))
  }
  if (options['fake-spending'] === 'cash') {
    // Each cash account's place, balance and euros on the day once To review's proposed withdrawals have their cash legs, as Move to cash writes them.
    add('spending.review.cash-legs', () => {
      const transfer = workbook.categories.find((category) => category.kind === 'transfer').id
      let place = 0
      const legs = reviewQueue(workbook, today).withdrawals.flatMap(({ row, cashAccounts }) =>
        cashAccounts.length === 1 ? [withCashLeg(itemizedRow(workbook, row), cashAccounts[0], transfer, () => `fa4e3300-0000-4000-8000-${String((place += 1)).padStart(12, '0')}`)] : [],
      )
      const pairedTo = new Map(legs.map(([debit]) => [debit.row.id, debit.row]))
      const rows = [...workbook.transactions.map((row) => pairedTo.get(row.id) ?? row), ...legs.map(([, leg]) => leg.row)]
      return workbook.accounts.flatMap((account, at) => {
        if (account.kind !== 'cash') return []
        const { balance, euros } = accountOnDay(account, rows, today, rates.everyday)
        return [[at + 1, balance, euros]]
      })
    })
  }
  if (options['fake-spending'] === 'receipts') {
    add('spending.receipts.matches', () => Object.values(SAMPLE_RECEIPT_TOTALS).map((total) => receiptMatches({ merchant: '', issuedOn: today, total }, workbook, null)))
  }
  return () => spendingHubFigures(workbook, rates, today)
}

const digests = new WeakMap()
const sha256 = (text) => createHash('sha256').update(text).digest('hex')

/** The fields of a category left out of its hash. Roles, a label, a colour and a family pick or draw categories, so they move a figure only through the figure. */
const CATEGORY_FIELDS_LEFT_OUT = new Set(['roles', 'label', 'colour', 'family'])

function isCategory(value) {
  return ['slug', 'family', 'bucket', 'colour', 'roles', 'vat', 'ownerShare'].every((key) => Object.hasOwn(value, key))
}

/**
 * A SHA-256 of the figures as plain data: keys sorted, functions and undefined fields left out, a
 * category without the fields it is picked or drawn by, and a part shared by several figures hashed once.
 */
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
              .filter((key) => !isCategory(value) || !CATEGORY_FIELDS_LEFT_OUT.has(key))
              .sort()
              .flatMap((key) => (typeof value[key] === 'function' || value[key] === undefined ? [] : [[key, value[key]]]))
    const shape = value instanceof Map ? 'map' : Array.isArray(value) || value instanceof Set ? 'list' : 'record'
    digests.set(value, sha256(`${shape}(${entries.map(([key, entry]) => `${key}:${digestOf(entry)}`).join(',')})`))
  }
  return digests.get(value)
}

const threw = []
for (const [name, figures] of groups) {
  let value
  try {
    value = typeof figures === 'function' ? figures() : figures
  } catch (failure) {
    value = { threw: failure.name, message: failure.message }
    threw.push(`${name}: ${failure.message}`)
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

if (threw.length > 0) {
  console.error(`${threw.length} group(s) threw, so their figures are not compared:\n${threw.join('\n')}`)
  process.exitCode = 1
}
