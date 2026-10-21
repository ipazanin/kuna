import { describe, expect, it } from 'vitest'

import { waitingJobs } from '../src/features/overview/presentation/waitingForYou'
import { presentedWorkbook } from '../src/features/transactions/application/presentedWorkbook'
import { fakeWorkbookSnapshot } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader'
import type { Workbook } from '../src/features/workbook/domain/workbook'

function fake(source: 'google' | 'excel'): Workbook {
  return readWorkbook(fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z', source))
}

function jobsOf(workbook: Workbook) {
  return waitingJobs(presentedWorkbook(workbook), workbook.transactions).map((job) => [job.key, job.text, job.tone, job.link.label])
}

describe('waiting for you', () => {
  it('names each job with the page that does it, the late ones as late', () => {
    expect(jobsOf(fake('google'))).toEqual([
      ['review', '2 rows wait for a category check', 'warning', 'Review'],
      ['unaccounted', 'A reimbursement to the owner has no cost on file', 'warning', 'Review'],
      ['invoice', "This month's invoice for Northwind Analytics is not made yet", 'warning', 'Billing plan'],
      ['overdue', '2 invoices are past the due date, €4,200.00 still owed', 'negative', 'Receivables'],
    ])
  })

  it('links the invoice to its month of the billing plan', () => {
    const workbook = fake('google')
    const invoice = waitingJobs(presentedWorkbook(workbook), workbook.transactions).find((job) => job.key === 'invoice')

    expect(invoice?.link.to).toEqual({ path: '/billing', query: { year: '2026', month: '2026-10' }, hash: '#billing-month-2026-10' })
  })

  it('holds the corporate tax against its schedule once the company has a registration day', () => {
    expect(jobsOf(fake('excel')).at(-1)).toEqual(['corporate-tax', 'A corporate tax payment is overdue, €447.50 still owed', 'negative', 'Taxes'])
  })

  it('leaves the owner pay jobs out while the module is off', () => {
    const workbook = fake('excel')
    const off = { ...workbook, settings: { ...workbook.settings, ownerPayModule: false } }

    expect(jobsOf(off).map(([key]) => key)).toEqual(['review', 'invoice', 'overdue'])
  })
})
