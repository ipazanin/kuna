import { describe, expect, it } from 'vitest'

import { moneyFromCents } from '../src/shared/money/money'
import { typedAmount } from '../src/shared/money/typedAmount'
import { givenParts, restOfFields, splitField } from '../src/shared/ui/splitFields'

describe('the fields of a split', () => {
  it('leaves the rest what the typed amounts do not take, counting a blank amount as nothing', () => {
    const fields = [splitField('20.00', 'food', '', false), splitField('', 'home', '', false), splitField('', 'fun', '', true)]
    expect(restOfFields(moneyFromCents(4_530), fields, typedAmount)).toBe(2_530)
  })

  it('reads a rest below zero once the amounts pass the whole', () => {
    const fields = [splitField('50.00', 'food', '', false), splitField('', 'fun', '', true)]
    expect(restOfFields(moneyFromCents(4_530), fields, typedAmount)).toBe(-470)
  })

  it('gives the split rule each amount and the rest in their places', () => {
    const fields = [splitField('', 'fun', '', true), splitField('15.30', 'home', 'Soap', false)]
    expect(givenParts(fields, typedAmount)).toEqual(['rest', 1_530])
  })

  it('gives nothing while an amount does not read', () => {
    const fields = [splitField('twelve', 'food', '', false), splitField('', 'fun', '', true)]
    expect(givenParts(fields, typedAmount)).toBeNull()
  })
})
