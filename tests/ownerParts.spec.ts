import { describe, expect, it } from 'vitest'

import { monthKey } from '../src/shared/calendar/monthKey'
import { euroSplit } from '../src/features/overview/domain/euroSplit'
import { ownerPartsOf, ownerShareProblems, withOwnerParts } from '../src/features/owner-share/domain/ownerParts'
import { DEFAULT_SETTINGS } from '../src/features/settings/domain/settings'
import { categoryTotals } from '../src/features/spending/domain/categoryTotals'
import { transactionsCsv } from '../src/features/transactions/application/transactionsCsv'
import { presentedWorkbook } from '../src/features/transactions/application/presentedWorkbook'
import { categoryChangeOf } from '../src/features/transactions/domain/categoryChange'
import { listedRows, withPartHeadings } from '../src/features/transactions/domain/listedRows'
import type { ListedEntry } from '../src/features/transactions/domain/listedRows'
import { bucketTotals } from '../src/features/workbook/domain/bucketTotals'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { bookingOfAdvance } from '../src/features/workbook/domain/workbook'
import type { Booking, Category, OwnerAdvance, Transaction } from '../src/features/workbook/domain/workbook'
import { OWNER_ADVANCE_RECORDS } from '../src/packs/hr-doo/domain/hrDooKinds'
import { ownerCost } from '../src/packs/hr-doo/domain/ownerCost'
import { ownerTake, ownerTakeByMonth } from '../src/packs/hr-doo/domain/ownerTake'
import { civil, euros } from './fixtures/ledger'
import { BENEFIT, CATEGORIES, EXAMPLE, WINDOW, YEAR, category, rows, share, workbookOf } from './fixtures/ownerShareExample'
import { splitOf } from './fixtures/splits'

const booked = EXAMPLE as readonly Booking[]
const shared = withOwnerParts(workbookOf(EXAMPLE)).transactions as readonly Booking[]

describe('the worked example', () => {
  it('moves the shares from operating cost to owner pay and leaves cost and net alone', () => {
    expect(bucketTotals(booked)).toMatchObject({ income: euros(50000), operating: euros(11200), taxes: euros(6000), ownerPay: euros(20000), cost: euros(37200), net: euros(12800), ownerEarns: euros(32800) })
    expect(bucketTotals(shared)).toMatchObject({ income: euros(50000), operating: euros(10000), taxes: euros(6000), ownerPay: euros(21200), cost: euros(37200), net: euros(12800), ownerEarns: euros(34000) })
  })

  it('lists the business parts under their categories and the owner parts under the benefit category', () => {
    const amounts = (bookings: readonly Booking[]) => Object.fromEntries(categoryTotals(bookings, YEAR, WINDOW).map((total) => [total.category, total.amount.amount]))

    expect(amounts(booked)).toMatchObject({ equipment: euros(2000), 'ai-services': euros(1200) })
    expect(amounts(booked)).not.toHaveProperty('benefits')
    expect(amounts(shared)).toMatchObject({ equipment: euros(1400), 'ai-services': euros(600), benefits: euros(1200), 'salary-net': euros(20000) })
    expect(categoryTotals(shared, YEAR, WINDOW).find((total) => total.category === 'benefits')?.bucket).toBe('owner-pay')
  })

  it('splits every euro earned with the shares in owner pay and the same kept', () => {
    const slices = (bookings: readonly Booking[]) => Object.fromEntries(euroSplit(bucketTotals(bookings), YEAR).slices.map((slice) => [slice.part, slice.total]))

    expect(slices(booked)).toEqual({ operating: euros(11200), taxes: euros(6000), ownerPay: euros(20000), kept: euros(12800) })
    expect(slices(shared)).toEqual({ operating: euros(10000), taxes: euros(6000), ownerPay: euros(21200), kept: euros(12800) })
  })

  it('counts the shares in owner take, untaxed, so a euro received costs less', () => {
    expect(ownerTake(booked, CATEGORIES, YEAR, WINDOW).total.amount).toBe(euros(20000))
    expect(ownerTake(shared, CATEGORIES, YEAR, WINDOW).total.amount).toBe(euros(21200))
    expect(ownerTake(shared, CATEGORIES, YEAR, WINDOW).byCategory.map((line) => [line.category, line.amount.amount])).toEqual([
      ['salary-net', euros(20000)],
      ['benefits', euros(1200)],
    ])
    expect(ownerTakeByMonth(shared, CATEGORIES, [monthKey(2026, 3)], WINDOW)[0]?.byCategory.benefits?.amount).toBe(euros(650))

    const before = ownerCost(booked, CATEGORIES, YEAR, WINDOW)
    const after = ownerCost(shared, CATEGORIES, YEAR, WINDOW)
    expect([before.gross.amount, before.taxOnPay.amount, before.costPerEuroReceived]).toEqual([euros(25000), euros(5000), 1.25])
    expect([after.gross.amount, after.taxOnPay.amount]).toEqual([euros(26200), euros(5000)])
    expect(after.costPerEuroReceived?.toFixed(2)).toBe('1.24')
  })

  it('leaves the rows as booked to the books', () => {
    const workbook = workbookOf(EXAMPLE)

    expect(presentedWorkbook(workbook).transactions).toEqual(workbook.transactions)
    expect(withOwnerParts(workbook).transactions).toHaveLength(workbook.transactions.length + 13)
  })
})

describe('ownerPartsOf', () => {
  const [laptop] = rows([{ date: '2026-03-15', amount: -2000, category: 'equipment', share: 30 }])

  it('gives the owner the share of the amount in the benefit category and the business the rest, each naming where it comes from', () => {
    const [business, owner] = ownerPartsOf(laptop!, BENEFIT)

    expect(business).toMatchObject({ amount: euros(-1400), category: 'equipment', bucket: 'operating', ownerPart: { share: 30, sourceCategory: 'equipment', side: 'business', whole: laptop } })
    expect(owner).toMatchObject({ amount: euros(-600), category: 'benefits', family: 'owner-pay', bucket: 'owner-pay', ownerPart: { share: 30, sourceCategory: 'equipment', side: 'owner', whole: laptop } })
    expect([business!.balance, business!.sequence, owner!.balance, owner!.sequence, owner!.counterparty]).toEqual([laptop!.balance, laptop!.sequence, laptop!.balance, laptop!.sequence, laptop!.counterparty])
  })

  it('rounds the owner part to the cent half away from zero, and the parts always add up to the row', () => {
    const [odd, half, refund] = rows([
      { date: '2026-03-01', amount: -10.01, category: 'equipment', share: 33 },
      { date: '2026-03-02', amount: -1.5, category: 'equipment', share: 1 },
      { date: '2026-03-03', amount: 1.5, category: 'equipment', share: 1 },
    ])
    const amounts = (row: Transaction) => ownerPartsOf(row, BENEFIT).map((part) => part.amount)

    expect(amounts(odd!)).toEqual([euros(-6.71), euros(-3.3)])
    expect(amounts(half!)).toEqual([euros(-1.48), euros(-0.02)])
    expect(amounts(refund!)).toEqual([euros(1.48), euros(0.02)])
  })

  it('gives a refund in a shared category its share back from owner pay', () => {
    const [refund] = rows([{ date: '2026-04-02', amount: 100, category: 'ai-services' }])
    const parts = ownerPartsOf(refund!, BENEFIT)

    expect(parts.map((part) => [part.category, part.amount])).toEqual([
      ['ai-services', euros(50)],
      ['benefits', euros(50)],
    ])
    expect(bucketTotals(parts)).toMatchObject({ operating: euros(-50), ownerPay: euros(-50), net: euros(100) })
  })

  it('keeps a row whole at 0%, with no share, outside operating cost, or when the owner part comes to nothing', () => {
    const kept = rows([
      { date: '2026-04-01', amount: -100, category: 'equipment', share: 0 },
      { date: '2026-04-02', amount: -100, category: 'equipment' },
      { date: '2026-04-03', amount: -100, category: 'salary-net', share: 50 },
      { date: '2026-04-04', amount: -100, category: 'payroll-tax', share: 50 },
      { date: '2026-04-05', amount: -0.01, category: 'equipment', share: 10 },
    ])

    for (const row of kept) {
      expect(ownerPartsOf(row, BENEFIT)).toEqual([row])
    }
  })

  it('leaves out a business part of nothing, so a 100% share is the owner part alone', () => {
    const [whole] = rows([{ date: '2026-04-01', amount: -80, category: 'equipment', share: 100 }])

    expect(ownerPartsOf(whole!, BENEFIT).map((part) => [part.category, part.amount, part.ownerPart?.side])).toEqual([['benefits', euros(-80), 'owner']])
  })

  it('shares each part of a split row by the part’s own share, and ignores the row’s', () => {
    const [order] = rows([{ date: '2026-05-10', amount: -300, category: 'equipment', share: 90 }])
    const split = splitOf(order!, [[-200, 'ai-services', 'seats'], [-100, 'equipment', 'cable']], CATEGORIES)
    const parts = { ...split, parts: [{ ...split.parts[0]!, ownerShare: share(50) }, { ...split.parts[1]!, ownerShare: share(10) }] }
    const workbook = workbookOf([order!], { splits: [parts] })
    const counted = withOwnerParts(presentedWorkbook(workbook)).transactions

    expect(counted.map((row) => [row.category, row.amount, row.split?.index, row.ownerPart?.side])).toEqual([
      ['ai-services', euros(-100), 0, 'business'],
      ['benefits', euros(-100), 0, 'owner'],
      ['equipment', euros(-90), 1, 'business'],
      ['benefits', euros(-10), 1, 'owner'],
    ])
    expect(categoryTotals(counted, YEAR, WINDOW).find((total) => total.category === 'benefits')?.amount.amount).toBe(euros(110))
  })
})

describe('withOwnerParts', () => {
  const advance: OwnerAdvance = { date: civil('2026-06-02'), amount: euros(100), description: 'Seats', category: 'ai-services', family: 'operating', bucket: 'operating', ownerShare: share(25), id: recordIdOf(OWNER_ADVANCE_RECORDS, 'row-2') }

  it('shares an owner advance the same way, and its bookings say which part they are', () => {
    const parts = withOwnerParts(workbookOf(EXAMPLE, { ownerAdvances: [advance] })).ownerAdvances

    expect(parts.map((part) => [part.category, part.amount, part.ownerPart?.side, part.ownerPart?.whole])).toEqual([
      ['ai-services', euros(75), 'business', advance],
      ['benefits', euros(25), 'owner', advance],
    ])
    expect(parts.map(bookingOfAdvance).map((booking) => [booking.amount, booking.bucket, booking.ownerPart?.sourceCategory])).toEqual([
      [euros(-75), 'operating', 'ai-services'],
      [euros(-25), 'owner-pay', 'ai-services'],
    ])
    expect(bookingOfAdvance(advance)).not.toHaveProperty('ownerPart')
  })

  it('counts nothing with the owner-pay module off, where the figures are as booked', () => {
    const workbook = presentedWorkbook(workbookOf(EXAMPLE, { settings: { ...DEFAULT_SETTINGS, ownerPayModule: false }, ownerAdvances: [advance] }))

    expect(withOwnerParts(workbook)).toBe(workbook)
    expect(bucketTotals(withOwnerParts(workbook).transactions)).toEqual(bucketTotals(workbook.transactions))
    expect(ownerShareProblems(workbookOf(EXAMPLE, { categories: CATEGORIES.filter((candidate) => candidate !== BENEFIT), settings: { ...DEFAULT_SETTINGS, ownerPayModule: false } }))).toEqual([])
  })

  it('counts every share as 0 with one problem while no single owner-pay category carries the owner-benefit role', () => {
    const without = CATEGORIES.filter((candidate) => candidate !== BENEFIT)
    const presentedWith = (categories: readonly Category[]) => presentedWorkbook(workbookOf(EXAMPLE, { categories, ownerAdvances: [advance] }))
    const reasonWith = (categories: readonly Category[]) =>
      presentedWith(categories).problems.filter((problem) => problem.label === 'owner-benefit').map((problem) => `${problem.tab}: ${problem.reason}`)
    const unshared = presentedWith(without)

    expect(withOwnerParts(unshared)).toBe(unshared)

    expect(reasonWith(without)).toEqual(['categories: 14 rows hold an owner share, but no category carries the owner-benefit role. So every share counts as 0 until one owner-pay category carries the role.'])
    expect(reasonWith([...CATEGORIES, category('perks', 'owner-pay', ['owner-benefit'])])).toEqual([
      'categories: 14 rows hold an owner share, but the owner-benefit role is on "benefits" and "perks", and only one category may carry it. So every share counts as 0 until one owner-pay category carries the role.',
    ])
    expect(reasonWith([...without, category('perks', 'operating', ['owner-benefit'])])).toEqual([
      'categories: 14 rows hold an owner share, but the owner-benefit role is on "perks" in the operating bucket, and only an owner-pay category may carry it. So every share counts as 0 until one owner-pay category carries the role.',
    ])
    expect(reasonWith(CATEGORIES)).toEqual([])
    expect(ownerShareProblems(workbookOf(EXAMPLE.map((row) => ({ ...row, ownerShare: null })), { categories: without }))).toEqual([])
  })
})

describe('a shared row on Transactions', () => {
  const [laptop, lunch, order] = rows([
    { date: '2026-03-15', amount: -2000, category: 'equipment', share: 30, counterparty: 'Computer store' },
    { date: '2026-03-16', amount: -40, category: 'other-costs', counterparty: 'Bistro' },
    { date: '2026-03-17', amount: -300, category: 'equipment', counterparty: 'Office shop' },
  ])
  const split = splitOf(order!, [[-200, 'ai-services'], [-100, 'equipment']], CATEGORIES)
  const advance: OwnerAdvance = { date: civil('2026-03-18'), amount: euros(100), description: 'Seats', category: 'ai-services', family: 'operating', bucket: 'operating', ownerShare: share(25), id: recordIdOf(OWNER_ADVANCE_RECORDS, 'row-2') }
  const cash = withOwnerParts(presentedWorkbook(workbookOf([laptop!, lunch!, order!], { splits: [{ ...split, parts: [{ ...split.parts[0]!, ownerShare: share(50) }, split.parts[1]!] }], ownerAdvances: [advance] })))
  const listed = listedRows(cash.transactions, cash.ownerAdvances)
  const shown = (entries: readonly ListedEntry[]) =>
    entries.map((entry) => (entry.kind === 'row' ? `${entry.row.kind} ${entry.row.category} ${entry.row.amount}` : entry.kind === 'shared' ? `shared ${entry.share}% ${entry.whole.amount}` : `split ${entry.whole.amount}`))

  it('heads its parts, the business part first, like a split row, and keeps the owner’s parts of a split part under the split', () => {
    expect(shown(withPartHeadings([...listed].sort((left, right) => left.amount - right.amount)))).toEqual([
      `shared 30% ${euros(-2000)}`,
      `bank equipment ${euros(-1400)}`,
      `bank benefits ${euros(-600)}`,
      `split ${euros(-300)}`,
      `bank ai-services ${euros(-100)}`,
      `bank benefits ${euros(-100)}`,
      `bank equipment ${euros(-100)}`,
      `shared 25% ${euros(-100)}`,
      `owner-advance ai-services ${euros(-75)}`,
      `owner-advance benefits ${euros(-25)}`,
      `bank other-costs ${euros(-40)}`,
    ])
    expect(new Set(listed.map((row) => row.key)).size).toBe(listed.length)
  })

  it('heads the one part a filter keeps with the row as booked', () => {
    expect(shown(withPartHeadings(listed.filter((row) => row.category === 'benefits' && row.kind === 'bank' && row.split === undefined)))).toEqual([
      `shared 30% ${euros(-2000)}`,
      `bank benefits ${euros(-600)}`,
    ])
  })

  it('changes the category of either part on the ledger row, of a split part’s parts in the split editor, and of an advance’s nowhere', () => {
    const changeOf = (counterparty: string) => listed.filter((row) => row.counterparty === counterparty).map(categoryChangeOf)

    expect(changeOf('Computer store')).toEqual(['ledger', 'ledger'])
    expect(changeOf('Office shop')).toEqual(['split', 'split', 'split'])
    expect(listed.filter((row) => row.kind === 'owner-advance').map(categoryChangeOf)).toEqual([null, null])
  })

  it('writes both parts to the CSV with the row’s owner share', () => {
    const lines = transactionsCsv(listed.filter((row) => row.counterparty === 'Computer store' || row.kind === 'owner-advance')).trim().split('\r\n')

    expect(lines[0]).toContain(',note,owner_share,tab')
    expect(lines.slice(1).map((line) => line.split(',').slice(5).join(','))).toEqual([
      '-1400.00,-2000.00,equipment,operating,rule,REF-1,,30,ledger',
      '-600.00,-2000.00,benefits,owner-pay,rule,REF-1,,30,ledger',
      '-75.00,,ai-services,operating,,,,25,owner-advances',
      '-25.00,,benefits,owner-pay,,,,25,owner-advances',
    ])
  })
})
