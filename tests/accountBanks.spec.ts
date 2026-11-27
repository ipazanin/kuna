import { describe, expect, it } from 'vitest'

import { recipeAccount } from '../src/apps/company/imports/domain/tableRecipes'
import { currencyCodeOf } from '../src/shared/money/currencyCode'
import { accountBankNames, sharedBanks } from '../src/apps/company/workbook/domain/accountBanks'
import { ACCOUNT_CODEC } from '../src/apps/company/workbook/domain/accountsReading'
import { ACCOUNT_RECORDS, SETTING_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { readWorkbook, workbookRecordsOf } from '../src/apps/company/workbook/domain/readWorkbook'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { recordsOfRows, spreadsheetTabOfKind } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import type { Cells } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { BY_HAND_SOURCES } from '../src/apps/company/workbook/domain/workbook'

describe("an account's bank", () => {
  it('reads and writes the bank field, trimmed, a blank one as no bank', () => {
    const id = recordIdOf(ACCOUNT_RECORDS, 'main')
    const named = ACCOUNT_CODEC.make(storedFieldsOfValues({ account: 'main', bank: '  Primjer banka ' }), id)

    expect(named.bank).toBe('Primjer banka')
    expect(ACCOUNT_CODEC.fieldsOf(named)).toMatchObject({ bank: 'Primjer banka' })
    expect(ACCOUNT_CODEC.make(storedFieldsOfValues({ account: 'main' }), id).bank).toBe('')
    expect(ACCOUNT_CODEC.fieldsOf(ACCOUNT_CODEC.make(storedFieldsOfValues({ account: 'main' }), id))).not.toHaveProperty('bank')
  })

  it('reads an import profile older books still hold as a retired key, which gives its account no bank and reports nothing', () => {
    const rows: Readonly<Record<string, Cells>> = {
      [ACCOUNT_RECORDS.name]: { account: 'main', sources: 'by-hand' },
      [SETTING_RECORDS.name]: { key: 'import_profile_erste-business', value: 'account=main; date=Datum; amount=Iznos' },
    }
    const records = workbookRecordsOf((kind) => recordsOfRows(spreadsheetTabOfKind(kind), rows[kind.name] === undefined ? [] : [{ sheetRow: 2, cells: rows[kind.name]! }]), null)
    const workbook = readWorkbook({ id: 'books', source: 'browser', title: 'Books', syncedAt: '2026-11-23T00:00:00.000Z' }, records, null)

    expect(workbook.accounts).toEqual([{ slug: 'main', label: '', iban: '', currency: '', bank: '', sources: BY_HAND_SOURCES }])
    expect(workbook.problems).toEqual([])
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
