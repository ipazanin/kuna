import { describe, expect, it } from 'vitest'

import { fitsPairSide, pairSidesWith } from '../src/apps/company/transactions/domain/pairSides'
import { euros } from './fixtures/ledger'

const SIDES = pairSidesWith({ 'owner-loan-out': 'debit', 'owner-loan-repaid': 'credit' })

describe('the side of a credit and debit pair', () => {
  it("takes core's roles with the pack's", () => {
    expect(SIDES).toEqual({ revenue: 'credit', 'client-refund': 'debit', 'owner-loan-out': 'debit', 'owner-loan-repaid': 'credit' })
  })

  it('files money in under a credit role and money out under a debit role', () => {
    expect(fitsPairSide(['revenue'], euros(100), SIDES)).toBe(true)
    expect(fitsPairSide(['client-refund'], euros(-100), SIDES)).toBe(true)
    expect(fitsPairSide(['owner-loan-repaid'], euros(500), SIDES)).toBe(true)
  })

  it('refuses the wrong side', () => {
    expect(fitsPairSide(['revenue'], euros(-100), SIDES)).toBe(false)
    expect(fitsPairSide(['client-refund'], euros(100), SIDES)).toBe(false)
    expect(fitsPairSide(['owner-loan-out'], euros(500), SIDES)).toBe(false)
  })

  it('refuses a category one of whose roles takes the other side', () => {
    expect(fitsPairSide(['equipment', 'revenue'], euros(-100), SIDES)).toBe(false)
  })

  it('lets a role with no side, such as a reimbursement, go either way', () => {
    expect(fitsPairSide(['reimbursement'], euros(-100), SIDES)).toBe(true)
    expect(fitsPairSide([], euros(100), SIDES)).toBe(true)
  })
})
