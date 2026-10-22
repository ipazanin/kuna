import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

import { readProfile, profileValue } from '../src/features/imports/domain/importProfile'
import type { ImportProfile } from '../src/features/imports/domain/importProfile'
import type { ImportedStatement, StatementReading } from '../src/features/imports/domain/importedStatement'
import { fileShapeOf } from '../src/features/imports/domain/profileGuess'
import { dateOf, moneyOf, readTabularStatement } from '../src/features/imports/domain/tabularStatement'
import type { CellGrid } from '../src/features/imports/domain/tabularStatement'
import { loadImportFile } from '../src/features/imports/infrastructure/importFiles'
import { parseSettings, settingsTabEntries } from '../src/features/settings/domain/settings'
import { moneyFromCents } from '../src/shared/money/money'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { SETTING_RECORDS } from '../src/features/workbook/domain/recordKind'

/** The shape of a Croatian bank's xlsx export, every value invented: a title, the header, rows newest first, a total. */
const HEADER = ['Datum valute', 'Datum knjiženja', 'Naziv primatelja / platitelja', 'IBAN primatelja / platitelja', 'Opis plaćanja', 'Isplata', 'Uplata', 'Stanje']
const CROATIAN: (string | number)[][] = [
  ['Promet po računu'],
  ['Razdoblje: 01.03.2031. - 05.03.2031.'],
  [],
  HEADER,
  ['05.03.2031', '05.03.2031.', 'Brightdesk Accounting', 'HR0624070001234567890', 'Knjigovodstvo 2/2031', '1.250,00', '', '5.432,10'],
  [47911, 47911, 'KAVANA PRIMJER', '', 'Kartično plaćanje', '3,40', '', '6.682,10'],
  ['03.03.2031', '03.03.2031', 'Northwind Analytics Ltd', 'HR6324020069999988888', 'Invoice 3-1-31', '', '6.500,00', '6.685,50'],
  ['01.03.2031', '01.03.2031', 'Primjer banka d.d.', '', 'Naknada za vođenje računa', '14,50', '', '185,50'],
  ['Ukupno', '', '', '', '1.267,90', '6.500,00', ''],
]

const PROFILE: ImportProfile = {
  name: 'primjer-banka',
  account: 'main',
  date: 'Datum knjiženja',
  dateFormat: 'dd.mm.yyyy',
  decimal: 'comma',
  amount: { debit: 'Isplata', credit: 'Uplata' },
  balance: 'Stanje',
  counterparty: 'Naziv primatelja / platitelja',
  counterpartyIban: 'IBAN primatelja / platitelja',
  description: 'Opis plaćanja',
  reference: '',
}

async function gridOfXlsx(grid: readonly (readonly (string | number)[])[]): Promise<CellGrid> {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(grid.map((row) => [...row])), 'Promet')
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const loaded = await loadImportFile('promet-2031-03.xlsx', bytes)
  if (loaded.kind !== 'table') throw new Error('expected a spreadsheet')
  return loaded.grid
}

function statementOf(reading: StatementReading): ImportedStatement {
  if (!('statement' in reading)) throw new Error(reading.refusal)
  return reading.statement
}

function refusalOf(reading: StatementReading): string {
  if (!('refusal' in reading)) throw new Error('expected a refusal')
  return reading.refusal
}

const HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9'

describe('reading a bank’s spreadsheet export by its profile', () => {
  it('reads a Croatian xlsx with a decimal comma, text and serial dates, split columns and a total row', async () => {
    const statement = statementOf(readTabularStatement(await gridOfXlsx(CROATIAN), PROFILE, 'promet-2031-03.xlsx', HASH))

    expect(statement.rows.map((row) => [row.date, row.amount, row.balance, row.counterparty])).toEqual([
      ['2031-03-01', moneyFromCents(-1_450), moneyFromCents(18_550), 'Primjer banka d.d.'],
      ['2031-03-03', moneyFromCents(650_000), moneyFromCents(668_550), 'Northwind Analytics Ltd'],
      ['2031-03-04', moneyFromCents(-340), moneyFromCents(668_210), 'KAVANA PRIMJER'],
      ['2031-03-05', moneyFromCents(-125_000), moneyFromCents(543_210), 'Brightdesk Accounting'],
    ])
    expect(statement).toMatchObject({ account: 'main', label: 'promet-2031-03 (a1b2c3d4)', opening: moneyFromCents(20_000), closing: moneyFromCents(543_210), source: { kind: 'table', profile: 'primjer-banka', fileHash: HASH } })
    expect(statement.notes).toEqual(['Row 9 has no date, so it is skipped.'])
    expect(statement.rows.every((row) => /^row-[0-9a-f]{16}-1$/.test(row.reference))).toBe(true)
  })

  it('gives the same row the same key in a later export that overlaps it', async () => {
    const first = statementOf(readTabularStatement(await gridOfXlsx(CROATIAN), PROFILE, 'march.xlsx', HASH))
    const later = [...CROATIAN.slice(0, 4), ['06.03.2031', '06.03.2031', 'KAVANA PRIMJER', '', 'Kartično plaćanje', '3,40', '', '5.428,70'], ...CROATIAN.slice(4, 6)]
    const second = statementOf(readTabularStatement(await gridOfXlsx(later), PROFILE, 'later.xlsx', HASH.replace('a1', 'ff')))

    expect(second.rows.slice(0, 2).map((row) => row.reference)).toEqual(first.rows.slice(2).map((row) => row.reference))
    expect(second.rows[2]?.reference).not.toBe(first.rows[2]?.reference)
  })

  it('counts equal rows of a file without balances, so two equal payments keep two keys', async () => {
    const noBalance: ImportProfile = { ...PROFILE, balance: '' }
    const twice = [HEADER.slice(0, 7), ['04.03.2031', '04.03.2031', 'KAVANA PRIMJER', '', 'Kartično plaćanje', '3,40', ''], ['04.03.2031', '04.03.2031', 'KAVANA PRIMJER', '', 'Kartično plaćanje', '3,40', '']]
    const statement = statementOf(readTabularStatement(await gridOfXlsx(twice), noBalance, 'twice.csv', HASH))

    expect(statement.rows.map((row) => row.reference.slice(-2))).toEqual(['-1', '-2'])
    expect(statement.rows[0]?.reference.slice(0, -2)).toBe(statement.rows[1]?.reference.slice(0, -2))
    expect(statement).toMatchObject({ opening: null, closing: null })
    expect(statement.rows.every((row) => row.balance === null)).toBe(true)
  })

  it('reads a negative debit as money out and refuses a negative credit', async () => {
    const signedDebit = [HEADER.slice(0, 7), ['04.03.2031', '04.03.2031', 'KAVANA PRIMJER', '', 'Kartično plaćanje', '-3,40', '']]
    const negativeCredit = [HEADER.slice(0, 7), ['04.03.2031', '04.03.2031', 'Northwind Analytics Ltd', '', 'Povrat', '', '-50,00']]
    const noBalance: ImportProfile = { ...PROFILE, balance: '' }

    expect(statementOf(readTabularStatement(await gridOfXlsx(signedDebit), noBalance, 'debit.xlsx', HASH)).rows[0]?.amount).toBe(moneyFromCents(-340))
    expect(refusalOf(readTabularStatement(await gridOfXlsx(negativeCredit), noBalance, 'credit.xlsx', HASH))).toContain('row 2: the credit "-50,00" is negative')
  })

  it('keeps a reference column the bank gives', async () => {
    const withReference = [[...HEADER, 'Referenca'], ...CROATIAN.slice(4, 5).map((row) => [...row, 'R-2031-77'])]
    const statement = statementOf(readTabularStatement(await gridOfXlsx(withReference), { ...PROFILE, reference: 'Referenca' }, 'ref.xlsx', HASH))

    expect(statement.rows[0]?.reference).toBe('R-2031-77')
  })

  it.each([
    ['a balance that does not follow the row before', CROATIAN.map((row) => (row[4] === 'Kartično plaćanje' ? [...row.slice(0, 7), '6.682,20'] : row)), /Row 6 says the balance is 6682\.20, but row 7's 6685\.50 plus -3\.40 is 6682\.10/],
    ['a date the format does not read', CROATIAN.map((row) => (row[0] === '01.03.2031' ? ['2031-03-01', '2031-03-01', ...row.slice(2)] : row)), /row 8: "2031-03-01" is not a dd\.mm\.yyyy date/],
    ['a row with both a debit and a credit', CROATIAN.map((row) => (row[0] === '01.03.2031' ? [...row.slice(0, 6), '1,00', row[7]!] : row)), /row 8: both the debit and the credit column hold an amount/],
    ['dates in no order', [HEADER, CROATIAN[4]!, CROATIAN[7]!, CROATIAN[6]!], /run neither oldest first nor newest first/],
  ])('refuses %s', async (_case, grid, reason) => {
    expect(refusalOf(readTabularStatement(await gridOfXlsx(grid), PROFILE, 'bad.xlsx', HASH))).toMatch(reason)
  })

  it('refuses a file no row of which carries the profile’s columns', async () => {
    expect(refusalOf(readTabularStatement(await gridOfXlsx([['Date', 'Amount']]), PROFILE, 'other.xlsx', HASH))).toMatch(/No row in the first 40 of other\.xlsx carries every column of the profile primjer-banka/)
  })

  it('reads a csv’s amounts as written, with a semicolon between fields', async () => {
    const csv = [HEADER.join(';'), '01.03.2031;01.03.2031;Primjer banka d.d.;;Naknada;14,50;;185,50'].join('\n')
    const loaded = await loadImportFile('promet.csv', new TextEncoder().encode(csv).buffer as ArrayBuffer)
    const statement = statementOf(readTabularStatement(loaded.kind === 'table' ? loaded.grid : [], PROFILE, 'promet.csv', HASH))

    expect(statement.rows[0]).toMatchObject({ amount: moneyFromCents(-1_450), balance: moneyFromCents(18_550) })
  })

  it('reads a csv that is not UTF-8 as Windows-1250', async () => {
    // "Datum;Opis plaćanja;Iznos" and a row "01.03.2031;Članarina;-3,40", with ć as 0xE6 and Č as 0xC8.
    const latin2 = (text: string): number[] => [...text].map((character) => ({ ć: 0xe6, Č: 0xc8 })[character] ?? character.charCodeAt(0))
    const bytes = new Uint8Array([...latin2('Datum;Opis plaćanja;Iznos\n'), ...latin2('01.03.2031;Članarina;-3,40')])
    const loaded = await loadImportFile('promet.csv', bytes.buffer)
    const grid = loaded.kind === 'table' ? loaded.grid : []

    expect(grid[0]).toEqual(['Datum', 'Opis plaćanja', 'Iznos'])
    expect(grid[1]).toEqual(['01.03.2031', 'Članarina', '-3,40'])
  })
})

describe('text amounts and dates', () => {
  it.each([
    ['1.234,56', 'comma', 123_456],
    ['-80,00', 'comma', -8_000],
    ['80,00-', 'comma', -8_000],
    ['1 234,5 EUR', 'comma', 123_450],
    ['1,234.56', 'point', 123_456],
    [12.5, 'comma', 1_250],
  ] as const)('reads %s with a decimal %s', (cell, decimal, cents) => {
    expect(moneyOf(cell, decimal)).toBe(cents)
  })

  it.each([['1.234,567'], ['abc'], ['-1,00-'], ['12.50'], ['1.23.4,5'], ['12 50']])('refuses %s with a decimal comma', (cell) => {
    expect(moneyOf(cell, 'comma')).toBeNull()
  })

  it.each([['12,50'], ['1,23,4.5']])('refuses %s with a decimal point', (cell) => {
    expect(moneyOf(cell, 'point')).toBeNull()
  })

  it('reads each date format, a trailing dot and a time, and an Excel serial', () => {
    expect(dateOf('5.3.2031.', 'dd.mm.yyyy')).toBe('2031-03-05')
    expect(dateOf('05.03.2031 14:20', 'dd.mm.yyyy')).toBe('2031-03-05')
    expect(dateOf('03/05/2031', 'mm/dd/yyyy')).toBe('2031-03-05')
    expect(dateOf('05/03/2031', 'dd/mm/yyyy')).toBe('2031-03-05')
    expect(dateOf('2031-03-05T00:00:00', 'yyyy-mm-dd')).toBe('2031-03-05')
    expect(dateOf(47911, 'dd.mm.yyyy')).toBe('2031-03-04')
    expect(dateOf('31.02.2031', 'dd.mm.yyyy')).toBeNull()
  })
})

describe('import profiles', () => {
  it('saves a profile as word=column pairs and reads it back', () => {
    const value = profileValue(PROFILE)

    expect(value).toBe(
      'account=main; date=Datum knjiženja; date_format=dd.mm.yyyy; decimal=comma; debit=Isplata; credit=Uplata; balance=Stanje; counterparty=Naziv primatelja / platitelja; counterparty_iban=IBAN primatelja / platitelja; description=Opis plaćanja',
    )
    expect(readProfile('primjer-banka', value)).toEqual(PROFILE)
  })

  it.each([
    ['Bad Name', 'account=main; date=D; amount=A', /lower-case letters and digits/],
    ['bank', 'account=main; amount=A', /names no date/],
    ['bank', 'account=main; date=D; amount=A; debit=B', /either amount, or both debit and credit/],
    ['bank', 'account=main; date=D; amount=A; colour=red', /"colour=red" is not a word=column pair/],
    ['bank', 'account=main; date=D; amount=A; date_format=d.m.y', /date_format "d\.m\.y" is not one of/],
  ])('refuses %s with %s', (name, value, reason) => {
    expect(readProfile(name, value)).toMatch(reason)
  })

  it('follows the workbook on its settings tab, and an export writes it back', () => {
    const rows = [{ key: 'import_profile_primjer-banka', value: profileValue(PROFILE) }, { key: 'import_profile_broken', value: 'date=D' }]
    const { settings, problems } = parseSettings(rows)

    expect(settings.importProfiles).toEqual([PROFILE])
    expect(problems).toEqual([{ id: recordIdOf(SETTING_RECORDS, 'import_profile_broken'), label: 'import_profile_broken', reason: 'the profile names no account, so the profile is not offered' }])
    expect(settingsTabEntries(settings).at(-1)).toEqual({ key: 'import_profile_primjer-banka', value: profileValue(PROFILE) })
  })

  it('guesses the header row, the columns, the date format and the decimal mark of an export it has not seen', async () => {
    const shape = fileShapeOf(await gridOfXlsx(CROATIAN))

    expect(shape?.headerRow).toBe(3)
    expect(shape?.guess).toEqual({ ...PROFILE, name: '', account: '' })
  })
})
