import { describe, expect, it } from 'vitest'

import { STATEMENT_RECIPE_FIELDS } from '../src/apps/spending/statements/domain/statementRecipeDraft'
import { REVOLUT_STATEMENT } from '../src/apps/spending/statements/domain/revolutRecipe'
import { draftOfInput, inputOfDraft } from '../src/shared/recipes/domain/draftInput'
import { DRAFT_DATE_FORMATS, draftOfRecipe, draftProblems, placeOfProblem, tableRecipeOf } from '../src/shared/recipes/domain/tableRecipeDraft'
import type { TableRecipeDraft } from '../src/shared/recipes/domain/tableRecipeDraft'
import { runRecipe } from '../src/shared/recipes/domain/runRecipe'
import { tableRows } from '../src/shared/recipes/domain/tableRows'
import { dayExample } from '../src/shared/recipes/presentation/dayExample'
import { recipeErrorsOf } from '../src/shared/recipes/presentation/recipeErrors'

const DRAFT: TableRecipeDraft = {
  name: 'Example bank',
  date: { column: 'Datum', format: 'dd.MM.yyyy HH:mm' },
  amount: { debit: 'Isplata', credit: 'Uplata' },
  mark: 'comma',
  columns: { description: 'Opis' },
  kinds: [
    { kind: 'payment', test: { column: 'Status', is: ['Booked'] } },
    { kind: 'not-completed', test: { column: 'Status', filled: true } },
  ],
}

describe('a table recipe draft', () => {
  it('makes a recipe whose kinds that come in read the day, its time, the pair and the payee, and whose counted kinds read nothing', () => {
    const made = tableRecipeOf('example', DRAFT, STATEMENT_RECIPE_FIELDS)
    if (!('recipe' in made)) throw new Error(made.problems.map((problem) => problem.kind).join(', '))
    const cells = [
      ['Datum', 'Opis', 'Isplata', 'Uplata', 'Status'],
      ['02.11.2026 14:05', 'Corner market', '1.234,50', '', 'booked'],
      ['03.11.2026 09:00', 'Refund', '', '', 'Declined'],
    ]
    const table = tableRows(made.recipe, { texts: cells, numbers: [] })
    if (table.kind !== 'read') throw new Error(table.misfit.kind)
    const run = runRecipe(made.recipe, table)
    if (run.kind !== 'read') throw new Error(run.misfit.kind)

    expect(run.rows.map((row) => [row.kind, row.dates['started'] ?? null, row.texts['startedTime'] ?? null, row.texts['description'] ?? null])).toEqual([
      ['payment', '2026-11-02', '14:05:00', 'Corner market'],
      ['not-completed', null, null, null],
    ])
    expect(run.rows[0]!.decimals['debit']).not.toBeNull()
  })

  it('reads back as the draft it was written from, and through the input an operation takes', () => {
    const made = tableRecipeOf('example', DRAFT, STATEMENT_RECIPE_FIELDS)
    if (!('recipe' in made)) throw new Error(made.problems.map((problem) => problem.kind).join(', '))
    expect(draftOfRecipe(made.recipe, STATEMENT_RECIPE_FIELDS)).toEqual(DRAFT)
    expect(draftOfInput(JSON.parse(JSON.stringify(inputOfDraft(DRAFT, STATEMENT_RECIPE_FIELDS))) as Readonly<Record<string, never>>)).toEqual(DRAFT)
  })

  it("gives no draft of Revolut's recipe, whose kinds test two columns", () => {
    expect(draftOfRecipe(REVOLUT_STATEMENT.recipe, STATEMENT_RECIPE_FIELDS)).toBeNull()
  })

  it.each([
    [{ ...DRAFT, name: ' ' }, ['no-name']],
    [{ ...DRAFT, date: { column: '', format: 'dd.MM.yyyy' } }, ['no-date']],
    [{ ...DRAFT, amount: { debit: 'Isplata', credit: '' } }, ['no-amount']],
    [{ ...DRAFT, amount: { debit: 'Opis', credit: 'Uplata' } }, ['doubled-column']],
    [{ ...DRAFT, kinds: [] }, ['no-kind']],
    [{ ...DRAFT, kinds: [{ kind: 'not-completed', test: null }] }, ['nothing-comes-in']],
    [{ ...DRAFT, kinds: [{ kind: 'payment', test: { column: 'Status', is: [' '] } }] }, ['test-no-value']],
    [{ ...DRAFT, kinds: [{ kind: 'transfer', test: null }] }, ['unknown-kind', 'nothing-comes-in']],
  ] as const)('names what a draft lacks: %#', (draft, problems) => {
    expect(draftProblems(draft, STATEMENT_RECIPE_FIELDS).map((problem) => problem.kind)).toEqual(problems)
  })

  it('names every problem at once, each kind by its place, so a person fixes them in one go', () => {
    const draft: TableRecipeDraft = {
      ...DRAFT,
      name: '',
      amount: { column: '' },
      kinds: [
        { kind: 'payment', test: null },
        { kind: 'not-completed', test: { column: ' ', is: [] } },
      ],
    }
    const problems = draftProblems(draft, STATEMENT_RECIPE_FIELDS)

    expect(problems.map(placeOfProblem)).toEqual(['name', 'amount', { at: 1, part: 'column' }, { at: 1, part: 'values' }])
  })

  it('shows each problem under its field, and a rule across fields only once every field is fine', () => {
    const fieldsAndRule = recipeErrorsOf([
      { place: 'name', text: 'Name it.' },
      { place: { at: 0, part: 'values' }, text: 'Type a value.' },
      { place: 'across', text: 'Bring rows in.' },
    ])
    expect(fieldsAndRule).toEqual({ fields: { name: 'Name it.' }, kinds: { 0: { values: 'Type a value.' } }, across: null })
    expect(recipeErrorsOf([{ place: 'across', text: 'Bring rows in.' }]).across).toBe('Bring rows in.')
  })

  it('reads back every draft it accepts, for each day format and either amount shape', () => {
    const drafts = DRAFT_DATE_FORMATS.flatMap((format) => [
      { ...DRAFT, date: { column: 'Datum', format } },
      { ...DRAFT, date: { column: 'Datum', format }, amount: { column: 'Iznos' }, mark: 'point' as const, columns: { fee: 'Naknada', currency: 'Valuta' } },
    ])

    expect(drafts.map((draft) => 'recipe' in tableRecipeOf('example', draft, STATEMENT_RECIPE_FIELDS))).toEqual(drafts.map(() => true))
  })

  it('shows each day format by how it writes the last day of 2026', () => {
    expect(DRAFT_DATE_FORMATS.map(dayExample)).toEqual([
      '2026-12-31',
      '2026-12-31 14:30:00',
      '31.12.2026',
      '31.12.2026.',
      '31.12.2026 14:30',
      '31.12.2026. 14:30',
      '31/12/2026',
      '12/31/2026',
      '31-12-2026',
    ])
  })
})
