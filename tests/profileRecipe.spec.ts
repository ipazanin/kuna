import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { importRecipes, statementReadings } from '../src/apps/company/imports/application/importStatements'
import { moveProfilesToRecipes } from '../src/apps/company/imports/application/recipeWrites'
import { profileValue } from '../src/apps/company/imports/domain/importProfile'
import type { ImportProfile } from '../src/apps/company/imports/domain/importProfile'
import { recipeOfProfile } from '../src/apps/company/imports/domain/profileRecipe'
import { companyBooksOf } from '../src/apps/company/workbook/domain/readWorkbook'
import type { CellValue } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { forgetCaches, driveHarness, workbookGrids } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const PROFILE: ImportProfile = {
  name: 'primjer-banka',
  account: 'main',
  date: 'Datum',
  dateFormat: 'dd.mm.yyyy',
  decimal: 'comma',
  amount: { signed: 'Iznos' },
  balance: '',
  counterparty: 'Naziv',
  counterpartyIban: '',
  description: 'Opis',
  reference: '',
}

const ORPHAN: ImportProfile = { ...PROFILE, name: 'old-bank', account: 'closed' }

const CELLS = [
  ['Datum', 'Naziv', 'Opis', 'Iznos'],
  ['17.10.2026', 'KAVANA PRIMJER', 'Kartično plaćanje', '-3,40'],
]

function grids(): Record<string, CellValue[][]> {
  const base = workbookGrids()
  return {
    ...base,
    accounts: [
      ['account', 'iban'],
      ['main', 'XX00FAKE0000000001'],
      ['savings', 'HR1723600001101234565'],
    ],
    settings: [...base.settings!, ['import_profile_primjer-banka', profileValue(PROFILE)], ['import_profile_old-bank', profileValue(ORPHAN)]],
  }
}

describe('moving import profiles to recipes', () => {
  it('reads a profile before the move as the recipe the move keeps, into the account it named by the bank it gives that account', async () => {
    const { store } = await driveHarness(used, grids())
    const workbook = store.state.workbook!
    const [primjer, orphan] = importRecipes(workbook)

    expect(workbook.accounts.find((account) => account.slug === 'main')?.bank).toBe('Primjer banka')
    expect(primjer?.saved).toMatchObject({ bank: 'Primjer banka', currency: 'EUR', recipe: { name: 'primjer-banka' } })
    const [reading] = statementReadings({ kind: 'table', fileName: 'promet.csv', fileHash: 'f'.repeat(64), cells: CELLS }, workbook, primjer!.saved)
    expect(reading).toMatchObject({ statement: { account: 'main', rows: [{ date: '2026-10-17', counterparty: 'KAVANA PRIMJER' }] } })
    expect(orphan?.saved).toMatchObject({ bank: 'Old bank', currency: 'EUR' })
    expect(statementReadings({ kind: 'table', fileName: 'promet.csv', fileHash: 'f'.repeat(64), cells: CELLS }, workbook, orphan!.saved)[0]).toMatchObject({
      refusal: 'No account of Old bank keeps EUR. Give the account the file is of the bank Old bank on Settings, Accounts.',
    })
  })

  it('writes a recipe per profile, the bank onto the account it named and the profiles off the settings in one write, which one Undo puts back', async () => {
    const { store } = await driveHarness(used, grids())
    const before = importRecipes(store.state.workbook!).map((recipe) => recipe.saved)
    await store.write('Moved', (unit) => moveProfilesToRecipes(unit, companyBooksOf(store.state)!))
    const moved = store.state.workbook!

    expect(moved.settings.importProfiles).toEqual([])
    expect(moved.recipes).toEqual(before)
    expect(moved.accounts.map((account) => [account.slug, account.bank])).toEqual([
      ['main', 'Primjer banka'],
      ['savings', ''],
    ])
    expect(store.state.records!.accounts.records.find((stored) => stored.record.slug === 'main')?.record.bank).toBe('Primjer banka')
    expect(importRecipes(moved).map((recipe) => recipe.saved)).toEqual(before)

    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.recipes).toEqual([])
    expect(store.state.workbook!.settings.importProfiles.map((profile) => profile.name)).toEqual(['primjer-banka', 'old-bank'])
  })

  it('keeps the bank an account names over the one its profile would give', () => {
    expect(recipeOfProfile(PROFILE, [{ slug: 'main', bank: 'Erste', currency: 'USD' }], 'EUR')).toMatchObject({ bank: 'Erste', currency: 'USD' })
  })
})
