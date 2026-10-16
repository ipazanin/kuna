import { describe, expect, it } from 'vitest'

import { transactionsCsv } from '../src/features/transactions/application/transactionsCsv'
import { ledger } from './fixtures/ledger'

describe('transactionsCsv', () => {
  it('writes the ledger’s column names and plain decimal amounts', () => {
    const [header, row] = transactionsCsv(ledger([{ date: '2026-08-09', amount: -70, category: 'travel', counterparty: 'Bistro' }])).split('\r\n')

    expect(header).toBe('date,account,counterparty,counterparty_iban,description,amount,balance,category,bucket,flagged_by,reference')
    expect(row).toBe('2026-08-09,main,Bistro,,,-70.00,-70.00,travel,operating,rule,REF-1')
  })

  it('quotes commas, quotes and line breaks', () => {
    const csv = transactionsCsv(ledger([{ date: '2026-08-09', amount: -1, counterparty: 'Ink, "Paper" & Co', description: 'two\nlines' }]))

    expect(csv).toContain('"Ink, ""Paper"" & Co"')
    expect(csv).toContain('"two\nlines"')
  })

  it('keeps a spreadsheet from running a payee name as a formula', () => {
    const csv = transactionsCsv(ledger([{ date: '2026-08-09', amount: -1, counterparty: '=HYPERLINK("x")', description: '-SALE' }]))

    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain(",'-SALE,")
    expect(csv).toContain(',-1.00,')
  })
})
