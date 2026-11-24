import { describe, expect, it } from 'vitest'

import { editedPayee, keyOfPayee, mergedPayees, newPayee, payeeEditProblem, payeeProblem, renamedPayee, tidiedPayee, withoutDetails } from '../src/apps/spending/payees/domain/payeeDetails'
import type { Payee } from '../src/apps/spending/workbook/domain/payee'
import { PAYEE_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'

const FIRST_IBAN = 'HR6212345670000000001'
const SECOND_IBAN = 'HR3512345670000000002'

function payee(key: string, names: readonly string[], details: Partial<Payee> = {}): Payee {
  return { id: recordIdOf(PAYEE_RECORDS, key), names, ibans: [], party: null, taxId: '', website: '', note: '', ...details }
}

const MARKET = payee('market', ['Corner market', 'CORNER MKT'], { ibans: [FIRST_IBAN] })

describe("a payee's problem", () => {
  it('needs a name that is not blank once folded', () => {
    expect(payeeProblem(payee('blank', ['  ']), [])).toEqual({ kind: 'no-name' })
    expect(payeeProblem(payee('none', []), [])).toEqual({ kind: 'no-name' })
  })

  it('refuses a name another payee holds once folded, but not one it holds itself', () => {
    expect(payeeProblem(payee('other', ['corner  márket']), [MARKET])).toEqual({ kind: 'name-taken', name: 'corner  márket', holder: 'Corner market' })
    expect(payeeProblem(MARKET, [MARKET])).toBeNull()
  })

  it('refuses an IBAN that is not one, and one another payee holds', () => {
    expect(payeeProblem(payee('bad', ['Bakery'], { ibans: ['HR1234567890123456789'] }), [])).toEqual({ kind: 'not-an-iban', iban: 'HR1234567890123456789' })
    expect(payeeProblem(payee('shared', ['Bakery'], { ibans: [FIRST_IBAN] }), [MARKET])).toEqual({ kind: 'iban-taken', iban: FIRST_IBAN, holder: 'Corner market' })
  })

  it('takes eleven digits as an OIB that must pass its check, and other text as a foreign tax number', () => {
    expect(payeeProblem(payee('oib', ['Bakery'], { taxId: '12345678901' }), [])).toEqual({ kind: 'not-an-oib', taxId: '12345678901' })
    expect(payeeProblem(payee('oib', ['Bakery'], { taxId: '12345678903' }), [])).toBeNull()
    expect(payeeProblem(payee('vat', ['Bakery'], { taxId: 'DE123456789' }), [])).toBeNull()
  })
})

describe("a payee's details", () => {
  it('keep each spelling once once folded, and each IBAN once normalised', () => {
    expect(tidiedPayee(payee('tidy', [' Bakery ', 'BAKERY', '', 'Bakery Ltd'], { ibans: ['hr62 1234 5670 0000 0000 1', FIRST_IBAN] }))).toMatchObject({
      names: ['Bakery', 'Bakery Ltd'],
      ibans: [FIRST_IBAN],
    })
  })

  it('start a new payee with one name and nothing else', () => {
    expect(newPayee(' Bakery ', 'business')).toMatchObject({ names: ['Bakery'], ibans: [], party: 'business', taxId: '', website: '', note: '' })
  })

  it('put a new name first on a rename and keep the old one, so the key follows the new name', () => {
    const renamed = renamedPayee(MARKET, 'The corner market')
    expect(renamed.names).toEqual(['The corner market', 'Corner market', 'CORNER MKT'])
    expect(keyOfPayee(renamed)).toBe('THE CORNER MARKET')
  })

  it('take an edit with its details, and a name spelt another way as a rename that keeps every old name', () => {
    const edit = { name: 'Corner market', otherNames: ['CORNER MKT'], party: 'business' as const, ibans: ['hr62 1234 5670 0000 0000 1'], taxId: ' ', website: 'example.com', note: '' }
    expect(editedPayee(MARKET, edit)).toEqual({ ...MARKET, party: 'business', ibans: [FIRST_IBAN], website: 'example.com' })
    expect(editedPayee(MARKET, { ...edit, name: 'Corner shop' }).names).toEqual(['Corner shop', 'Corner market', 'CORNER MKT'])
  })

  it('keep only the other spellings the edit keeps, so entries of one taken off stop counting under the payee', () => {
    const edit = { name: 'Corner market', otherNames: [], party: null, ibans: [], taxId: '', website: '', note: '' }

    expect(editedPayee(MARKET, edit).names).toEqual(['Corner market'])
    expect(editedPayee(MARKET, { ...edit, name: 'Corner shop' }).names).toEqual(['Corner shop', 'Corner market'])
  })

  it('refuse an edit that blanks the name, although the old names would stay', () => {
    const edited = editedPayee(MARKET, { name: ' ', otherNames: ['CORNER MKT'], party: null, ibans: [], taxId: '', website: '', note: '' })
    expect(edited.names).toEqual(MARKET.names)
    expect(payeeEditProblem(edited, ' ', [MARKET])).toEqual({ kind: 'no-name' })
    expect(payeeEditProblem(edited, 'Corner market', [MARKET])).toBeNull()
  })

  it('merge the other payee into the kept one: every name and IBAN, the kept filled fields, and both notes', () => {
    const kept = payee('kept', ['Corner market'], { party: 'business', note: 'Open on Sundays', taxId: '' })
    const other = payee('other', ['CORNER MKT', 'corner market'], { ibans: [SECOND_IBAN], party: 'person', taxId: '12345678903', website: 'example.com', note: 'Cash only' })
    expect(mergedPayees(kept, other)).toEqual({
      ...kept,
      names: ['Corner market', 'CORNER MKT'],
      ibans: [SECOND_IBAN],
      party: 'business',
      taxId: '12345678903',
      website: 'example.com',
      note: 'Open on Sundays\nCash only',
    })
  })

  it('clear every detail you added and keep the names', () => {
    expect(withoutDetails({ ...MARKET, party: 'person', taxId: '12345678903', website: 'example.com', note: 'Note' })).toEqual({ ...MARKET, ibans: [] })
  })
})
