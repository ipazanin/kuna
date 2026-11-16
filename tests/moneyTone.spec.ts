import { describe, expect, it } from 'vitest'

import type { MoneyLook } from '../src/shared/money/moneyFormat'
import { moneySign, moneyToneClass } from '../src/shared/ui/moneyTone'

describe('moneyToneClass', () => {
  it.each([
    ['outcome', -100, 'text-error'],
    ['outcome', 0, ''],
    ['outcome', 100, 'text-success'],
    ['flow', -100, 'text-negative-soft'],
    ['flow', 0, ''],
    ['flow', 100, 'text-positive-soft'],
    ['balance', -100, 'text-error'],
    ['balance', 0, ''],
    ['balance', 100, ''],
    [undefined, -100, ''],
    [undefined, 0, ''],
    [undefined, 100, ''],
  ] as const)('paints %s at %d cents with %j', (tone, cents, colour) => {
    expect(moneyToneClass(cents, tone)).toBe(colour)
  })
})

describe('moneySign', () => {
  it('always shows the sign of a flow and an outcome', () => {
    expect(moneySign('flow', undefined)).toBe('always')
    expect(moneySign('outcome', undefined)).toBe('always')
  })

  it('shows a minus below zero on a balance', () => {
    expect(moneySign('balance', undefined)).toBe('negative')
  })

  it('takes the sign an amount in ink states, or a minus below zero', () => {
    expect(moneySign(undefined, 'magnitude')).toBe('magnitude')
    expect(moneySign(undefined, undefined)).toBe('negative')
  })
})

describe('MoneyLook', () => {
  it('refuses a sign beside a tone, since the tone decides it, and takes one on an amount in ink', () => {
    // @ts-expect-error a flow always shows its sign
    const flow: MoneyLook = { tone: 'flow', sign: 'always' }
    // @ts-expect-error an outcome always shows its sign
    const outcome: MoneyLook = { tone: 'outcome', sign: 'magnitude' }
    // @ts-expect-error a balance shows a minus below zero
    const balance: MoneyLook = { tone: 'balance', sign: 'negative' }
    const ink: MoneyLook = { sign: 'always' }

    expect([flow, outcome, balance, ink].map((look) => moneySign(look.tone, look.sign))).toEqual(['always', 'always', 'negative', 'always'])
  })
})
