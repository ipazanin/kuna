import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

import type { ImportedStatement, StatementReading } from '../src/apps/company/imports/domain/importedStatement'
import { fileShapeOf } from '../src/apps/company/imports/domain/recipeGuess'
import { tableRecipesOf } from '../src/apps/company/imports/domain/tableRecipes'
import { readTabularStatement } from '../src/apps/company/imports/domain/tabularStatement'
import type { TableCells } from '../src/shared/recipes/domain/tableRows'
import { loadImportFile } from '../src/apps/company/imports/infrastructure/importFiles'
import { moneyFromCents } from '../src/shared/money/money'
import type { RecipeField } from '../src/shared/recipes/domain/recipe'
import type { SavedRecipe } from '../src/shared/recipes/domain/savedRecipe'
import type { TableRecipeDraft } from '../src/shared/recipes/domain/tableRecipeDraft'
import { tableRecipe } from './fixtures/companyRecipes'

/** The shape of a Croatian bank's xlsx export, every value invented: a title, the header, rows newest first, a total. */
const HEADER = ['Datum valute', 'Datum knjiženja', 'Naziv primatelja / platitelja', 'IBAN primatelja / platitelja', 'Opis plaćanja', 'Isplata', 'Uplata', 'Stanje']
const CROATIAN: (string | XLSX.CellObject)[][] = [
  ['Promet po računu'],
  ['Razdoblje: 01.03.2031. - 05.03.2031.'],
  [],
  HEADER,
  ['05.03.2031', '05.03.2031.', 'Brightdesk Accounting', 'HR0624070001234567890', 'Knjigovodstvo 2/2031', '1.250,00', '', '5.432,10'],
  [{ t: 'n', v: 47911, z: 'dd.mm.yyyy' }, { t: 'n', v: 47911, z: 'dd.mm.yyyy' }, 'KAVANA PRIMJER', '', 'Kartično plaćanje', '3,40', '', '6.682,10'],
  ['03.03.2031', '03.03.2031', 'Northwind Analytics Ltd', 'HR6324020069999988888', 'Invoice 3-1-31', '', '6.500,00', '6.685,50'],
  ['01.03.2031', '01.03.2031', 'Primjer banka d.d.', '', 'Naknada za vođenje računa', '14,50', '', '185,50'],
  ['Ukupno', '', '', '', '1.267,90', '6.500,00', ''],
]

const DRAFT: TableRecipeDraft = {
  name: 'primjer-banka',
  date: { column: 'Datum knjiženja', format: 'dd.MM.yyyy' },
  amount: { debit: 'Isplata', credit: 'Uplata' },
  mark: 'comma',
  columns: { balance: 'Stanje', counterpartyIban: 'IBAN primatelja / platitelja', description: 'Opis plaćanja', counterparty: 'Naziv primatelja / platitelja' },
  kinds: [{ kind: 'entry', test: null }],
}

const NO_BALANCE: TableRecipeDraft = { ...DRAFT, columns: { counterpartyIban: DRAFT.columns.counterpartyIban, description: DRAFT.columns.description, counterparty: DRAFT.columns.counterparty } }

async function gridOfXlsx(grid: readonly (readonly (string | number | XLSX.CellObject)[])[]): Promise<TableCells> {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(grid.map((row) => [...row])), 'Promet')
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const loaded = await loadImportFile('promet-2031-03.xlsx', bytes)
  if (loaded.kind !== 'table') throw new Error('expected a spreadsheet')
  return loaded.cells
}

/** The day formats the export writes: text with and without a closing dot, and a sheet's own day cells, which read as ISO days. */
const DAY_FORMATS = ['dd.MM.yyyy', 'dd.MM.yyyy.', 'yyyy-MM-dd']

/** The recipe with every day field reading each of the export's day formats. */
function readingEveryDayFormat(saved: SavedRecipe): SavedRecipe {
  const sections = saved.recipe.sections.map((section) => ({
    ...section,
    kinds: section.kinds.map((kind) => ({
      ...kind,
      fields: Object.fromEntries(Object.entries(kind.fields).map(([name, field]): [string, RecipeField] => [name, field.as === 'date' ? { ...field, formats: DAY_FORMATS } : field])),
    })),
  }))
  return { ...saved, recipe: { ...saved.recipe, sections } }
}

/** A file read by the recipe a draft makes, into the main account. */
function readByRecipe(cells: TableCells, draft: TableRecipeDraft, fileName: string, fileHash: string): StatementReading {
  const [table] = tableRecipesOf([readingEveryDayFormat(tableRecipe(draft, 'Primjer banka'))])
  if (table === undefined) throw new Error('the draft makes no table recipe')
  return readTabularStatement(cells, table.recipe, 'main', fileName, fileHash)
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

describe('reading a bank’s spreadsheet export by a table recipe', () => {
  it('reads a Croatian xlsx with a decimal comma, text and serial dates, split columns and a total row', async () => {
    const statement = statementOf(readByRecipe(await gridOfXlsx(CROATIAN), DRAFT, 'promet-2031-03.xlsx', HASH))

    expect(statement.rows.map((row) => [row.date, row.amount, row.balance, row.counterparty])).toEqual([
      ['2031-03-01', moneyFromCents(-1_450), moneyFromCents(18_550), 'Primjer banka d.d.'],
      ['2031-03-03', moneyFromCents(650_000), moneyFromCents(668_550), 'Northwind Analytics Ltd'],
      ['2031-03-04', moneyFromCents(-340), moneyFromCents(668_210), 'KAVANA PRIMJER'],
      ['2031-03-05', moneyFromCents(-125_000), moneyFromCents(543_210), 'Brightdesk Accounting'],
    ])
    expect(statement).toMatchObject({
      account: 'main',
      label: 'promet-2031-03 (a1b2c3d4)',
      opening: moneyFromCents(20_000),
      closing: moneyFromCents(543_210),
      source: { kind: 'table', recipe: 'primjer-banka', fileHash: HASH },
    })
    expect(statement.notes).toEqual(['Row 9 has no date, so it is skipped.'])
    expect(statement.rows.every((row) => /^row-[0-9a-f]{16}-1$/.test(row.reference))).toBe(true)
  })

  it('reads an xlsx whose amounts are number cells with a decimal comma, each by its number', async () => {
    const numbers = [
      HEADER,
      ['01.03.2031', '01.03.2031', 'Primjer banka d.d.', '', 'Naknada za vođenje računa', 14.5, '', 1234.5],
      ['02.03.2031', '02.03.2031', 'KAVANA PRIMJER', '', 'Kartično plaćanje', 3.4, '', 1231.1],
    ]
    const statement = statementOf(readByRecipe(await gridOfXlsx(numbers), DRAFT, 'numbers.xlsx', HASH))

    expect(statement.rows.map((row) => [row.amount, row.balance])).toEqual([
      [moneyFromCents(-1_450), moneyFromCents(123_450)],
      [moneyFromCents(-340), moneyFromCents(123_110)],
    ])
  })

  it('gives the same row the same key in a later export that overlaps it', async () => {
    const first = statementOf(readByRecipe(await gridOfXlsx(CROATIAN), DRAFT, 'march.xlsx', HASH))
    const later = [...CROATIAN.slice(0, 4), ['06.03.2031', '06.03.2031', 'KAVANA PRIMJER', '', 'Kartično plaćanje', '3,40', '', '5.428,70'], ...CROATIAN.slice(4, 6)]
    const second = statementOf(readByRecipe(await gridOfXlsx(later), DRAFT, 'later.xlsx', HASH.replace('a1', 'ff')))

    expect(second.rows.slice(0, 2).map((row) => row.reference)).toEqual(first.rows.slice(2).map((row) => row.reference))
    expect(second.rows[2]?.reference).not.toBe(first.rows[2]?.reference)
  })

  it('counts equal rows of a file without balances, so two equal payments keep two keys', async () => {
    const twice = [
      HEADER.slice(0, 7),
      ['04.03.2031', '04.03.2031', 'KAVANA PRIMJER', '', 'Kartično plaćanje', '3,40', ''],
      ['04.03.2031', '04.03.2031', 'KAVANA PRIMJER', '', 'Kartično plaćanje', '3,40', ''],
    ]
    const statement = statementOf(readByRecipe(await gridOfXlsx(twice), NO_BALANCE, 'twice.csv', HASH))

    expect(statement.rows.map((row) => row.reference.slice(-2))).toEqual(['-1', '-2'])
    expect(statement.rows[0]?.reference.slice(0, -2)).toBe(statement.rows[1]?.reference.slice(0, -2))
    expect(statement).toMatchObject({ opening: null, closing: null })
    expect(statement.rows.every((row) => row.balance === null)).toBe(true)
  })

  it('reads a negative debit as money out and refuses a negative credit', async () => {
    const signedDebit = [HEADER.slice(0, 7), ['04.03.2031', '04.03.2031', 'KAVANA PRIMJER', '', 'Kartično plaćanje', '-3,40', '']]
    const negativeCredit = [HEADER.slice(0, 7), ['04.03.2031', '04.03.2031', 'Northwind Analytics Ltd', '', 'Povrat', '', '-50,00']]

    expect(statementOf(readByRecipe(await gridOfXlsx(signedDebit), NO_BALANCE, 'debit.xlsx', HASH)).rows[0]?.amount).toBe(moneyFromCents(-340))
    expect(refusalOf(readByRecipe(await gridOfXlsx(negativeCredit), NO_BALANCE, 'credit.xlsx', HASH))).toContain('row 2: the credit "-50,00" is negative')
  })

  it('keeps a reference column the bank gives', async () => {
    const withReference = [[...HEADER, 'Referenca'], ...CROATIAN.slice(4, 5).map((row) => [...row, 'R-2031-77'])]
    const statement = statementOf(readByRecipe(await gridOfXlsx(withReference), { ...DRAFT, columns: { ...DRAFT.columns, reference: 'Referenca' } }, 'ref.xlsx', HASH))

    expect(statement.rows[0]?.reference).toBe('R-2031-77')
  })

  it.each([
    [
      'a balance that does not follow the row before',
      CROATIAN.map((row) => (row[4] === 'Kartično plaćanje' ? [...row.slice(0, 7), '6.682,20'] : row)),
      /Row 6 says the balance is €6,682\.20, but row 7's €6,685\.50 plus .€3\.40 is €6,682\.10/,
    ],
    [
      'a date the format does not read',
      CROATIAN.map((row) => (row[0] === '01.03.2031' ? ['2031/03/01', '2031/03/01', ...row.slice(2)] : row)),
      /row 8: "2031\/03\/01" is not a date written as dd\.MM\.yyyy/,
    ],
    ['an amount finer than a cent', CROATIAN.map((row) => (row[0] === '01.03.2031' ? [...row.slice(0, 5), '14,505', '', row[7]!] : row)), /row 8: "14,505" is not an amount/],
    [
      'a row with both a debit and a credit',
      CROATIAN.map((row) => (row[0] === '01.03.2031' ? [...row.slice(0, 6), '1,00', row[7]!] : row)),
      /row 8: both the debit and the credit column hold an amount/,
    ],
    ['dates in no order', [HEADER, CROATIAN[4]!, CROATIAN[7]!, CROATIAN[6]!], /run neither oldest first nor newest first/],
  ])('refuses %s', async (_case, grid, reason) => {
    expect(refusalOf(readByRecipe(await gridOfXlsx(grid), DRAFT, 'bad.xlsx', HASH))).toMatch(reason)
  })

  it('refuses a file no row of which carries the recipe’s columns', async () => {
    expect(refusalOf(readByRecipe(await gridOfXlsx([['Date', 'Amount']]), DRAFT, 'other.xlsx', HASH))).toMatch(/No row in the first 40 of other\.xlsx carries every column of the recipe primjer-banka/)
  })

  it('reads a csv’s amounts as written, with a semicolon between fields', async () => {
    const csv = [HEADER.join(';'), '01.03.2031;01.03.2031;Primjer banka d.d.;;Naknada;14,50;;185,50'].join('\n')
    const loaded = await loadImportFile('promet.csv', new TextEncoder().encode(csv).buffer as ArrayBuffer)
    const statement = statementOf(readByRecipe(loaded.kind === 'table' ? loaded.cells : { texts: [], numbers: [] }, DRAFT, 'promet.csv', HASH))

    expect(statement.rows[0]).toMatchObject({ amount: moneyFromCents(-1_450), balance: moneyFromCents(18_550) })
  })

  it('reads a csv that is not UTF-8 as Windows-1250', async () => {
    // "Datum;Opis plaćanja;Iznos" and a row "01.03.2031;Članarina;-3,40", with ć as 0xE6 and Č as 0xC8.
    const latin2 = (text: string): number[] => [...text].map((character) => ({ ć: 0xe6, Č: 0xc8 })[character] ?? character.charCodeAt(0))
    const bytes = new Uint8Array([...latin2('Datum;Opis plaćanja;Iznos\n'), ...latin2('01.03.2031;Članarina;-3,40')])
    const loaded = await loadImportFile('promet.csv', bytes.buffer)
    const grid = loaded.kind === 'table' ? loaded.cells.texts : []

    expect(grid[0]).toEqual(['Datum', 'Opis plaćanja', 'Iznos'])
    expect(grid[1]).toEqual(['01.03.2031', 'Članarina', '-3,40'])
  })
})

describe('guessing a table recipe', () => {
  it('guesses the header row, the columns, the day format and the decimal mark of an export it has not seen', async () => {
    const shape = fileShapeOf(await gridOfXlsx(CROATIAN))

    expect(shape?.headerRow).toBe(3)
    expect(shape?.guess).toEqual({ ...DRAFT, name: '' })
  })
})
