import { describe, expect, it } from 'vitest'

import { statementOfFile, statementRecipesOf } from '../src/apps/spending/statements/domain/recipeStatement'
import { en } from '../src/apps/spending/statements/domain/words'
import { refusalLine } from '../src/apps/spending/statements/presentation/readingLines'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { RECIPE_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { fakeRecipes } from '../src/apps/spending/workbook/infrastructure/fake/fakeRecipes'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { readRecipe } from '../src/shared/recipes/domain/readRecipe'
import { refusalOr, storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { account, ACCOUNTS, CATEGORIES } from './fixtures/spending'
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
