import { describe, expect, it } from 'vitest'

import { isExchange, isPocketMove, syncMoves } from '../src/apps/spending/pairing/domain/syncMoves'
import type { SyncLeg } from '../src/apps/spending/pairing/domain/syncMoves'
import type { Account } from '../src/apps/spending/workbook/domain/account'
import { ACCOUNT_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { decimalOfText } from '../src/shared/money/decimal'
import type { Decimal } from '../src/shared/money/decimal'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { ACCOUNTS, OTP, REVOLUT_EUR, REVOLUT_USD } from './fixtures/spending'
import { civil } from './fixtures/ledger'

const POCKET: Account = { ...REVOLUT_EUR, id: recordIdOf(ACCOUNT_RECORDS, 'a0000000-0000-4000-8000-000000000009'), name: 'Revolut pocket', kind: 'savings', iban: 'LT000000000000000002' }
const WITH_POCKET: readonly Account[] = [...ACCOUNTS, POCKET]

const leg = (on: Account, date: string, amount: number, counterpartyIban = ''): SyncLeg => ({ account: on.id, date: civil(date), amount: accountMoneyFromAmount(amount), counterpartyIban })
const rate = (text: string): Decimal => decimalOfText(text)!

describe('isExchange', () => {
  const sold = leg(REVOLUT_EUR, '2026-11-05', -100)
  const bought = leg(REVOLUT_USD, '2026-11-05', 108.5)

  it.each([
    ['matched at the rate', sold, bought, '1.085', true],
    ['matched with the rate the other way round', sold, bought, '0.921659', true],
    ['matched within 1% of the bought amount', sold, leg(REVOLUT_USD, '2026-11-05', 109.5), '1.085', true],
    ['refused when the rate is off by more than 1%', sold, leg(REVOLUT_USD, '2026-11-05', 110), '1.085', false],
    ['refused at a rate of 0.8 that the amounts do not follow', sold, bought, '0.8', false],
    ['matched at a rate of 0.8 that they do follow', sold, leg(REVOLUT_USD, '2026-11-05', 80), '0.8', true],
    ['refused on the wrong day', sold, leg(REVOLUT_USD, '2026-11-06', 108.5), '1.085', false],
    ['refused for two of the same sign', sold, leg(REVOLUT_USD, '2026-11-05', -108.5), '1.085', false],
    ['refused in one currency', sold, leg(POCKET, '2026-11-05', 108.5), '1.085', false],
    ['refused on one account', sold, leg(REVOLUT_EUR, '2026-11-05', 108.5), '1.085', false],
    ['refused when a leg names a stranger', sold, leg(REVOLUT_USD, '2026-11-05', 108.5, 'HR9900000000000000099'), '1.085', false],
    ['refused without a rate', sold, bought, null, false],
  ])('%s', (_case, debit, credit, rateText, expected) => {
    expect(isExchange(debit, credit, rateText === null ? null : rate(rateText), WITH_POCKET)).toBe(expected)
  })
})

describe('isPocketMove', () => {
  const out = leg(REVOLUT_EUR, '2026-11-05', -20)

  it.each([
    ['matched into the savings account', out, leg(POCKET, '2026-11-05', 20), true],
    ['matched out of the savings account', leg(POCKET, '2026-11-05', -20), leg(REVOLUT_EUR, '2026-11-05', 20), true],
    ['refused on the wrong day', out, leg(POCKET, '2026-11-06', 20), false],
    ['refused for another amount', out, leg(POCKET, '2026-11-05', 21), false],
    ['refused for two of the same sign', out, leg(POCKET, '2026-11-05', -20), false],
    ['refused between two current accounts', out, leg(OTP, '2026-11-05', 20), false],
    ['refused on one account', out, leg(REVOLUT_EUR, '2026-11-05', 20), false],
  ])('%s', (_case, debit, credit, expected) => {
    expect(isPocketMove(debit, credit, WITH_POCKET)).toBe(expected)
  })

  it('refuses a savings account at another bank', () => {
    expect(isPocketMove(leg(OTP, '2026-11-05', -20), leg(POCKET, '2026-11-05', 20), WITH_POCKET)).toBe(false)
  })
})

describe('syncMoves', () => {
  const sold = leg(REVOLUT_EUR, '2026-11-05', -100)
  const bought = leg(REVOLUT_USD, '2026-11-05', 108.5)
  const rates = new Map<SyncLeg, Decimal>([[sold, rate('1.085')]])
  const rateOf = (row: SyncLeg): Decimal | null => rates.get(row) ?? null

  it('pairs an exchange by the rate on either leg, and a pocket move beside it', () => {
    const out = leg(REVOLUT_EUR, '2026-11-05', -20)
    const into = leg(POCKET, '2026-11-05', 20)
    expect(syncMoves([sold, out, bought, into], WITH_POCKET, rateOf)).toEqual({ exchanges: [{ debit: sold, credit: bought }], pocketMoves: [{ debit: out, credit: into }] })
    const onCredit = new Map<SyncLeg, Decimal>([[bought, rate('1.085')]])
    expect(syncMoves([sold, bought], ACCOUNTS, (row) => onCredit.get(row) ?? null).exchanges).toEqual([{ debit: sold, credit: bought }])
  })

  it('pairs none of three candidates, since which two belong together cannot be told', () => {
    const second = leg(REVOLUT_USD, '2026-11-05', 108.6)
    expect(syncMoves([sold, bought, second], ACCOUNTS, rateOf).exchanges).toEqual([])
    const otherSold = leg(REVOLUT_EUR, '2026-11-05', -100)
    rates.set(otherSold, rate('1.085'))
    expect(syncMoves([sold, otherSold, bought], ACCOUNTS, rateOf).exchanges).toEqual([])
  })

  it('pairs none of three pocket candidates either', () => {
    const out = leg(REVOLUT_EUR, '2026-11-05', -20)
    expect(syncMoves([out, leg(POCKET, '2026-11-05', 20), leg(POCKET, '2026-11-05', 20)], WITH_POCKET, rateOf).pocketMoves).toEqual([])
  })
})
