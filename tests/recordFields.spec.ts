import { describe, expect, it } from 'vitest'

import { moneyFromCents } from '../src/shared/money/money'
import { amountText, filledFields } from '../src/shared/storage/domain/recordFields'
import { storedFieldOfValue } from '../src/shared/storage/domain/storedFields'

describe('record fields', () => {
  it('write an amount as decimal text from its cents', () => {
    expect([-9549, 120000, 5, -5, 0].map((cents) => amountText(moneyFromCents(cents)))).toEqual(['-95.49', '1200.00', '0.05', '-0.05', '0.00'])
  })

  it('leave out a blank field and keep a false flag', () => {
    expect(filledFields({ note: '', due: null, label: undefined, doubled: false, item: 'Fee' })).toEqual({ doubled: false, item: 'Fee' })
  })

  it('read as text that also names the day or the number it holds, and keep text that looks like a number as typed', () => {
    expect(storedFieldOfValue('2025-05-12')).toMatchObject({ text: '2025-05-12', date: '2025-05-12', number: null, money: null })
    expect(storedFieldOfValue('-95.49')).toMatchObject({ text: '-95.49', date: null, number: -95.49, money: -9549 })
    expect(storedFieldOfValue('00123')).toMatchObject({ text: '00123', number: 123 })
    expect(storedFieldOfValue('1e3')).toMatchObject({ text: '1e3', number: null, money: null })
    expect(storedFieldOfValue(true)).toMatchObject({ text: 'true', flag: true })
  })
})
