import { describe, expect, it } from 'vitest'

import { exportReminderDue } from '../src/features/excel/domain/exportReminder'
import { accountCellsOf, accountDraftErrors } from '../src/features/settings/domain/accountDrafts'
import type { AccountDraft } from '../src/features/settings/domain/accountDrafts'
import { categoryCellsOf, categoryDraftErrors } from '../src/features/settings/domain/categoryDrafts'
import type { CategoryDraft } from '../src/features/settings/domain/categoryDrafts'
import { cellOfDraftText, cellsOfDrafts, draftTextOf, draftsOfRows } from '../src/features/settings/domain/tabRowDrafts'
import { GRANT_COLUMNS, YEAR_END_COLUMNS, assetColumns } from '../src/features/settings/presentation/factTabColumns'
import { fakeWorkbookSnapshot } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { readAssets } from '../src/features/workbook/infrastructure/assetsTabReader'
import { readGrants } from '../src/features/workbook/infrastructure/grantsTabReader'
import { rowsFrom } from '../src/features/workbook/infrastructure/workbookTemplate'
import { readYearEnd } from '../src/features/workbook/infrastructure/yearEndTabReader'

function category(name: string, overrides: Partial<CategoryDraft> = {}): CategoryDraft {
  return { saved: 0, savedName: name, category: name, label: '', family: 'operating', bucket: 'operating', colour: '', roles: '', vat: '', ...overrides }
}

function account(name: string, overrides: Partial<AccountDraft> = {}): AccountDraft {
  return { saved: 0, savedName: name, account: name, label: '', iban: '', currency: '', ...overrides }
}

describe('the categories editor', () => {
  it('accepts a tab that follows the Sheet rules', () => {
    expect(categoryDraftErrors([category('software'), category('travel', { roles: 'watched' })], new Set(['software']))).toEqual(new Map())
  })

  it('needs category, family and a bucket from the six, and each category once', () => {
    const errors = categoryDraftErrors(
      [category('software'), category('Software', { saved: null, savedName: '' }), category('', { family: ' ', bucket: 'expenses' })],
      new Set(),
    )

    expect(errors.get(1)).toEqual({ category: 'Already used above' })
    expect(errors.get(2)).toEqual({ category: 'Required', family: 'Required', bucket: 'Not one of the six buckets' })
  })

  it('keeps the name of a category the ledger uses, but lets a later duplicate of it be renamed', () => {
    const drafts = [category('tools', { savedName: 'software' }), category('software-copy', { saved: 1, savedName: 'software' })]

    const errors = categoryDraftErrors(drafts, new Set(['software']))

    expect(errors.get(0)?.category).toMatch(/keeps its name/)
    expect(errors.has(1)).toBe(false)
  })

  it('writes the cells in lower case and keeps other columns of a saved row', () => {
    const cells = categoryCellsOf([category(' Software ', { roles: 'Revenue,  watched ,' })], new Map([[0, { category: 'software', note: 'mine' }]]))

    expect(cells).toEqual([{ category: 'software', label: '', family: 'operating', bucket: 'operating', colour: '', roles: 'revenue, watched', vat: '', note: 'mine' }])
  })
})

describe('the categories editor and VAT', () => {
  it('writes a VAT treatment in lower case and refuses one the app does not know', () => {
    expect(categoryCellsOf([category('software', { vat: ' Reverse-Charge ' })], new Map())[0]?.vat).toBe('reverse-charge')
    expect(categoryDraftErrors([category('software', { vat: 'half' })], new Set()).get(0)).toEqual({ vat: 'Not a VAT treatment the app knows' })
    expect(categoryDraftErrors([category('software', { vat: '' })], new Set()).size).toBe(0)
  })
})

describe('the assets, grants and year-end editors', () => {
  it('turn field text into the cells the tab holds: dates as date cells, a percent as a fraction, a flag as TRUE', () => {
    expect(cellOfDraftText('2025-06-01', 'date')).toBe(45809)
    expect(cellOfDraftText('1.6.2025', 'date')).toBe('1.6.2025')
    expect(cellOfDraftText('10', 'percent')).toBe(0.1)
    expect(cellOfDraftText(' 1519.20 ', 'amount')).toBe(1519.2)
    expect(cellOfDraftText('lots', 'amount')).toBe('lots')
    expect(cellOfDraftText('TRUE', 'flag')).toBe(true)
    expect(cellOfDraftText('Whole', 'amount-or-word')).toBe('whole')
    expect(cellOfDraftText('2500', 'amount-or-word')).toBe(2500)
    expect(cellOfDraftText(' Computers ', 'word')).toBe('computers')
    expect(cellOfDraftText('   ', 'text')).toBe('')
    expect(draftTextOf(45809, 'date')).toBe('2025-06-01')
    expect(draftTextOf(0.1, 'percent')).toBe('10')
    expect(draftTextOf(0.125, 'percent')).toBe('12.5')
    expect(draftTextOf(true, 'flag')).toBe('TRUE')
  })

  it('read the fake workbook into fields and write the same cells back, so an unchanged tab saves as it was', () => {
    const snapshot = fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z', 'excel')
    for (const [rows, columns] of [
      [snapshot.assets, assetColumns(['startup-grant'])],
      [snapshot.grants, GRANT_COLUMNS],
      [snapshot['year-end'], YEAR_END_COLUMNS],
    ] as const) {
      const saved = new Map(rows.map((row, place) => [place, row.cells]))
      expect(rowsFrom(cellsOfDrafts(draftsOfRows(rows, columns), columns, saved))).toEqual(rows)
    }
  })

  it('give each year-end amount the field its line needs', () => {
    const snapshot = fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z', 'excel')
    const drafts = draftsOfRows(snapshot['year-end'], YEAR_END_COLUMNS)
    const amountOf = (line: string): string | undefined => drafts.find((draft) => draft.fields.line === line)?.fields.amount

    expect(amountOf('rate')).toBe('10')
    expect(amountOf('filed-on')).toBe('2026-04-27')
    expect(amountOf('months-of-operation')).toBe('8')
    expect(amountOf('sales')).toBe('57147.33')
  })

  it('check a draft with the tab reader, so a row the workbook would leave out cannot be saved', () => {
    const drafts = [
      { saved: null, fields: { asset: 'Laptop', bought: '2026-01-09', cost_net: '749.50', group: 'computers' } },
      { saved: null, fields: { asset: 'Lamp', bought: '2026-01-09', cost_net: '-1', group: 'other' } },
    ]
    const columns = assetColumns([])
    // A new row gets its id when it is saved, so the editor reads it with one.
    const reading = readAssets(rowsFrom(cellsOfDrafts(drafts, columns, new Map()).map((cells, index) => ({ ...cells, id: `new-${index}` }))), new Set())

    expect(reading.facts.map((asset) => [asset.name, asset.inUse, asset.costNet])).toEqual([['Laptop', '2026-01-09', 74950]])
    expect(reading.problems.map((problem) => [problem.label, problem.reason])).toEqual([['Lamp', 'cost_net must be more than zero']])
    expect(readGrants(rowsFrom(cellsOfDrafts([{ saved: null, fields: { grant: 'Startup', received: '2026-01-09', amount: '100', release: 'fixed-then-assets' } }], GRANT_COLUMNS, new Map()))).problems.map((problem) => [problem.label, problem.reason])).toEqual([
      ['startup', 'a fixed-then-assets release needs fixed_part and variable_part'],
    ])
    const yearEndCells = cellsOfDrafts([{ saved: null, fields: { year: '2025', statement: 'tax', line: 'rate', amount: '10' } }], YEAR_END_COLUMNS, new Map())
    expect(readYearEnd(rowsFrom(yearEndCells.map((cells) => ({ ...cells, id: 'new-0' }))), new Set()).facts[0]?.figure).toEqual({
      kind: 'rate',
      basisPoints: 1000,
    })
  })
})

describe('the accounts editor', () => {
  it('needs a name, each once, keeps a used name and checks a currency if one is given', () => {
    const errors = accountDraftErrors(
      [account('main'), account('Main', { saved: null, savedName: '' }), account('savings', { savedName: 'old' }), account('cards', { currency: 'EURO' })],
      new Set(['old']),
    )

    expect(errors.get(1)).toEqual({ account: 'Already used above' })
    expect(errors.get(2)?.account).toMatch(/keeps its name/)
    expect(errors.get(3)?.currency).toMatch(/three-letter/)
    expect(errors.has(0)).toBe(false)
  })

  it('writes a normalised IBAN and an upper-case currency', () => {
    expect(accountCellsOf([account('Main', { iban: 'xx00 fake 0001', currency: 'eur' })], new Map())).toEqual([
      { account: 'main', label: '', iban: 'XX00FAKE0001', currency: 'EUR' },
    ])
  })
})

describe('the export reminder', () => {
  const now = new Date('2026-10-16T09:00:00.000Z')

  it('stays quiet while every change is exported or the oldest is under a week old', () => {
    expect(exportReminderDue(null, now)).toBe(false)
    expect(exportReminderDue('2026-10-09T09:00:01.000Z', now)).toBe(false)
  })

  it('speaks up once the oldest unexported change is seven days old', () => {
    expect(exportReminderDue('2026-10-09T09:00:00.000Z', now)).toBe(true)
  })
})
