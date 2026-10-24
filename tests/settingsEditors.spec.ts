import { describe, expect, it } from 'vitest'

import { exportReminderDue } from '../src/features/excel/domain/exportReminder'
import { accountDraftErrors, accountsOfDrafts } from '../src/features/settings/domain/accountDrafts'
import type { AccountDraft } from '../src/features/settings/domain/accountDrafts'
import { categoriesOfDrafts, categoryDraftErrors } from '../src/features/settings/domain/categoryDrafts'
import type { CategoryDraft } from '../src/features/settings/domain/categoryDrafts'
import { knownRoles } from '../src/features/settings/domain/categoryGuards'
import { installedPack } from '../src/features/packs/packContribution'
import { draftOutcomes, draftTextOf, draftsOfRecords, fieldsOfDrafts, madeOfDrafts, valueOfDraftText } from '../src/features/settings/domain/recordDrafts'
import type { DraftColumn, DraftFactory, MadeDraft, RecordDraft } from '../src/features/settings/domain/recordDrafts'
import { storedOf } from '../src/features/workbook/domain/recordsRead'
import type { RecordId } from '../src/features/workbook/domain/recordId'
import type { RecordsRead, RefusedRecord } from '../src/features/workbook/domain/recordsRead'
import { storedFieldOf } from '../src/features/workbook/domain/storedFields'
import { GRANT_COLUMNS, YEAR_END_COLUMNS, assetColumns } from '../src/packs/hr-doo/presentation/editorColumns'
import { fakeWorkbookSnapshot } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { assetOfFields, readAssets } from '../src/packs/hr-doo/domain/assets/assetsReading'
import { grantOfFields, readGrants } from '../src/packs/hr-doo/domain/grants/grantsReading'
import { readYearEnd, yearEndLineOfFields } from '../src/packs/hr-doo/domain/yearEnd/yearEndReading'
import { CLIENT_COLUMNS } from '../src/features/settings/presentation/factTabColumns'
import { clientOfFields } from '../src/features/workbook/domain/clientsReading'
import { CORE_TABS, recordsOfRows } from '../src/features/workbook/infrastructure/spreadsheetTab'
import type { SpreadsheetTab } from '../src/features/workbook/infrastructure/spreadsheetTab'
import { ASSETS_TAB, GRANTS_TAB, YEAR_END_TAB } from '../src/packs/hr-doo/infrastructure/hrDooTabs'
import { sheetRowsFromValues } from '../src/features/workbook/infrastructure/workbookSnapshot'
import type { SheetRow } from '../src/features/workbook/infrastructure/workbookSnapshot'

function category(name: string, overrides: Partial<CategoryDraft> = {}): CategoryDraft {
  return { saved: 0, savedName: name, category: name, label: '', family: 'operating', bucket: 'operating', colour: '', roles: '', vat: '', ...overrides }
}

/** A stored record the editor opened with: the fields given, refused, as a row with other columns would be. */
function storedWith(fields: Readonly<Record<string, string>>): RefusedRecord {
  return { id: null, label: 'stored', fields: Object.fromEntries(Object.entries(fields).map(([name, text]) => [name, storedFieldOf(text)])), reason: 'stored' }
}

/** The records the drafts make, each refused one as its reason. */
function made<R>(drafts: readonly RecordDraft[], columns: readonly DraftColumn[], make: DraftFactory<R>): MadeDraft<R>[] {
  return madeOfDrafts(drafts, fieldsOfDrafts(drafts, columns, []), [], make)
}

function account(name: string, overrides: Partial<AccountDraft> = {}): AccountDraft {
  return { saved: 0, savedName: name, account: name, label: '', iban: '', currency: '', ...overrides }
}

/** The roles core and the installed pack pick categories by. */
const ROLES = knownRoles(installedPack().workbook?.categoryRoles ?? [])

describe('the categories editor', () => {
  it('accepts a tab that follows the Sheet rules', () => {
    expect(categoryDraftErrors([category('software'), category('travel', { roles: 'watched' })], new Set(['software']), ROLES)).toEqual(new Map())
  })

  it('needs category, family and a bucket from the six, and each category once', () => {
    const errors = categoryDraftErrors(
      [category('software'), category('Software', { saved: null, savedName: '' }), category('', { family: ' ', bucket: 'expenses' })],
      new Set(),
      ROLES,
    )

    expect(errors.get(1)).toEqual({ category: 'Already used above' })
    expect(errors.get(2)).toEqual({ category: 'Required', family: 'Required', bucket: 'Not one of the six buckets' })
  })

  it('keeps the name of a category the ledger uses, but lets a later duplicate of it be renamed', () => {
    const drafts = [category('tools', { savedName: 'software' }), category('software-copy', { saved: 1, savedName: 'software' })]

    const errors = categoryDraftErrors(drafts, new Set(['software']), ROLES)

    expect(errors.get(0)?.category).toMatch(/keeps its name/)
    expect(errors.has(1)).toBe(false)
  })

  it('marks a role the app does not know, such as a typo, so the save waits until it is fixed', () => {
    const errors = categoryDraftErrors([category('software', { roles: 'revenu, watched' }), category('travel', { roles: 'client-refund, non-deductible' })], new Set(), ROLES)

    expect(errors.get(0)).toEqual({ roles: 'Not a role the app knows: revenu' })
    expect(errors.has(1)).toBe(false)
  })

  it('makes the category in lower case', () => {
    const [software] = categoriesOfDrafts([storedWith({ category: 'software', note: 'mine' })], [category(' Software ', { roles: 'Revenue,  watched ,' })])

    expect(software).toMatchObject({ saved: 0, record: { slug: 'software', label: '', family: 'operating', bucket: 'operating', colour: { swatch: null, stored: '' }, roles: ['revenue', 'watched'], vat: 'none' } })
  })
})

describe('the categories editor and VAT', () => {
  it('writes a VAT treatment in lower case and refuses one the app does not know', () => {
    expect(categoriesOfDrafts([], [category('software', { saved: null, vat: ' Reverse-Charge ' })])[0]).toMatchObject({ record: { vat: 'reverse-charge' } })
    expect(categoryDraftErrors([category('software', { vat: 'half' })], new Set(), ROLES).get(0)).toEqual({ vat: 'Not a VAT treatment the app knows' })
    expect(categoryDraftErrors([category('software', { vat: '' })], new Set(), ROLES).size).toBe(0)
  })
})

describe('the assets, grants and year-end editors', () => {
  it('turn field text into the values the workbook holds: dates as dates, a percent as a fraction, a flag as TRUE', () => {
    expect(valueOfDraftText('2025-06-01', 'date')).toBe(45809)
    expect(valueOfDraftText('1.6.2025', 'date')).toBe('1.6.2025')
    expect(valueOfDraftText('10', 'percent')).toBe(0.1)
    expect(valueOfDraftText(' 1519.20 ', 'amount')).toBe(1519.2)
    expect(valueOfDraftText('lots', 'amount')).toBe('lots')
    expect(valueOfDraftText('TRUE', 'flag')).toBe(true)
    expect(valueOfDraftText('Whole', 'amount-or-word')).toBe('whole')
    expect(valueOfDraftText('2500', 'amount-or-word')).toBe(2500)
    expect(valueOfDraftText(' Computers ', 'word')).toBe('computers')
    expect(valueOfDraftText('   ', 'text')).toBe('')
    expect(valueOfDraftText(' gb82 west 1234 5698 7654 32,, IE29AIBK93115212345678 ', 'iban-list')).toBe('GB82WEST12345698765432, IE29AIBK93115212345678')
    expect(draftTextOf(storedFieldOf(45809), 'date')).toBe('2025-06-01')
    expect(draftTextOf(storedFieldOf(0.1), 'percent')).toBe('10')
    expect(draftTextOf(storedFieldOf(0.125), 'percent')).toBe('12.5')
    expect(draftTextOf(storedFieldOf(true), 'flag')).toBe('TRUE')
  })

  it('draft the fake workbook and make the same records back, so an unchanged tab saves nothing', () => {
    const snapshot = fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z', 'excel')
    const sameBack = <R extends { readonly id: RecordId }>(tab: SpreadsheetTab<R>, rows: readonly SheetRow[], columns: readonly DraftColumn[], make: DraftFactory<R>) => {
      const stored = storedOf(recordsOfRows(tab, rows))
      const drafts = draftsOfRecords(stored, columns)
      expect(madeOfDrafts(drafts, fieldsOfDrafts(drafts, columns, stored), stored, make)).toEqual(stored.map((read, saved) => ({ saved, record: (read as { readonly record: R }).record })))
    }
    sameBack(ASSETS_TAB, snapshot.assets, assetColumns(['startup-grant']), assetOfFields)
    sameBack(GRANTS_TAB, snapshot.grants, GRANT_COLUMNS, grantOfFields)
    sameBack(YEAR_END_TAB, snapshot['year-end'], YEAR_END_COLUMNS, yearEndLineOfFields)
  })

  it('draft a client with two IBANs and every invoice detail and make the same record back, so a save keeps its invoice columns', () => {
    const stored = storedOf(
      recordsOfRows(
        CORE_TABS.clients,
        sheetRowsFromValues([
          ['client', 'name', 'iban', 'address', 'country', 'tax_id', 'invoice_mail', 'mail_language', 'reverse_charge'],
          ['northwind', 'Northwind', 'GB82WEST12345698765432, IE29AIBK93115212345678', '1 Example Road', 'United Kingdom', 'GB000000000', 'ap@northwind.example', 'hr', true],
        ]),
      ),
    )
    const drafts = draftsOfRecords(stored, CLIENT_COLUMNS)

    expect(madeOfDrafts(drafts, fieldsOfDrafts(drafts, CLIENT_COLUMNS, stored), stored, clientOfFields)).toEqual(stored.map((read, saved) => ({ saved, record: (read as { readonly record: unknown }).record })))
  })

  it('give each year-end amount the field its line needs', () => {
    const snapshot = fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z', 'excel')
    const drafts = draftsOfRecords(storedOf(recordsOfRows(YEAR_END_TAB, snapshot['year-end'])), YEAR_END_COLUMNS)
    const amountOf = (line: string): string | undefined => drafts.find((draft) => draft.fields.line === line)?.fields.amount

    expect(amountOf('rate')).toBe('10')
    expect(amountOf('filed-on')).toBe('2026-04-27')
    expect(amountOf('months-of-operation')).toBe('8')
    expect(amountOf('sales')).toBe('57147.33')
  })

  it('check a draft with the kind’s reader, so a record the workbook would leave out cannot be saved', () => {
    const drafts = [
      { saved: null, fields: { asset: 'Laptop', bought: '2026-01-09', cost_net: '749.50', group: 'computers' } },
      { saved: null, fields: { asset: 'Lamp', bought: '2026-01-09', cost_net: '-1', group: 'other' } },
    ]
    const columns = assetColumns([])
    const assets = made(drafts, columns, assetOfFields)
    const fields = fieldsOfDrafts(drafts, columns, [])

    expect(assets.map((draft) => ('record' in draft ? [draft.record.name, draft.record.inUse, draft.record.costNet] : draft.refused))).toEqual([['Laptop', '2026-01-09', 74950], 'cost_net must be more than zero'])
    expect(draftOutcomes(assets, fields, (records) => readAssets(records, new Set()))).toEqual([
      { kept: true, reasons: [] },
      { kept: false, reasons: ['cost_net must be more than zero'] },
    ])
    const grant = [{ saved: null, fields: { grant: 'Startup', received: '2026-01-09', amount: '100', release: 'fixed-then-assets' } }]
    expect(draftOutcomes(made(grant, GRANT_COLUMNS, grantOfFields), fieldsOfDrafts(grant, GRANT_COLUMNS, []), (records: RecordsRead<ReturnType<typeof grantOfFields>>) => readGrants(records))).toEqual([
      { kept: false, reasons: ['a fixed-then-assets release needs fixed_part and variable_part'] },
    ])
    const [rate] = made([{ saved: null, fields: { year: '2025', statement: 'tax', line: 'rate', amount: '10' } }], YEAR_END_COLUMNS, yearEndLineOfFields)
    expect(rate).toMatchObject({ record: { figure: { kind: 'rate', basisPoints: 1000 } } })
    expect(draftOutcomes([rate!], [{}], (records) => readYearEnd(records, new Set())).map((outcome) => outcome.kept)).toEqual([true])
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

  it('makes the account with a normalised IBAN and an upper-case currency', () => {
    expect(accountsOfDrafts([], [account('Main', { saved: null, iban: 'xx00 fake 0001', currency: 'eur' })])).toMatchObject([
      { saved: null, record: { slug: 'main', label: '', iban: 'XX00FAKE0001', currency: 'EUR' } },
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
