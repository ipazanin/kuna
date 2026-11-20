import { describe, expect, it } from 'vitest'

import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import { publishedMoneyWithOwner } from '../src/apps/company/transactions/application/publishedMoneyWithOwner'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { FAKE_OWNER, fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { SPENDING_DOCUMENT } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { FAKE_OWNER_IBAN, fakeSpendingDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending'
import { civil } from './fixtures/ledger'

const SYNCED = '2026-11-18T08:00:00.000Z'
const company = readDocument({ id: 'fake', source: 'browser', title: 'Fake workbook', syncedAt: SYNCED }, fakeWorkbookDocument(SYNCED, 'browser', fakeStaffOf('one-employee'))).workbook
const spending = SPENDING_DOCUMENT.read({
  meta: { id: 'fake', source: 'browser', title: 'Fake', syncedAt: SYNCED, lastExportedAt: null, unexportedSince: null },
  revision: '1',
  document: fakeSpendingDocument(SYNCED, 'company', civil('2026-11-18')),
}).workbook

describe("the fake Spending set paid by the fake Company's owner pay", () => {
  it("keeps its account on the IBAN Company's fake pays its owner on", () => {
    expect(FAKE_OWNER_IBAN).toBe(FAKE_OWNER.iban)
    expect(spending.accounts.filter((account) => account.iban === FAKE_OWNER_IBAN)).toHaveLength(1)
  })

  it('links a row to a ledger row Company with one employee pays its owner, on the day and of the amount of that payment', () => {
    const payments = publishedMoneyWithOwner(company)?.payments ?? []
    const linked = spending.items.filter((item) => item.link?.app === 'company' && item.link.kind === 'ledger-row')

    expect(linked).toHaveLength(1)
    for (const item of linked) {
      const payment = payments.find((candidate) => candidate.link.key === item.link?.key && candidate.link.kind === item.link?.kind)
      const row = spending.transactions.find((candidate) => candidate.id === item.transaction)
      expect(payment?.day).toBe(row?.date)
      expect(payment?.amount).toBe(row?.amount)
    }
  })

  it('links money out to a cost Company with one employee keeps as an owner advance, on its day and of its amount', () => {
    const advances = publishedMoneyWithOwner(company)?.advances ?? []
    const linked = spending.items.filter((item) => item.link?.kind === 'hr-doo.owner-advance')

    expect(linked).toHaveLength(1)
    for (const item of linked) {
      const advance = advances.find((candidate) => candidate.link.key === item.link?.key)
      const row = spending.transactions.find((candidate) => candidate.id === item.transaction)
      expect(advance?.day).toBe(row?.date)
      expect(advance?.amount).toBe(-(row?.amount ?? 0))
    }
  })
})
