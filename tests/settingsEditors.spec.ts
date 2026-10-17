import { describe, expect, it } from 'vitest'

import { exportReminderDue } from '../src/features/excel/domain/exportReminder'
import { accountCellsOf, accountDraftErrors } from '../src/features/settings/domain/accountDrafts'
import type { AccountDraft } from '../src/features/settings/domain/accountDrafts'
import { categoryCellsOf, categoryDraftErrors } from '../src/features/settings/domain/categoryDrafts'
import type { CategoryDraft } from '../src/features/settings/domain/categoryDrafts'

function category(name: string, overrides: Partial<CategoryDraft> = {}): CategoryDraft {
  return { sheetRow: 2, savedName: name, category: name, label: '', family: 'operating', bucket: 'operating', colour: '', roles: '', ...overrides }
}

function account(name: string, overrides: Partial<AccountDraft> = {}): AccountDraft {
  return { sheetRow: 2, savedName: name, account: name, label: '', iban: '', currency: '', ...overrides }
}

describe('the categories editor', () => {
  it('accepts a tab that follows the Sheet rules', () => {
    expect(categoryDraftErrors([category('software'), category('travel', { roles: 'watched' })], new Set(['software']))).toEqual(new Map())
  })

  it('needs category, family and a bucket from the six, and each category once', () => {
    const errors = categoryDraftErrors(
      [category('software'), category('Software', { sheetRow: null, savedName: '' }), category('', { family: ' ', bucket: 'expenses' })],
      new Set(),
    )

    expect(errors.get(1)).toEqual({ category: 'Already on row 1' })
    expect(errors.get(2)).toEqual({ category: 'Required', family: 'Required', bucket: 'Not one of the six buckets' })
  })

  it('keeps the name of a category the ledger uses, but lets a later duplicate of it be renamed', () => {
    const drafts = [category('tools', { savedName: 'software' }), category('software-copy', { sheetRow: 3, savedName: 'software' })]

    const errors = categoryDraftErrors(drafts, new Set(['software']))

    expect(errors.get(0)?.category).toMatch(/keeps its name/)
    expect(errors.has(1)).toBe(false)
  })

  it('writes the cells in lower case and keeps other columns of a saved row', () => {
    const cells = categoryCellsOf([category(' Software ', { roles: 'Revenue,  watched ,' })], new Map([[2, { category: 'software', note: 'mine' }]]))

    expect(cells).toEqual([{ category: 'software', label: '', family: 'operating', bucket: 'operating', colour: '', roles: 'revenue, watched', note: 'mine' }])
  })
})

describe('the accounts editor', () => {
  it('needs a name, each once, keeps a used name and checks a currency if one is given', () => {
    const errors = accountDraftErrors(
      [account('main'), account('Main', { sheetRow: null, savedName: '' }), account('savings', { savedName: 'old' }), account('cards', { currency: 'EURO' })],
      new Set(['old']),
    )

    expect(errors.get(1)).toEqual({ account: 'Already on row 1' })
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
