import { describe, expect, it } from 'vitest'

import { isPerson, oldMarksCount, payeeDirectory, payeeOfRow, personPayees, rowPayeeKey } from '../src/apps/spending/payees/domain/payeeDirectory'
import type { Payee } from '../src/apps/spending/workbook/domain/payee'
import { PAYEE_RECORDS, SETTING_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { PERSON_PAYEES_KEY } from '../src/apps/spending/workbook/domain/spendingSettings'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { settingRow } from '../src/shared/storage/domain/settingRows'

const MARKET_IBAN = 'HR6212345670000000001'
const ANA_IBAN = 'HR3512345670000000002'

function payee(key: string, names: readonly string[], details: Partial<Payee> = {}): Payee {
  return { id: recordIdOf(PAYEE_RECORDS, key), names, ibans: [], party: null, taxId: '', website: '', note: '', ...details }
}

const MARKET = payee('market', ['Corner market', 'CORNER MKT'], { ibans: [MARKET_IBAN], party: 'business' })
const ANA = payee('ana', ['Ana Horvat'], { ibans: [ANA_IBAN], party: 'person' })
const BAKERY = payee('bakery', ['Bakery'])
const DIRECTORY = payeeDirectory([MARKET, ANA, BAKERY], [])

describe('the payee a row belongs to', () => {
  it('is the payee that lists its name under any spelling, once folded', () => {
    expect(payeeOfRow(DIRECTORY, { payee: 'corner mkt', counterpartyIban: '' })).toBe(MARKET)
    expect(rowPayeeKey(DIRECTORY, { payee: 'corner mkt', counterpartyIban: '' })).toBe('CORNER MARKET')
  })

  it('is the payee that lists its IBAN when no payee lists its name', () => {
    expect(payeeOfRow(DIRECTORY, { payee: 'CM Zagreb 12', counterpartyIban: 'hr62 1234 5670 0000 0000 1' })).toBe(MARKET)
  })

  it('stays with the payee its name belongs to when another payee lists its IBAN', () => {
    expect(payeeOfRow(DIRECTORY, { payee: 'Bakery', counterpartyIban: MARKET_IBAN })).toBe(BAKERY)
  })

  it('is no payee when neither finds one, and the name alone tells it as before', () => {
    expect(payeeOfRow(DIRECTORY, { payee: 'Café on the square', counterpartyIban: '' })).toBeNull()
    expect(rowPayeeKey(DIRECTORY, { payee: 'Café on the square', counterpartyIban: '' })).toBe('CAFE ON THE SQUARE')
  })
})

describe('whether a payee is a person', () => {
  it('reads the payee the name or IBAN finds', () => {
    expect(isPerson(DIRECTORY, 'Ana Horvat')).toBe(true)
    expect(isPerson(DIRECTORY, 'A. Horvat', ANA_IBAN)).toBe(true)
    expect(isPerson(DIRECTORY, 'Corner market')).toBe(false)
    expect(isPerson(DIRECTORY, 'Bakery')).toBe(false)
  })

  it('reads a person payee whose name has the same words, such as one written surname first', () => {
    expect(isPerson(DIRECTORY, 'HORVAT ANA')).toBe(true)
    expect(isPerson(DIRECTORY, 'Ana Horvat d.o.o.')).toBe(false)
  })

  it('lists each person payee with every name and IBAN', () => {
    expect(personPayees(DIRECTORY)).toEqual([ANA])
  })
})

describe('the old person setting', () => {
  const marks = [settingRow(SETTING_RECORDS, PERSON_PAYEES_KEY, 'Marko Kovač\nAna Horvat')]

  it('marks its names as people while the file holds no payee, as it did before', () => {
    const before = payeeDirectory([], marks)
    expect(isPerson(before, 'KOVAČ MARKO')).toBe(true)
    expect(isPerson(before, 'Bakery')).toBe(false)
    expect(personPayees(before)).toEqual([
      { names: ['Marko Kovač'], ibans: [] },
      { names: ['Ana Horvat'], ibans: [] },
    ])
  })

  it('is not read once any payee counts', () => {
    const after = payeeDirectory([BAKERY], marks)
    expect(isPerson(after, 'Marko Kovač')).toBe(false)
    expect(personPayees(after)).toEqual([])
  })
  it('counts while every stored payee fails to count, such as two that share an IBAN, and not once one counts', () => {
    const twin = payee('twin', ['Market twin'], { ibans: [MARKET_IBAN] })
    expect(oldMarksCount([])).toBe(true)
    expect(oldMarksCount([MARKET, twin])).toBe(true)
    expect(oldMarksCount([MARKET, twin, BAKERY])).toBe(false)
  })
})
