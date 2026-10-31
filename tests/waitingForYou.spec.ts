import { describe, expect, it } from 'vitest'

import { waitingJobs } from '../src/apps/company/overview/presentation/waitingForYou'
import { presentedWorkbook } from '../src/apps/company/transactions/application/presentedWorkbook'
import { fakeWorkbookSnapshot } from './fixtures/fakeBooks'
import { readSnapshot } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import type { Workbook } from '../src/apps/company/workbook/domain/workbook'

function fake(source: 'drive' | 'browser'): Workbook {
  return readSnapshot(fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z', source)).workbook
}

function withoutContributions(workbook: Workbook, months: readonly string[]): Workbook {
  return { ...workbook, transactions: workbook.transactions.filter((row) => row.category !== 'payroll-contributions' || !months.includes(row.date.slice(0, 7))) }
}

function jobsOf(workbook: Workbook) {
  return waitingJobs(presentedWorkbook(workbook), workbook.transactions).map((job) => [job.key, job.text, job.tone, job.link.label])
}

describe('waiting for you', () => {
  it('names each job with the page that does it, the late ones as late, the pack jobs after the core ones', () => {
    expect(jobsOf(fake('drive'))).toEqual([
      ['review', '2 rows wait for a category check', 'warning', 'To review'],
      ['invoice', "This month's invoice for Northwind Analytics is not made yet", 'warning', 'Invoicing'],
      ['overdue', '2 invoices are past the due date, €4,200.00 still owed', 'negative', 'Invoices'],
      ['unaccounted', 'A reimbursement to the owner has no cost on file', 'warning', 'To review'],
    ])
  })

  it('links the rows to review and the reimbursements with no cost to the To review tab of Transactions', () => {
    const workbook = fake('drive')
    const links = waitingJobs(presentedWorkbook(workbook), workbook.transactions)
      .filter((job) => job.key === 'review' || job.key === 'unaccounted')
      .map((job) => job.link.to)

    expect(links).toEqual(['/company/transactions?tab=review', '/company/transactions?tab=review'])
  })

  it('links the invoice to its month on the Plan tab of Invoicing', () => {
    const workbook = fake('drive')
    const invoice = waitingJobs(presentedWorkbook(workbook), workbook.transactions).find((job) => job.key === 'invoice')

    expect(invoice?.link.to).toEqual({ path: '/company/invoicing', query: { tab: 'plan', year: '2026', month: '2026-10' }, hash: '#billing-month-2026-10' })
  })

  it('holds the corporate tax against its schedule once the company has a registration day', () => {
    expect(jobsOf(fake('browser')).at(-1)).toEqual(['corporate-tax', 'A corporate tax payment is overdue, €447.50 still owed', 'negative', 'Year, Taxes'])
  })

  it('links the corporate tax to its card on the Taxes tab of Year', () => {
    const workbook = fake('browser')
    const tax = waitingJobs(presentedWorkbook(workbook), workbook.transactions).find((job) => job.key === 'corporate-tax')

    expect(tax?.link.to).toEqual({ path: '/company/year', query: { tab: 'taxes' }, hash: '#corporate-tax' })
  })

  it('flags a complete month with no payroll contribution, linking to the payroll cadence', () => {
    const workbook = withoutContributions(fake('drive'), ['2026-03'])
    const payroll = waitingJobs(presentedWorkbook(workbook), workbook.transactions).find((job) => job.key === 'payroll')

    expect(payroll).toEqual({
      key: 'payroll',
      text: 'Payroll contributions: no payment landed in March',
      tone: 'negative',
      link: { label: 'Year, Taxes', to: { path: '/company/year', query: { tab: 'taxes' }, hash: '#payroll-cadence' } },
    })
  })

  it('counts every missed payroll month and names the latest, last year with its year', () => {
    const workbook = withoutContributions(fake('drive'), ['2025-11', '2025-12'])

    expect(jobsOf(workbook).find(([key]) => key === 'payroll')).toEqual(['payroll', 'Payroll contributions: no payment landed in 2 months, the latest December 2025', 'negative', 'Year, Taxes'])
  })

  it('says nothing of the payroll while every complete month has a payment', () => {
    expect(jobsOf(fake('drive')).map(([key]) => key)).not.toContain('payroll')
  })

  it('leaves the owner pay jobs out while the module is off', () => {
    const workbook = fake('browser')
    const off = { ...workbook, settings: { ...workbook.settings, ownerPayModule: false } }

    expect(jobsOf(off).map(([key]) => key)).toEqual(['review', 'invoice', 'overdue'])
  })
})
