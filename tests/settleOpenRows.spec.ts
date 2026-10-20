import { describe, expect, it } from 'vitest'

import { fewestMakingUp, settleOpenRows, settlePayments } from '../src/shared/money/settleOpenRows'
import { euros } from './fixtures/ledger'

describe('settleOpenRows', () => {
  const open = [euros(30), euros(50), euros(20), euros(80)]
  const anywhere = () => true

  it('takes the fewest open rows the payment equals exactly', () => {
    expect(settleOpenRows(open, euros(100), anywhere, anywhere)).toEqual([
      { index: 2, applied: euros(20) },
      { index: 3, applied: euros(80) },
    ])
  })

  it('fills the rows it may reach oldest first when no set equals the payment, and places no more than is open', () => {
    expect(settleOpenRows(open, euros(65), anywhere, anywhere)).toEqual([
      { index: 0, applied: euros(30) },
      { index: 1, applied: euros(35) },
    ])
    expect(settleOpenRows(open, euros(500), (index) => index < 2, (index) => index < 2)).toEqual([
      { index: 0, applied: euros(30) },
      { index: 1, applied: euros(50) },
    ])
  })

  it('matches exactly only among the rows it may match, and passes over closed rows', () => {
    expect(settleOpenRows(open, euros(80), (index) => index < 3, anywhere)).toEqual([
      { index: 0, applied: euros(30) },
      { index: 1, applied: euros(50) },
    ])
    expect(settleOpenRows([euros(0), euros(40)], euros(40), anywhere, anywhere)).toEqual([{ index: 1, applied: euros(40) }])
  })
})

describe('fewestMakingUp', () => {
  it('prefers the set that reaches least far down the list when two sets are as small', () => {
    expect(fewestMakingUp([euros(10), euros(30), euros(20), euros(10)], (amount) => amount, euros(40))).toEqual([euros(10), euros(30)])
  })

  it('gives up when no set adds up, or when it takes two or more and there are too many candidates to try', () => {
    expect(fewestMakingUp([euros(10), euros(30)], (amount) => amount, euros(25))).toBeNull()
    expect(fewestMakingUp(Array.from({ length: 17 }, () => euros(1)), (amount) => amount, euros(2))).toBeNull()
  })

  it('still finds one candidate the amount equals among too many to try in sets', () => {
    const candidates = [...Array.from({ length: 17 }, () => euros(2000)), euros(24.5)]
    expect(fewestMakingUp(candidates, (amount) => amount, euros(24.5))).toEqual([euros(24.5)])
  })
})

describe('settleOpenRows with many open rows', () => {
  it('passes over rows larger than the payment, so many large open rows do not hide a small pair', () => {
    const open = [...Array.from({ length: 17 }, () => euros(2000)), euros(15.5), euros(36.75)]
    expect(settleOpenRows(open, euros(52.25), () => true, () => true)).toEqual([
      { index: 17, applied: euros(15.5) },
      { index: 18, applied: euros(36.75) },
    ])
  })
})

describe('settlePayments', () => {
  it('lets a later payment close the row it equals before an earlier payment that fits no set fills rows oldest first', () => {
    const rows = [euros(500), euros(1500)]
    const payments = [euros(1000), euros(500), euros(500)]

    expect(settlePayments(rows, payments, () => true)).toEqual([
      [{ index: 1, applied: euros(1000) }],
      [{ index: 0, applied: euros(500) }],
      [{ index: 1, applied: euros(500) }],
    ])
  })

  it('matches each payment exactly only among the rows it may match', () => {
    expect(settlePayments([euros(300), euros(300)], [euros(300), euros(300)], (payment, row) => row <= payment)).toEqual([
      [{ index: 0, applied: euros(300) }],
      [{ index: 1, applied: euros(300) }],
    ])
  })
})
