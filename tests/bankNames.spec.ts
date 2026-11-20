import { describe, expect, it } from 'vitest'

import { bankNamesOf } from '../src/apps/spending/accounts/domain/bankNames'
import { codecOfSpendingKind } from '../src/apps/spending/workbook/application/spendingCodecs'
import { sameBank } from '../src/apps/spending/workbook/domain/account'
import { ACCOUNT_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'

const CODEC = codecOfSpendingKind(ACCOUNT_RECORDS)

function bankRead(bank: string): string | null {
  const fields = { name: 'Current', kind: 'bank', bank, currency: 'EUR', opened_on: '2026-09-01' }
  return CODEC.make(storedFieldsOfValues(fields), recordIdOf(ACCOUNT_RECORDS, 'a1')).bank
}

describe("an account's bank", () => {
  it('is the same bank whatever its case, accents or spacing, as the bank field reads it', () => {
    expect(sameBank('Privredna  banka Zagreb', 'privredna banka zagreb')).toBe(true)
    expect(sameBank(' Zagrebačka banka ', 'ZAGREBACKA BANKA')).toBe(true)
    expect(sameBank(null, '')).toBe(true)
    expect(sameBank('OTP banka', 'Revolut')).toBe(false)
  })

  it('is offered once as first written, however the other accounts spell it', () => {
    expect(bankNamesOf([{ bank: 'Privredna banka Zagreb' }, { bank: 'privredna  banka  zagreb' }, { bank: null }, { bank: 'Revolut' }])).toEqual(['Privredna banka Zagreb', 'Revolut'])
  })

  it('reads an old stored key as the bank it named, and any other text as a name of its own', () => {
    expect(bankRead('otp')).toBe('OTP banka')
    expect(bankRead('other')).toBeNull()
    expect(bankRead('constructor')).toBe('constructor')
    expect(bankRead('toString')).toBe('toString')
  })
})
