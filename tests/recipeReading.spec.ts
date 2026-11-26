import { describe, expect, it } from 'vitest'

import { statementOfFile, statementRecipesOf } from '../src/apps/spending/statements/domain/recipeStatement'
import { en } from '../src/apps/spending/statements/domain/words'
import { refusalLine } from '../src/apps/spending/statements/presentation/readingLines'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { RECIPE_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { fakeRecipes } from '../src/apps/spending/workbook/infrastructure/fake/fakeRecipes'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { EURO } from '../src/shared/money/currencyCode'
import type { SavedRecipe } from '../src/shared/recipes/domain/savedRecipe'
import { readRecipe } from '../src/shared/recipes/domain/readRecipe'
import { refusalOr, storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { account, ACCOUNTS, CATEGORIES, category } from './fixtures/spending'
import { civil } from './fixtures/ledger'

const [SAVED] = fakeRecipes()
const CODEC = codecOfSpendingKind(RECIPE_RECORDS)
const ID = recordIdOf(RECIPE_RECORDS, 'r1')

function made(fields: Readonly<Record<string, string>>) {
  return refusalOr(() => CODEC.make(storedFieldsOfValues(fields), ID))
}

describe('a saved recipe', () => {
  it('reads back field for field as the file keeps it, its sections as JSON', () => {
    const fields = CODEC.fieldsOf(SAVED!)
    expect(fields).toMatchObject({ name: 'Promet Primjer banke', bank: 'Primjer banka', currency: 'EUR', format: 'table' })
    expect(CODEC.fieldsOf(CODEC.make(storedFieldsOfValues(fields), SAVED!.id))).toEqual(fields)
  })

  it('refuses sections that are not JSON, or not a recipe Kuna can run, and a table with two sections', () => {
    const fields = { ...(CODEC.fieldsOf(SAVED!) as Record<string, string>) }
    const sections = JSON.parse(fields.sections!) as unknown[]
    expect(made({ ...fields, sections: 'not json' })).toEqual({ refused: 'sections cannot be read' })
    expect(made({ ...fields, sections: JSON.stringify([{ ...(sections[0] as object), kinds: [] }]) })).toEqual({ refused: 'sections cannot be read' })
    expect(made({ ...fields, sections: JSON.stringify([...sections, ...sections]) })).toEqual({ refused: 'sections cannot be read' })
    expect(made({ ...fields, currency: 'euros' })).toEqual({ refused: 'currency cannot be read' })
  })

  it('reads a test, a field and a kind of each shape a recipe has', () => {
    const recipe = readRecipe(
      'x',
      'X',
      { format: 'xml', root: 'R' },
      JSON.stringify([
        {
          name: 'S',
          rows: 'S/R',
          keep: [{ column: 'a', is: ['1'], anyCase: true }],
          shown: ['a'],
          fields: { day: { from: 'd', as: 'date', formats: ['yyyyMMdd'] }, cash: { from: 'c', as: 'decimal', mark: 'point', blank: true } },
          kinds: [
            {
              kind: 'k',
              when: [
                { column: 'b', partsWithin: ['P'], separator: ';' },
                { column: 'c', sign: 'below-zero' },
              ],
              fields: { money: { from: 'm', as: 'currency', part: { separator: '.', at: 0 } } },
            },
          ],
        },
      ]),
    )
    expect(recipe?.sections[0]?.kinds[0]?.fields.money).toEqual({ from: 'm', as: 'currency', part: { separator: '.', at: 0 } })
  })
})

describe('Import with a saved recipe', () => {
  const bank = account(9, { ...ACCOUNTS[0]!, name: 'Primjer tekući', bank: 'primjer banka', iban: 'HR0000000000000000099' })
  const book = { accounts: [...ACCOUNTS, bank], categories: CATEGORIES, recipes: [SAVED!] }

  it("reads a file Revolut's recipe does not fit by the saved recipe, its rows going to the account of the recipe's bank and currency", () => {
    const reading = statementOfFile(
      statementRecipesOf(book),
      { texts: [['Promet po računu'], ['Datum', 'Iznos', 'Opis'], ['03.10.2026', '-1.234,50', 'Najam']], numbers: [] },
      'promet.csv',
      book,
      en.feeOn,
    )

    expect('statement' in reading && reading.statement.rows.map((row) => [row.account, row.date, row.amount, row.payee])).toEqual([
      [bank.id, civil('2026-10-03'), accountMoneyFromAmount(-1234.5), 'Najam'],
    ])
  })

  it("reads a sheet's number cell by its number though the saved recipe writes a decimal comma", () => {
    const reading = statementOfFile(
      statementRecipesOf(book),
      {
        texts: [
          ['Datum', 'Iznos', 'Opis'],
          ['03.10.2026', '-1234.5', 'Najam'],
        ],
        numbers: [[], [1]],
      },
      'promet.xlsx',
      book,
      en.feeOn,
    )

    expect('statement' in reading && reading.statement.rows.map((row) => row.amount)).toEqual([accountMoneyFromAmount(-1234.5)])
  })

  it('says no recipe reads a file none fits, with the column each one looked for', () => {
    const reading = statementOfFile(statementRecipesOf(book), { texts: [['Date', 'Sum']], numbers: [] }, 'other.csv', book, en.feeOn)

    expect('refused' in reading && refusalLine(reading.refused, [])).toBe('No recipe reads this file: Revolut needs a State column and Promet Primjer banke needs a Datum column')
  })
})

describe('an account drafted from a saved recipe', () => {
  const BOOKED_FORMATS = ['yyyy-MM-dd HH:mm:ss']
  const RECIPE_ID = recordIdOf(RECIPE_RECORDS, 'r2')
  const EXAMPLE_BANK: SavedRecipe = {
    id: RECIPE_ID,
    bank: 'Example bank',
    currency: null,
    recipe: {
      id: RECIPE_ID,
      name: 'Example bank statement',
      file: { format: 'table' },
      sections: [
        {
          name: 'Statement',
          rows: '',
          keep: [],
          shown: ['Booked', 'Details'],
          fields: {
            started: { from: 'Booked', as: 'date', formats: BOOKED_FORMATS },
            startedTime: { from: 'Booked', as: 'time', formats: BOOKED_FORMATS },
            completed: { from: 'Booked', as: 'date', formats: BOOKED_FORMATS },
            completedTime: { from: 'Booked', as: 'time', formats: BOOKED_FORMATS },
            amount: { from: 'Amount', as: 'decimal' },
            fee: { from: 'Fee', as: 'decimal', blank: true },
            currency: { from: 'Currency', as: 'text' },
            description: { from: 'Details', as: 'text', blank: true },
            balance: { from: 'Balance', as: 'decimal', blank: true },
          },
          kinds: [{ kind: 'payment', when: [], fields: {} }],
        },
      ],
    },
  }
  const current = account(9, {
    name: 'Example bank current',
    kind: 'bank',
    bank: 'Example bank',
    currency: EURO,
    opening: accountMoneyFromAmount(0),
    openedOn: civil('2026-09-01'),
    sources: [{ source: 'provider-file', from: null }],
    iban: 'HR0000000000000000098',
    closed: false,
  })
  const book = { accounts: [...ACCOUNTS, current], categories: CATEGORIES, recipes: [EXAMPLE_BANK] }
  const cells = {
    texts: [
      ['Booked', 'Amount', 'Fee', 'Currency', 'Details', 'Balance'],
      ['2026-10-01 10:00:00', '-20.00', '', 'EUR', 'To savings', ''],
      ['2026-10-01 10:00:00', '20.00', '', 'EUR', 'From current', ''],
      ['2026-10-03 11:00:00', '-40.00', '1.50', 'EUR', 'Fuel station', ''],
      ['2026-10-02 09:00:00', '-10.00', '', 'GBP', 'Pub', '90.00'],
      ['2026-10-04 09:00:00', '-5.00', '0.50', 'GBP', 'Bookshop', '84.50'],
    ],
    numbers: [],
  }

  it("asks for the missing currency at the recipe's bank with no article and no second bank, and drafts it under that bank with no IBAN, though the bank's other account holds one, opening at its last balance less the rows and their fees", () => {
    const reading = statementOfFile(statementRecipesOf(book), cells, 'statement.csv', book, en.feeOn)

    expect('refused' in reading && refusalLine(reading.refused, reading.missing)).toBe('Add a bank account in GBP at Example bank to bring in this file')
    expect(reading.missing.map(({ account }) => account)).toEqual([
      {
        name: 'Example bank GBP',
        kind: 'bank',
        bank: 'Example bank',
        currency: 'GBP',
        iban: '',
        // 84.50 less the rows -10.00 and -5.00 with its 0.50 fee.
        opening: accountMoneyFromAmount(100),
        openedOn: civil('2026-10-02'),
        sources: [{ source: 'provider-file', from: null }],
        cards: [],
        closed: false,
      },
    ])
  })

  it("brings the rows in once the drafted account is added, each fee as the bank's own row, and pairs no rows as a pocket move since the recipe reads no product", () => {
    const [drafted] = statementOfFile(statementRecipesOf(book), cells, 'statement.csv', book, en.feeOn).missing
    const gbp = account(10, drafted!.account)
    const withDrafted = { ...book, accounts: [...book.accounts, gbp] }
    const reading = statementOfFile(statementRecipesOf(withDrafted), cells, 'statement.csv', withDrafted, en.feeOn)
    const rows = 'statement' in reading ? reading.statement.rows : []
    const fees = category('Money and fees/Bank fees').id

    expect(rows.map((row) => [row.account, row.amount, row.payee, row.category, row.movedAt, row.pocket])).toEqual([
      [current.id, accountMoneyFromAmount(-20), 'To savings', null, '', false],
      [current.id, accountMoneyFromAmount(20), 'From current', null, '', false],
      [current.id, accountMoneyFromAmount(-40), 'Fuel station', null, '', false],
      [current.id, accountMoneyFromAmount(-1.5), 'Example bank', fees, '', false],
      [gbp.id, accountMoneyFromAmount(-10), 'Pub', null, '', false],
      [gbp.id, accountMoneyFromAmount(-5), 'Bookshop', null, '', false],
      [gbp.id, accountMoneyFromAmount(-0.5), 'Example bank', fees, '', false],
    ])
  })

  it('pairs a current row and a savings row of the opposite amount in one second as a pocket move, for a recipe that reads the product', () => {
    const sections = EXAMPLE_BANK.recipe.sections.map((section) => ({ ...section, fields: { ...section.fields, product: { from: 'Product', as: 'text' } as const } }))
    const withProduct = { ...EXAMPLE_BANK, recipe: { ...EXAMPLE_BANK.recipe, sections } }
    const savings = account(10, { ...current, name: 'Example bank savings', kind: 'savings', iban: '' })
    const withSavings = { ...book, accounts: [...book.accounts, savings], recipes: [withProduct] }
    const pocketCells = {
      texts: [
        ['Booked', 'Amount', 'Fee', 'Currency', 'Details', 'Balance', 'Product'],
        ['2026-10-01 10:00:00', '-20.00', '', 'EUR', 'To savings', '', 'Current'],
        ['2026-10-01 10:00:00', '20.00', '', 'EUR', 'From current', '', 'Savings'],
      ],
      numbers: [],
    }
    const reading = statementOfFile(statementRecipesOf(withSavings), pocketCells, 'statement.csv', withSavings, en.feeOn)

    expect('statement' in reading && reading.statement.rows.map((row) => [row.account, row.amount, row.movedAt, row.pocket])).toEqual([
      [current.id, accountMoneyFromAmount(-20), '2026-10-01 10:00:00', true],
      [savings.id, accountMoneyFromAmount(20), '2026-10-01 10:00:00', true],
    ])
  })
})
