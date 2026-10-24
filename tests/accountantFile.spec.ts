import { describe, expect, it } from 'vitest'

import { accountantFileNameOf, filingsByPeriod, sameReading } from '../src/packs/hr-doo/domain/accountant/accountantFile'
import type { AccountantFile, AccountantFileFormat } from '../src/packs/hr-doo/domain/accountant/accountantFile'
import { month } from './fixtures/accountantWorkbooks'

function file(name: string, format: AccountantFileFormat): AccountantFile {
  const named = accountantFileNameOf(name)
  if (named === null) throw new Error(`${name} names no period`)
  return { ...named, name, format }
}

describe('accountantFileNameOf', () => {
  it('reads the period and kind of a name with or without .xlsx', () => {
    expect(accountantFileNameOf('2026-09-pdv.xlsx')).toEqual({ period: month('2026-09'), kind: 'vat-return' })
    expect(accountantFileNameOf('2025-07-salary')).toEqual({ period: month('2025-07'), kind: 'salary' })
  })

  it('passes over the other files of a month folder', () => {
    expect(accountantFileNameOf('2026-09-payment-order-salary.xml')).toBeNull()
    expect(accountantFileNameOf('2026-09-ip1-form-ana-primjer.pdf')).toBeNull()
    expect(accountantFileNameOf('2026-13-pdv.xlsx')).toBeNull()
  })
})

describe('filingsByPeriod', () => {
  it('reads the mailed xlsx of a period that also has a Google Sheet, and keeps the Sheet to compare', () => {
    const filings = filingsByPeriod([file('2026-05-salary', 'google-sheet'), file('2026-06-salary.xlsx', 'xlsx'), file('2026-05-salary.xlsx', 'xlsx'), file('2026-05-pdv.xlsx', 'xlsx')])
    expect(filings.map((filing) => [filing.file.name, filing.alsoFiled.map((other) => other.name)])).toEqual([
      ['2026-05-salary.xlsx', ['2026-05-salary']],
      ['2026-05-pdv.xlsx', []],
      ['2026-06-salary.xlsx', []],
    ])
  })

  it('reads a Google Sheet when the period has nothing else', () => {
    expect(filingsByPeriod([file('2025-07-pdv', 'google-sheet')])[0]?.file.format).toBe('google-sheet')
  })
})

describe('sameReading', () => {
  it('tells two files of a period apart when they read differently', () => {
    expect(sameReading({ document: { total: 1 } }, { document: { total: 1 } })).toBe(true)
    expect(sameReading({ document: { total: 1 } }, { document: { total: 2 } })).toBe(false)
  })
})
