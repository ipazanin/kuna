import { describe, expect, it } from 'vitest'

import { PAYEE_CHOICES, knownPayees, payeeChoices } from '../src/apps/spending/entries/domain/knownPayees'
import { OTP, REVOLUT_EUR, row, transactionId } from './fixtures/spending'

describe('the payees the entry dialog offers', () => {
  it('lists each payee once, most recently paid first', () => {
    const rows = [
      row(OTP, '2026-10-01', -12, 'Food/Groceries', { payee: 'Corner market' }),
      row(OTP, '2026-10-09', -30, 'Food/Groceries', { payee: 'Harbour bistro' }),
      row(OTP, '2026-10-05', -8, 'Food/Groceries', { payee: 'Corner market' }),
      row(OTP, '2026-10-07', 1_500, null, { payee: 'Example Studio d.o.o.' }),
    ]

    expect(knownPayees(rows)).toEqual(['Harbour bistro', 'Example Studio d.o.o.', 'Corner market'])
  })

  it('takes payees that differ only in case, accents or spaces as one, spelt as on the newest row', () => {
    const rows = [
      row(OTP, '2026-10-01', -4, null, { payee: 'CAFE ON THE SQUARE' }),
      row(OTP, '2026-10-06', -4, null, { payee: ' Café on  the square ' }),
      row(OTP, '2026-10-03', -4, null, { payee: 'Đuro' }),
      row(OTP, '2026-10-02', -4, null, { payee: 'duro' }),
    ]

    expect(knownPayees(rows)).toEqual(['Café on  the square', 'Đuro'])
  })

  it('leaves out blank payees and moves between your own accounts', () => {
    const [outLeg, inLeg] = [transactionId(91), transactionId(92)]
    const rows = [
      row(OTP, '2026-10-04', -200, null, { id: outLeg, payee: 'Top-up', pair: inLeg }),
      row(REVOLUT_EUR, '2026-10-04', 200, null, { id: inLeg, payee: 'Top-up', pair: outLeg }),
      row(OTP, '2026-10-05', -9, null, { payee: '   ' }),
      row(OTP, '2026-10-01', -9, null, { payee: 'Fuel station' }),
    ]

    expect(knownPayees(rows)).toEqual(['Fuel station'])
  })

  it('keeps the file order of payees paid on the same day', () => {
    const rows = [row(OTP, '2026-10-04', -1, null, { payee: 'Landlord' }), row(OTP, '2026-10-04', -1, null, { payee: 'City utilities' })]

    expect(knownPayees(rows)).toEqual(['Landlord', 'City utilities'])
  })
})

describe('what the payee list offers for what is typed', () => {
  const payees = ['Café on the square', 'Corner market', 'Example Bank', 'Đuro']

  it('offers the payees that hold the text anywhere, ignoring case and accents, after the text as typed', () => {
    expect(payeeChoices(payees, 'CA')).toEqual(['CA', 'Café on the square'])
    expect(payeeChoices(payees, 'ar')).toEqual(['ar', 'Café on the square', 'Corner market'])
    expect(payeeChoices(payees, 'Bank')).toEqual(['Bank', 'Example Bank'])
    expect(payeeChoices(payees, 'du')).toEqual(['du', 'Đuro'])
  })

  it('leads with the known payee the text names, spelt as the books spell it', () => {
    expect(payeeChoices(payees, 'cafe on the square')).toEqual(['Café on the square'])
    expect(payeeChoices(payees, 'đuro')).toEqual(['Đuro'])
  })

  it('offers nothing for blank text or a payee the books do not hold', () => {
    expect(payeeChoices(payees, '  ')).toEqual([])
    expect(payeeChoices(payees, 'Bakery by the port')).toEqual([])
  })

  it(`offers at most ${PAYEE_CHOICES} known payees, most recent first`, () => {
    const many = Array.from({ length: PAYEE_CHOICES + 2 }, (_, place) => `Shop ${place + 1}`)

    expect(payeeChoices(many, 'shop')).toEqual(['shop', ...many.slice(0, PAYEE_CHOICES)])
    expect(payeeChoices(many, 'shop 10')).toEqual(['Shop 10'])
    expect(payeeChoices(many, 'Shop 1')).toEqual(['Shop 1', 'Shop 10'])
  })
})
