import { describe, expect, it } from 'vitest'

import { OWNER_ADVANCE_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { isLinkedElsewhere, linkedElsewhereFrom } from '../src/apps/company/transactions/application/spendingSightings'
import { listedRows } from '../src/apps/company/transactions/domain/listedRows'
import { LEDGER_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import type { PublishedRowLink } from '../src/shared/app/rowLinks'
import { accountMoneyOfEuros } from '../src/shared/money/accountMoney'
import { EURO } from '../src/shared/money/currencyCode'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros, ledger } from './fixtures/ledger'

const ROW_ID = '0b5e3c1a-6f0d-4c39-9d5e-2a4b8c7d1e01'
const OTHER_ROW_ID = '0b5e3c1a-6f0d-4c39-9d5e-2a4b8c7d1e02'
const ADVANCE_KEY = '0b5e3c1a-6f0d-4c39-9d5e-2a4b8c7d1e03'

function linked(target: PublishedRowLink['target']): PublishedRowLink {
  return { row: 'row', item: 'row', account: 'account', day: civil('2026-03-04'), amount: accountMoneyOfEuros(euros(2000)), currency: EURO, target }
}

describe('which records Company shows as seen in Spending', () => {
  it("takes the ledger rows and the costs the owner paid any app links to on Company's id, whatever that app is called, and leaves out other kinds and apps", () => {
    const links = [
      linked({ app: 'company', kind: LEDGER_RECORDS.name, key: ROW_ID, due: null }),
      linked({ app: 'company', kind: LEDGER_RECORDS.name, key: ROW_ID, due: null }),
      linked({ app: 'company', kind: OWNER_ADVANCE_RECORDS.name, key: ADVANCE_KEY, due: null }),
      linked({ app: 'company', kind: 'invoice', key: OTHER_ROW_ID, due: null }),
      linked({ app: 'loans', kind: LEDGER_RECORDS.name, key: OTHER_ROW_ID, due: null }),
    ]
    const seen = linkedElsewhereFrom([{ app: 'statements-under-any-id', links }], 'company', OWNER_ADVANCE_RECORDS)

    expect([...seen.rows]).toEqual([ROW_ID])
    expect([...seen.advances]).toEqual([recordIdOf(OWNER_ADVANCE_RECORDS, ADVANCE_KEY)])
    expect([...linkedElsewhereFrom([{ app: 'spending', links }], 'company', null).advances]).toEqual([])
  })

  it('shows nothing as seen while an app that links rows opens, is not set up or failed to open', () => {
    const links = [linked({ app: 'company', kind: LEDGER_RECORDS.name, key: ROW_ID, due: null })]
    const sizes = (apps: Parameters<typeof linkedElsewhereFrom>[0]) => {
      const seen = linkedElsewhereFrom(apps, 'company', OWNER_ADVANCE_RECORDS)
      return seen.rows.size + seen.advances.size
    }

    expect(sizes([{ app: 'spending', links: 'opening' }])).toBe(0)
    expect(sizes([{ app: 'spending', links: null }])).toBe(0)
    expect(
      sizes([
        { app: 'spending', links },
        { app: 'other', links: 'failed' },
      ]),
    ).toBe(0)
  })

  it('marks a bank row by its row id and a cost the owner paid by its id, and never a row that has no row id yet', () => {
    const [row] = ledger([{ date: '2026-03-04', amount: -2000 }])
    if (row === undefined) throw new Error('The ledger has a row.')
    const advanceId = recordIdOf(OWNER_ADVANCE_RECORDS, ADVANCE_KEY)
    const [listedAdvance] = listedRows(
      [],
      [{ date: civil('2026-03-04'), amount: euros(40), description: 'Paper', category: 'office', family: '', bucket: 'operating', ownerShare: null, id: advanceId }],
    )
    const seen = { rows: new Set([ROW_ID]), advances: new Set([advanceId]) }

    expect(isLinkedElsewhere(seen, { ...row, rowId: ROW_ID })).toBe(true)
    expect(isLinkedElsewhere(seen, { ...row, rowId: OTHER_ROW_ID })).toBe(false)
    expect(isLinkedElsewhere(seen, row)).toBe(false)
    expect(listedAdvance !== undefined && isLinkedElsewhere(seen, listedAdvance)).toBe(true)
  })
})
