import { describe, expect, it } from 'vitest'

import { transactionsCsv } from '../src/features/transactions/application/transactionsCsv'
import { listedRows } from '../src/features/transactions/domain/listedRows'
import { PACK_CATEGORIES } from './fixtures/hrDooCategories'
import { civil, euros, ledger } from './fixtures/ledger'
import type { RowSpec } from './fixtures/ledger'
import { withSplit } from './fixtures/splits'

function rows(specs: readonly RowSpec[]) {
  return listedRows(ledger(specs), [])
}

describe('transactionsCsv', () => {
  it('writes the ledger’s column names and plain decimal amounts', () => {
    const [header, row] = transactionsCsv(rows([{ date: '2026-08-09', amount: -70, category: 'travel', counterparty: 'Bistro' }])).split('\r\n')

    expect(header).toBe('date,account,counterparty,counterparty_iban,description,amount,balance,category,bucket,flagged_by,reference,note,tab')
    expect(row).toBe('2026-08-09,main,Bistro,,,-70.00,-70.00,travel,operating,rule,REF-1,,ledger')
  })

  it('writes an owner advance as the cost it books, with no account, balance or flag, from the owner-advances tab', () => {
    const advance = { date: civil('2026-08-10'), amount: euros(45), description: 'Train ticket', category: 'travel', family: 'operating', bucket: 'operating' as const, sheetRow: 4 }
    const [, row] = transactionsCsv(listedRows([], [advance])).split('\r\n')

    expect(row).toBe('2026-08-10,,Owner,,Train ticket,-45.00,,travel,operating,,,,owner-advances')
  })

  it('writes each part of a split row with its bank row’s date, account, balance and reference, its note, from the splits tab', () => {
    const transactions = withSplit(ledger([{ date: '2025-03-14', amount: -52.3, category: 'travel', counterparty: 'Online shop' }]), { date: '2025-03-14', amount: -52.3 }, [
      [-39.5, 'travel', 'Company part'],
      [-12.8, 'owner-loan-out', 'The owner’s book'],
    ], PACK_CATEGORIES)
    const [, company, owner] = transactionsCsv(listedRows(transactions, [])).split('\r\n')

    expect(company).toBe('2025-03-14,main,Online shop,,,-39.50,-52.30,travel,operating,rule,REF-1,Company part,splits')
    expect(owner).toBe('2025-03-14,main,Online shop,,,-12.80,-52.30,owner-loan-out,owner-pay,rule,REF-1,The owner’s book,splits')
  })

  it('quotes commas, quotes and line breaks', () => {
    const csv = transactionsCsv(rows([{ date: '2026-08-09', amount: -1, counterparty: 'Ink, "Paper" & Co', description: 'two\nlines' }]))

    expect(csv).toContain('"Ink, ""Paper"" & Co"')
    expect(csv).toContain('"two\nlines"')
  })

  it('keeps a spreadsheet from running a payee name as a formula', () => {
    const csv = transactionsCsv(rows([{ date: '2026-08-09', amount: -1, counterparty: '=HYPERLINK("x")', description: '-SALE' }]))

    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain(",'-SALE,")
    expect(csv).toContain(',-1.00,')
  })
})
