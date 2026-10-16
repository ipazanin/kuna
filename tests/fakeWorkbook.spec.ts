import { describe, expect, it } from 'vitest'

import { monthOf } from '../src/shared/calendar/monthKey'
import { latestBalances } from '../src/features/cash/domain/balances'
import { monthlyProfitAndLoss } from '../src/features/trends/domain/monthlyProfitAndLoss'
import { ledgerWindowOf } from '../src/features/workbook/domain/workbook'
import { fakeWorkbookSnapshot, fakeWorkbookValues } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader'

const workbook = readWorkbook(fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z'))
const window = ledgerWindowOf(workbook.transactions)

describe('fake workbook', () => {
  it('reads cleanly through the app’s own reader', () => {
    expect(workbook.problems).toEqual([])
    expect(window).not.toBeNull()
  })

  it('is the same on every run', () => {
    expect(fakeWorkbookValues()).toEqual(fakeWorkbookValues())
  })

  it('spans eighteen months from an opening part-month to a part-month at the end', () => {
    const series = monthlyProfitAndLoss(workbook.transactions, window!)

    expect(series).toHaveLength(18)
    expect(series[0].complete).toBe(false)
    expect(series[series.length - 1].complete).toBe(false)
    expect(series.filter((month) => month.complete && month.lines.net.amount < 0).length).toBeGreaterThan(0)
  })

  it('carries the Sheet’s category list and two accounts, one of them closed at zero', () => {
    expect(workbook.categories).toHaveLength(31)
    expect(workbook.accounts.map((account) => account.slug)).toEqual(['legacy', 'main'])
    const legacy = latestBalances(workbook.transactions).accounts.find((account) => account.account === 'legacy')
    expect(legacy?.balance.amount).toBe(0)
    expect(legacy !== undefined && monthOf(legacy.asOf) < window!.partMonth).toBe(true)
  })

  it('moves money between its own accounts exactly once, as two legs that cancel', () => {
    const legs = workbook.transactions.filter((transaction) => transaction.category === 'internal-transfer')

    expect(legs.map((leg) => leg.account).sort()).toEqual(['legacy', 'main'])
    expect(legs[0].amount + legs[1].amount).toBe(0)
    expect(legs[0].amount).not.toBe(0)
  })

  it('keeps every balance chain intact, newest first with the last booking of a day on top', () => {
    for (const account of ['legacy', 'main']) {
      const oldestFirst = workbook.transactions.filter((transaction) => transaction.account === account).reverse()
      oldestFirst.reduce((previous, transaction) => {
        expect(transaction.balance).toBe(previous + transaction.amount)
        return transaction.balance
      }, 0)
    }
  })

  it('holds rows for review: a guess and an unclassified category', () => {
    expect(workbook.transactions.some((transaction) => transaction.flaggedBy === 'ai' && transaction.bucket === 'unclassified')).toBe(true)
  })

  it('uses no real IBAN, only the fake ones', () => {
    const ibans = new Set(workbook.transactions.map((transaction) => transaction.counterpartyIban).filter((iban) => iban !== ''))

    expect([...ibans].every((iban) => iban.startsWith('XX00FAKE'))).toBe(true)
  })
})
