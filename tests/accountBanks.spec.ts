import { describe, expect, it } from 'vitest'

import { recipeAccount } from '../src/apps/company/imports/domain/tableRecipes'
import { currencyCodeOf } from '../src/shared/money/currencyCode'
import { profileValue } from '../src/apps/company/imports/domain/importProfile'
import type { ImportProfile } from '../src/apps/company/imports/domain/importProfile'
import { accountBankNames, accountsWithBanks, sharedBanks } from '../src/apps/company/workbook/domain/accountBanks'
import { ACCOUNT_CODEC } from '../src/apps/company/workbook/domain/accountsReading'
import { ACCOUNT_RECORDS, SETTING_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { readWorkbook, workbookRecordsOf } from '../src/apps/company/workbook/domain/readWorkbook'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { recordsOfRows, spreadsheetTabOfKind } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import type { Cells } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { BY_HAND_SOURCES } from '../src/apps/company/workbook/domain/workbook'

const PROFILE: ImportProfile = {
  name: 'erste-business',
  account: 'main',
  date: 'Datum',
  dateFormat: 'dd.mm.yyyy',
  decimal: 'comma',
  amount: { signed: 'Iznos' },
  balance: '',
  counterparty: '',
  counterpartyIban: '',
  description: '',
  reference: '',
}

describe("an account's bank", () => {
  it('reads and writes the bank field, trimmed, a blank one as no bank', () => {
    const id = recordIdOf(ACCOUNT_RECORDS, 'main')
    const named = ACCOUNT_CODEC.make(storedFieldsOfValues({ account: 'main', bank: '  Primjer banka ' }), id)

    expect(named.bank).toBe('Primjer banka')
    expect(ACCOUNT_CODEC.fieldsOf(named)).toMatchObject({ bank: 'Primjer banka' })
    expect(ACCOUNT_CODEC.make(storedFieldsOfValues({ account: 'main' }), id).bank).toBe('')
    expect(ACCOUNT_CODEC.fieldsOf(ACCOUNT_CODEC.make(storedFieldsOfValues({ account: 'main' }), id))).not.toHaveProperty('bank')
  })

  it('takes, on an account that names none, the bank of the first import profile by name that is for it, its words with the first letter capital', () => {
    const accounts = [
      { slug: 'main', bank: '' },
      { slug: 'savings', bank: 'Own banka' },
      { slug: 'cash', bank: '' },
    ]
    const profiles = [
      { name: 'zaba-export', account: 'main' },
      { name: 'erste-business', account: 'main' },
      { name: 'other', account: 'savings' },
    ]

    expect(accountsWithBanks(accounts, profiles).map((account) => account.bank)).toEqual(['Erste business', 'Own banka', ''])
  })

  it('shows the bank a profile gives on the books, before the profiles move to recipes', () => {
    const rows: Readonly<Record<string, Cells>> = {
      [ACCOUNT_RECORDS.name]: { account: 'main', sources: 'by-hand' },
      [SETTING_RECORDS.name]: { key: 'import_profile_erste-business', value: profileValue(PROFILE) },
    }
    const records = workbookRecordsOf((kind) => recordsOfRows(spreadsheetTabOfKind(kind), rows[kind.name] === undefined ? [] : [{ sheetRow: 2, cells: rows[kind.name]! }]), null)
    const workbook = readWorkbook({ id: 'books', source: 'browser', title: 'Books', syncedAt: '2026-11-23T00:00:00.000Z' }, records, null)

    expect(workbook.accounts).toEqual([{ slug: 'main', label: '', iban: '', currency: '', bank: 'Erste business', sources: BY_HAND_SOURCES }])
  })

  it('suggests each bank the accounts name once, in their order, two spellings of one bank as the first', () => {
    expect(accountBankNames([{ bank: 'Erste' }, { bank: '' }, { bank: 'Zaba' }, { bank: 'erste' }, { bank: 'Žaba' }])).toEqual(['Erste', 'Zaba'])
  })

  it('names the bank and currency two accounts share, as a recipe for that bank would refuse them, a blank currency as the books own', () => {
    const accounts = [
      { bank: 'Erste', currency: '' },
      { bank: 'erste', currency: 'EUR' },
      { bank: 'Erste', currency: 'USD' },
      { bank: '', currency: '' },
      { bank: '', currency: '' },
    ]

    expect(sharedBanks(accounts, 'EUR')).toEqual([{ bank: 'Erste', currency: 'EUR', accounts: 2 }, { bank: 'erste', currency: 'EUR', accounts: 2 }, null, null, null])
  })

  it('refuses a recipe for a bank and currency two accounts share, the accounts Settings warns beside', () => {
    const accounts = [
      { slug: 'main', bank: 'Erste', currency: '' },
      { slug: 'reserve', bank: 'erste', currency: 'EUR' },
      { slug: 'dollars', bank: 'Erste', currency: 'USD' },
    ]

    expect(recipeAccount({ bank: 'Erste', currency: null }, accounts, 'EUR')).toEqual({ kind: 'many', bank: 'Erste', currency: 'EUR', accounts: ['main', 'reserve'] })
    expect(recipeAccount({ bank: 'ERSTE', currency: currencyCodeOf('USD') }, accounts, 'EUR')).toEqual({ kind: 'found', account: 'dollars' })
    expect(sharedBanks(accounts, 'EUR').map((shared) => shared !== null)).toEqual([true, true, false])
  })
})
