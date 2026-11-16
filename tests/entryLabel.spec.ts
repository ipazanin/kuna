import { describe, expect, it, vi } from 'vitest'

import { TRANSACTION_CODEC } from '../src/apps/spending/workbook/domain/transactionReading'
import { dayLabel } from '../src/shared/calendar/dayLabel'
import { labelOfRecord } from '../src/shared/storage/domain/recordCodec'
import { civil } from './fixtures/ledger'
import { OTP, REVOLUT_USD, row } from './fixtures/spending'

describe("a write's words for an entry", () => {
  it('name it by its day and amount as the language writes them, and its payee', () => {
    const label = labelOfRecord(TRANSACTION_CODEC, row(OTP, '2026-10-23', -1612.2, 'Food/Groceries', { payee: 'Example Bank' }))

    expect(label).toBe(`${dayLabel(civil('2026-10-23'))}, −1,612.20, Example Bank`)
    expect(label).not.toContain('2026-10-23')
  })

  it('write no currency sign, so an entry on a dollar account is not read as euros', () => {
    const label = labelOfRecord(TRANSACTION_CODEC, row(REVOLUT_USD, '2026-10-23', -48.75, 'Food/Eating out', { payee: 'Diner in Boston' }))

    expect(label).toBe(`${dayLabel(civil('2026-10-23'))}, −48.75, Diner in Boston`)
    expect(label).not.toMatch(/[€$]/)
  })

  it('write the amount with the Croatian decimal comma in Croatian', async () => {
    vi.resetModules()
    vi.doMock('../src/shared/text/language', () => ({ language: 'hr', intlLocale: 'hr-HR' }))
    const { TRANSACTION_CODEC: croatianCodec } = await import('../src/apps/spending/workbook/domain/transactionReading')
    const { labelOfRecord: croatianLabel } = await import('../src/shared/storage/domain/recordCodec')
    vi.doUnmock('../src/shared/text/language')

    expect(croatianLabel(croatianCodec, row(REVOLUT_USD, '2026-10-23', -1612.2, 'Food/Eating out', { payee: 'Diner in Boston' }))).toContain('−1.612,20, Diner in Boston')
  })
})
