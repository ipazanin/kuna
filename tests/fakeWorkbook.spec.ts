import { describe, expect, it } from 'vitest'

import { civilDate } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { monthOf } from '../src/shared/calendar/monthKey'
import { expectedInvoices } from '../src/features/billingPlan/domain/expectedInvoices'
import { fillRestOfYear } from '../src/features/billingPlan/domain/fillRestOfYear'
import { plannedAgainstInvoiced } from '../src/features/billingPlan/domain/plannedAgainstInvoiced'
import { latestBalances } from '../src/features/cash/domain/balances'
import { monthlyProfitAndLoss } from '../src/features/trends/domain/monthlyProfitAndLoss'
import { ledgerWindowOf, newestBookingOf } from '../src/features/workbook/domain/workbook'
import type { WorkbookSource } from '../src/features/workbook/domain/workbook'
import { readDocument } from '../src/features/workbook/infrastructure/documentRecordStorage'
import { fakeWorkbookDocument, fakeWorkbookRecords } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { presentedWorkbook } from '../src/features/transactions/application/presentedWorkbook'
import { categorise } from '../src/features/rules/domain/categorise'
import { forecastYear } from '../src/packs/hr-doo/domain/forecast/forecastYear'
import { planAgainstActual } from '../src/packs/hr-doo/domain/forecast/planAgainstActual'
import { ruleCoverage } from '../src/features/rules/domain/ruleCoverage'
import { categorisationContextOf } from '../src/features/rules/domain/transactionFacts'
import { hrDooWorkbook } from '../src/packs/hr-doo/domain/hrDooPart'

const SYNCED = '2026-10-16T08:00:00.000Z'

function fakeBooks(source: WorkbookSource = 'drive') {
  return hrDooWorkbook(readDocument({ id: 'fake', source, title: 'Fake workbook', syncedAt: SYNCED }, fakeWorkbookDocument(SYNCED, source)).workbook)
}

const workbook = fakeBooks()
const window = ledgerWindowOf(workbook.transactions)

describe('fake workbook', () => {
  it('reads cleanly through the app’s own reader', () => {
    expect(workbook.problems).toEqual([])
    expect(window).not.toBeNull()
  })

  it('splits four rows, two of them with the owner’s own part', () => {
    const presented = presentedWorkbook(workbook)

    expect(workbook.splits.map((split) => [split.row.date, split.parts.map((part) => part.category)])).toEqual([
      ['2026-07-12', ['salary-net', 'salary-bonus']],
      ['2026-03-16', ['external-contractors', 'consulting']],
      ['2026-05-10', ['representation', 'owner-loan-out']],
      ['2025-10-02', ['office-supplies', 'owner-loan-out']],
    ])
    expect(workbook.splits.at(-1)?.parts.map((part) => part.amount)).toEqual([-4041, -1345])
    expect(presented.problems).toEqual([])
    expect(presented.transactions).toHaveLength(workbook.transactions.length + 4)
  })

  it('is the same on every run, every ledger row with an id of its own', () => {
    const records = fakeWorkbookRecords()
    const ledgerIds = (records['ledger-row'] ?? []).map((row) => row.id)

    expect(fakeWorkbookRecords()).toEqual(records)
    expect(new Set(ledgerIds).size).toBe(workbook.transactions.length)
    expect(workbook.transactions.every((transaction) => transaction.rowId !== null)).toBe(true)
  })

  it('spans eighteen months from an opening part-month to a part-month at the end', () => {
    const series = monthlyProfitAndLoss(workbook.transactions, window!)

    expect(series).toHaveLength(18)
    expect(series[0].complete).toBe(false)
    expect(series[series.length - 1].complete).toBe(false)
    expect(series.filter((month) => month.complete && month.lines.net.amount < 0).length).toBeGreaterThan(0)
  })

  it('carries the Sheet’s category list and two accounts, one of them closed at zero', () => {
    expect(workbook.categories).toHaveLength(33)
    expect(workbook.categories.find((category) => category.slug === 'vat-refund')).toMatchObject({ bucket: 'operating', roles: ['vat-settlement'] })
    expect(workbook.categories.find((category) => category.slug === 'tax-refund')?.bucket).toBe('taxes')
    expect(workbook.accounts.map((account) => account.slug)).toEqual(['legacy', 'main'])
    const legacy = latestBalances(workbook.transactions).accounts.find((account) => account.account === 'legacy')
    expect(legacy?.balance.amount).toBe(0)
    expect(legacy !== undefined && monthOf(legacy.asOf) < window!.partMonth).toBe(true)
  })

  it('holds a few owner shares: a category default with the benefit category beside it, a row of its own, a split part and an advance', () => {
    expect(workbook.categories.find((category) => category.roles.includes('owner-benefit'))).toMatchObject({ slug: 'benefits-from-company-costs', bucket: 'owner-pay', ownerShare: null })
    expect(workbook.categories.filter((category) => category.ownerShare !== null).map((category) => [category.slug, category.ownerShare])).toEqual([['ai-services', 50]])
    const aiRows = workbook.transactions.filter((row) => row.category === 'ai-services')
    expect(aiRows.length).toBeGreaterThan(0)
    expect(aiRows.every((row) => row.ownerShare === 50)).toBe(true)
    expect(workbook.transactions.filter((row) => row.category !== 'ai-services' && row.ownerShare !== null).map((row) => [row.category, row.ownerShare])).toEqual([['equipment', 30]])
    expect(workbook.splits.flatMap((split) => split.parts).filter((part) => part.ownerShare !== null).map((part) => [part.category, part.ownerShare])).toEqual([['office-supplies', 20]])
    expect(workbook.ownerAdvances.filter((advance) => advance.ownerShare !== null).map((advance) => [advance.category, advance.ownerShare])).toEqual([['software-subscriptions', 25]])
  })

  it('moves money between its own accounts exactly once, as two legs that cancel', () => {
    const legs = workbook.transactions.filter((transaction) => transaction.category === 'internal-transfer')

    expect(legs.map((leg) => leg.account).sort()).toEqual(['legacy', 'main'])
    expect(legs[0].amount + legs[1].amount).toBe(0)
    expect(legs[0].amount).not.toBe(0)
  })

  it('keeps every balance chain intact, newest first with the last booking of a day on top', () => {
    for (const account of ['legacy', 'main']) {
      const oldestFirst = workbook.transactions.filter((transaction) => transaction.account === account).reverse()
      oldestFirst.reduce((previous, transaction) => {
        expect(transaction.balance).toBe(previous + transaction.amount)
        return transaction.balance
      }, 0)
    }
  })

  it('holds rows for review: a guess and an unclassified category', () => {
    expect(workbook.transactions.some((transaction) => transaction.flaggedBy === 'ai' && transaction.bucket === 'unclassified')).toBe(true)
  })

  it('holds the planning tabs of a small company: two assets, a grant that funds one, a year of accountant figures, a plan and four scenarios', () => {
    expect(workbook.assets.map((asset) => [asset.name, asset.fundedBy])).toEqual([
      ['Laptop 14 inch', ''],
      ['Workstation', 'startup-grant'],
    ])
    expect(workbook.grants.map((grant) => grant.slug)).toEqual(['startup-grant'])
    expect(new Set(workbook.yearEndLines.map((line) => line.statement))).toEqual(new Set(['pl', 'balance', 'tax', 'distribution', 'grant', 'konto']))
    expect(workbook.planLines.some((line) => line.kind === 'owner-pay-scenario')).toBe(true)
    expect(workbook.payScenarios.map((scenario) => scenario.slug)).toEqual(['floor-salary', 'floor-extras', 'floor-then-board', 'early-exit'])
    expect(workbook.invoices.filter((invoice) => invoice.deliveryPeriod !== null).length).toBeGreaterThan(10)
  })

  it('holds a billing plan that Northwind’s invoices bill in full up to October, and none for Lumen’s invoices', () => {
    const [lumen, northwind] = plannedAgainstInvoiced(workbook.billingPlan, workbook.invoices)
    const inBrowser = fakeBooks('browser')

    expect(new Set(workbook.billingPlan.map((row) => row.item))).toEqual(
      new Set(['Part Time Fee', 'Monthly Fee', 'Bonus', 'Plane Tickets', 'Hotel', 'External Contractor', 'Subscription']),
    )
    expect(northwind?.withoutPlan).toEqual([])
    expect(northwind?.months.flatMap((month) => month.items.filter((item) => item.open > 0).map((item) => [item.row.date, item.row.item]))).toEqual([
      ['2026-10-31', 'Monthly Fee'],
      ['2026-10-31', 'Subscription'],
    ])
    expect(lumen?.withoutPlan).toHaveLength(3)
    expect(expectedInvoices(workbook.billingPlan, workbook.invoices).map((invoice) => [invoice.month, invoice.client])).toEqual([['2026-10', 'northwind']])
    expect(inBrowser.settings.billing.client).toBe('northwind')
    expect(fillRestOfYear(inBrowser.billingPlan, inBrowser.settings.billing, civilDate(2026, 10, 16))).toMatchObject({ kind: 'rows', rows: { length: 4 } })
  })

  it('plans 2027 so the forecast switches the owner pay to board-only the day after the grant’s employment date, with a purchase and a dividend', () => {
    const inBrowser = fakeBooks('browser')
    const asOf = newestBookingOf(inBrowser.transactions) as CivilDate
    const forecast = forecastYear(inBrowser, 2027, asOf)

    expect(inBrowser.problems.filter((problem) => problem.tab === 'plan')).toEqual([])
    expect(forecast.notModelled).toEqual([])
    expect(forecast.ownerPay?.plan.switchOn).toBe('2027-09-15')
    expect(forecast.ownerPay?.salaryDropped).toEqual([])
    expect(forecast.plannedAssets.map((asset) => asset.name)).toEqual(['Replacement laptop, planned'])
    expect(forecast.plannedDividend?.month).toBe('2027-06')
    expect(planAgainstActual(forecastYear(inBrowser, 2026, asOf)).map((line) => line.key)).toContain('ai-services')
  })

  it('names a Zagreb resident in the company facts of its browser variant, and leaves the Drive one on the defaults', () => {
    const inBrowser = fakeBooks('browser')

    expect(inBrowser.problems).toEqual([])
    expect(inBrowser.companyFacts).toMatchObject({ residenceCity: 'Zagreb', companyRegistered: '2025-05-12' })
    expect(workbook.companyFacts.residenceCity).toBe('')
  })

  it('uses no real IBAN, only the fake ones', () => {
    const ibans = new Set(workbook.transactions.map((transaction) => transaction.counterpartyIban).filter((iban) => iban !== ''))

    expect([...ibans].every((iban) => iban.startsWith('XX00FAKE'))).toBe(true)
  })

  it('has a rules tab that reproduces every row flagged rule, and confirmed rows no rule covers yet', () => {
    const context = categorisationContextOf(workbook)
    const byRule = workbook.transactions.filter((transaction) => transaction.flaggedBy === 'rule')

    expect(workbook.rules.length).toBeGreaterThan(10)
    expect(byRule.filter((transaction) => categorise(transaction, workbook.rules, context).category !== transaction.category)).toEqual([])
    expect(ruleCoverage(workbook.transactions, workbook.rules, context).notCovered.length).toBeGreaterThan(3)
  })
})
