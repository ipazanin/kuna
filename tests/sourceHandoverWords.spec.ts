import { describe, expect, it } from 'vitest'

import type { SourceHandover } from '../src/apps/spending/accounts/domain/sourceHandover'
import { handoverWords } from '../src/apps/spending/accounts/presentation/sourceHandoverWords'
import type { HeldBankRow } from '../src/apps/spending/workbook/domain/heldBankRow'
import { HELD_ROW_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { civil } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, FILE_THEN_LINK, row } from './fixtures/spending'

const BOOK = { accounts: ACCOUNTS, categories: CATEGORIES, items: [] }

function held(place: number): HeldBankRow {
  return {
    id: recordIdOf(HELD_ROW_RECORDS, `5e000000-0000-4000-8000-${String(place).padStart(12, '0')}`),
    account: FILE_THEN_LINK.id,
    date: civil('2026-10-30'),
    amount: accountMoneyFromAmount(-9),
    payee: 'Market',
    description: '',
    counterpartyIban: '',
    importKey: `bank-ref-${place}`,
    like: FILE_THEN_LINK.id,
  }
}

function handover(going: Pick<SourceHandover, 'rows' | 'held'>): SourceHandover {
  return {
    ...going,
    receipts: [],
    parts: [],
    loneLegs: [],
    linked: 0,
    account: FILE_THEN_LINK,
    sources: [{ source: 'provider-file', from: null }],
    runs: [{ from: civil('2026-10-29'), to: null, before: 'bank-link', after: 'provider-file' }],
  }
}

describe("the warning before an account's days go to another source", () => {
  it('counts the bank rows on hold in its title when they are all that goes, and lists no rows', () => {
    const shown = handoverWords(handover({ rows: [], held: [held(1), held(2)] }), BOOK, civil('2026-11-21'))

    expect(shown?.title).toBe('Giving these days to another source deletes 2 bank rows on hold')
    expect(shown?.rows).toEqual([])
    expect(shown?.notes.some((note) => note.includes('on hold'))).toBe(false)
  })

  it('counts the rows in its title and names the bank rows on hold that go with them in a note', () => {
    const shown = handoverWords(handover({ rows: [row(FILE_THEN_LINK, '2026-10-30', -9, 'Food/Groceries', { payee: 'Market' })], held: [held(1)] }), BOOK, civil('2026-11-21'))

    expect(shown?.title).toBe('Giving these days to another source deletes 1 row')
    expect(shown?.notes).toContain('1 bank row on hold goes too.')
  })
})
