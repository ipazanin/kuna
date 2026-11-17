import { describe, expect, it } from 'vitest'

import { feeSide, newTransfer, transferAmounts } from '../src/apps/spending/entries/domain/transfer'
import type { TransferDraft, TransferSide } from '../src/apps/spending/entries/domain/transfer'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { civil } from './fixtures/ledger'
import { ACCOUNTS, ACCOUNTS_BY_HAND, CASH, CATEGORIES, category } from './fixtures/spending'

const [OTP, REVOLUT_EUR, REVOLUT_USD] = ACCOUNTS_BY_HAND
const [OTP_LINKED, REVOLUT_LINKED] = ACCOUNTS
const BANK_FEES = category('Money and fees/Bank fees')
const FEE_WORDS = { bankNames: { otp: 'OTP', revolut: 'Revolut' }, description: 'Fee on a transfer' }
const TYPED = { importKey: '' }
const BANKS_ROW = { importKey: 'statement-row' }

function side(account: TransferSide['account'], row: TransferSide['row'] = null): TransferSide {
  return { account, row }
}

function draft(from: TransferSide, to: TransferSide, sent: number, arrived: number | null): TransferDraft {
  return { from, to, sent: accountMoneyFromAmount(sent), arrived: arrived === null ? null : accountMoneyFromAmount(arrived) }
}

describe('A transfer that arrives with less', () => {
  it.each([
    ['arrives in full in one currency', draft(side(OTP!), side(REVOLUT_EUR!), 100, null), { out: 100, in: 100, fee: null }],
    ['arrives in full when the arrived amount is the sent one', draft(side(OTP!), side(REVOLUT_EUR!), 100, 100), { out: 100, in: 100, fee: null }],
    ['keeps equal legs and puts the fee on the arrival account', draft(side(OTP!), side(REVOLUT_EUR!), 100, 99.5), { out: 100, in: 100, fee: { side: 'to', amount: 0.5 } }],
    [
      'takes the arrived amount as both legs with the fee on the from account when the bank fixed the arrival',
      draft(side(OTP!), side(REVOLUT_LINKED!, BANKS_ROW), 100, 99.5),
      { out: 99.5, in: 99.5, fee: { side: 'from', amount: 0.5 } },
    ],
    [
      'puts the fee on the from account when the bank fills the arrival account',
      draft(side(CASH), side(REVOLUT_LINKED!, TYPED), 100, 99.5),
      { out: 99.5, in: 99.5, fee: { side: 'from', amount: 0.5 } },
    ],
    ['keeps the converted amount in two currencies, with no fee', draft(side(OTP!), side(REVOLUT_USD!), 100, 108.5), { out: 100, in: 108.5, fee: null }],
  ])('%s', (_, typed, expected) => {
    const amounts = transferAmounts(typed)

    expect(amounts).toEqual({
      out: accountMoneyFromAmount(expected.out),
      in: accountMoneyFromAmount(expected.in),
      fee: expected.fee === null ? null : { side: expected.fee.side, amount: accountMoneyFromAmount(expected.fee.amount) },
    })
  })

  it.each([
    ['an arrived amount missing in two currencies', draft(side(OTP!), side(REVOLUT_USD!), 100, null), 'arrived-missing'],
    ['more arriving than was sent in one currency', draft(side(OTP!), side(REVOLUT_EUR!), 100, 100.5), 'arrived-above-sent'],
    ['less arriving where the bank fills both accounts', draft(side(OTP_LINKED!, BANKS_ROW), side(REVOLUT_LINKED!), 100, 99.5), 'no-fee-side'],
    ['less arriving on a transfer already saved, whose fee is an entry of its own', draft(side(OTP!, TYPED), side(REVOLUT_EUR!, TYPED), 100, 99.5), 'saved-transfer'],
  ])('refuses %s', (_, typed, refused) => {
    expect(transferAmounts(typed)).toEqual({ refused })
  })

  it('has no side for a fee when the bank fills both accounts', () => {
    expect(feeSide(side(OTP_LINKED!), side(REVOLUT_LINKED!))).toBeNull()
  })

  it('has no side for a fee on a transfer already saved, so changing it adds no second fee row', () => {
    expect(feeSide(side(OTP!, TYPED), side(REVOLUT_EUR!, TYPED))).toBeNull()
  })

  it("writes the fee as money out on the arrival account under Bank fees, payee the bank's name, beside two equal legs", () => {
    const typed = newTransfer(draft(side(OTP!), side(REVOLUT_EUR!), 100, 99.5), { date: civil('2026-11-02'), note: 'Top-up', category: category('Between my accounts').id }, CATEGORIES, FEE_WORDS)
    if ('refused' in typed) throw new Error(typed.refused)

    expect(typed.legs.map(({ row }) => [row.account, row.amount])).toEqual([
      [OTP!.id, accountMoneyFromAmount(-100)],
      [REVOLUT_EUR!.id, accountMoneyFromAmount(100)],
    ])
    expect(typed.fee?.row).toMatchObject({ account: REVOLUT_EUR!.id, amount: accountMoneyFromAmount(-0.5), payee: 'Revolut', description: 'Fee on a transfer', pair: null, source: 'typed' })
    expect(typed.fee?.items).toMatchObject([{ category: BANK_FEES.id, amount: accountMoneyFromAmount(-0.5) }])
  })

  it('leaves the payee empty for a fee on an account with no known bank, and the category empty for a book with no Bank fees', () => {
    const typed = newTransfer(
      draft(side(OTP!), side(CASH), 20, 19),
      { date: civil('2026-11-02'), note: '', category: category('Between my accounts').id },
      CATEGORIES.filter((held) => held.id !== BANK_FEES.id),
      FEE_WORDS,
    )
    if ('refused' in typed) throw new Error(typed.refused)

    expect(typed.fee?.row).toMatchObject({ account: CASH.id, payee: '' })
    expect(typed.fee?.items).toMatchObject([{ category: null }])
  })
})
