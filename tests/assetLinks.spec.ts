import { describe, expect, it } from 'vitest'

import { assetTargetsOf } from '../src/apps/assets/asset/application/publishedAssets'
import { assetRowsFrom } from '../src/apps/assets/rows/application/linkedRows'
import { paidFromAccounts, valueOfYourPartIn, yearlyNet } from '../src/apps/assets/rows/domain/assetMoney'
import type { AssetRow, HeldAsset } from '../src/apps/assets/rows/domain/assetMoney'
import { ASSET_RECORDS, ASSET_SHARE_RECORDS, VALUATION_RECORDS } from '../src/apps/assets/workbook/domain/assetKinds'
import { percentFromWhole } from '../src/shared/money/percent'
import { ASSETS_DOCUMENT } from '../src/apps/assets/workbook/infrastructure/assetsDocument'
import { fakeAssetsDocument } from '../src/apps/assets/workbook/infrastructure/fake/fakeAssets'
import { rowLinksOf } from '../src/apps/spending/facts'
import { assetTargetsFrom } from '../src/apps/spending/links/application/assetTargets'
import { sourceIn } from '../src/apps/spending/links/application/linkTargets'
import { lastAssetCategory } from '../src/apps/spending/links/domain/assetLinks'
import { linkFiling, linkedEntry } from '../src/apps/spending/links/domain/linkFiling'
import { assetUseOf, choiceKeyOf, filedAsBought, targetsFor } from '../src/apps/spending/links/domain/linkTarget'
import type { AssetTarget, LinkTarget } from '../src/apps/spending/links/domain/linkTarget'
import { linkLineOf } from '../src/apps/spending/links/presentation/linkLine'
import { wholeItemOf } from '../src/apps/spending/workbook/domain/rowItems'
import type { StoredRow } from '../src/apps/spending/workbook/domain/transaction'
import { fakeSpendingDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending'
import { SPENDING_DOCUMENT } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { EURO } from '../src/shared/money/currencyCode'
import { moneyFromAmount } from '../src/shared/money/money'
import { NO_RATES } from '../src/shared/money/rateBook'
import { FAKE_PLOT } from '../src/shared/storage/infrastructure/fake/fakeAssetKeys'
import { CATEGORIES, OTP, category, row, spendingBook } from './fixtures/spending'
import { ITEM_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'

const on = (date: string) => parseCivilDate(date)!
const NOTES = { interest: 'Interest', difference: 'Difference from the plan' }
const PLACE = { currency: EURO, categories: CATEGORIES, language: 'en', notes: NOTES, receipt: false } as const
const BOUGHT_ASSETS = CATEGORIES.find((held) => held.kind === 'asset')!
const META = { id: 'assets', source: 'browser' as const, title: 'assets', syncedAt: '2026-11-20T09:00:00.000Z', lastExportedAt: null, unexportedSince: null }

const CAR: AssetTarget = { kind: 'asset', link: { app: 'assets', kind: 'asset', key: 'made-up-car', due: null }, name: 'Car', assetKind: 'car', bought: on('2024-01-15') }
const FLAT: AssetTarget = { kind: 'asset', link: { app: 'assets', kind: 'asset', key: 'made-up-flat', due: null }, name: 'Flat', assetKind: 'home', bought: null }

const entry = (paid: StoredRow) => ({ row: paid, items: [wholeItemOf(paid, { category: paid.category, note: '', link: null, labels: [] })] })

describe('a Spending row linked to an asset', () => {
  it('lists each asset after the other records by name, for money out as its purchase and a cost of it, and for money in as income from it', () => {
    const account = { currency: EURO, iban: '' }
    const targets: readonly LinkTarget[] = [CAR, FLAT]
    expect(targetsFor(row(OTP, '2026-11-20', -100, null), account, targets).map(choiceKeyOf)).toEqual([
      'assets/asset/made-up-car#bought',
      'assets/asset/made-up-car#cost',
      'assets/asset/made-up-flat#bought',
      'assets/asset/made-up-flat#cost',
    ])
    expect(targetsFor(row(OTP, '2026-11-20', 100, null), account, targets).map(choiceKeyOf)).toEqual(['assets/asset/made-up-car#income', 'assets/asset/made-up-flat#income'])
  })

  it('files a purchase whole under Bought assets, which counts as no spending, and keeps the category of a cost or income', () => {
    const paid = row(OTP, '2026-11-20', -9000, 'Transport/Fuel')
    const bought = linkedEntry(entry(paid), { ...CAR, use: 'bought' }, PLACE)
    expect(bought.entry.items.map((part) => [part.amount, part.category, part.link])).toEqual([[paid.amount, BOUGHT_ASSETS.id, CAR.link]])
    expect(bought.entry.row.categorisedBy).toBe('person')

    const cost = linkedEntry(entry(paid), { ...CAR, use: 'cost' }, PLACE)
    expect(cost.entry.items.map((part) => [part.category, part.link])).toEqual([[category('Transport/Fuel').id, CAR.link]])
    expect([linkFiling(entry(paid), { ...CAR, use: 'cost' }, PLACE), linkFiling(entry(paid), CAR, PLACE)]).toEqual([
      { split: false, why: 'kept' },
      { split: false, why: 'kept' },
    ])
  })

  it('adds Bought assets to a file made before it on the first purchase', () => {
    const categories = CATEGORIES.filter((held) => held.kind !== 'asset')
    const linked = linkedEntry(entry(row(OTP, '2026-11-20', -9000, null)), { ...CAR, use: 'bought' }, { ...PLACE, categories, language: 'hr' }, () => 'made-up-key')
    expect(linked.added.map((added) => [added.name, added.kind])).toEqual([['Kupljena imovina', 'asset']])
  })

  it('reads a link with no use as a purchase under Bought assets, else as a cost for money out and income for money in', () => {
    const bought = row(OTP, '2026-11-20', -9000, null, { category: BOUGHT_ASSETS.id })
    expect([
      assetUseOf(CAR, bought, filedAsBought([bought], CATEGORIES)),
      assetUseOf(CAR, row(OTP, '2026-11-20', -90, 'Transport/Fuel'), false),
      assetUseOf(CAR, row(OTP, '2026-11-20', 90, 'Income/Other income'), false),
      assetUseOf({ ...CAR, use: 'cost' }, bought, true),
    ]).toEqual(['bought', 'cost', 'income', 'cost'])
    const line = (bought: boolean) => linkLineOf(CAR.link, [{ ...CAR, to: '/assets/asset' }], 'assets', { amount: accountMoneyFromAmount(-90), currency: EURO, bought }).text
    expect([line(true), line(false)]).toEqual(['Bought: Car', 'Cost of: Car'])
  })

  it('reads a link to an app not on the page by its id, and one whose id names no kind of app as Loans', () => {
    expect([sourceIn([], 'assets'), sourceIn([], 'investments'), sourceIn([], 'company'), sourceIn([], 'somewhere-else')]).toEqual(['assets', 'investments', 'company', 'loans'])
    expect(linkLineOf(CAR.link, null, sourceIn([], 'assets'), { amount: accountMoneyFromAmount(-90), currency: EURO, bought: false }).text).toBe('Linked to Assets, which is not set up on this device')
  })
})

describe('a cost of or income from an asset on a waiting row or a row with parts', () => {
  it('files a waiting row under the category picked as it links, and links only the parts picked of a row with parts', () => {
    const waiting = row(OTP, '2026-11-20', -62.4, null)
    const filed = linkedEntry(entry(waiting), { ...CAR, use: 'cost', category: category('Transport/Car registration and insurance').id }, PLACE)
    expect(filed.entry.items.map((part) => [part.category, part.link])).toEqual([[category('Transport/Car registration and insurance').id, CAR.link]])
    expect(filed.entry.row.categorisedBy).toBe('person')

    const service = row(OTP, '2026-11-20', -300, null)
    const [whole] = entry(service).items
    const repair = { ...whole!, id: recordIdOf(ITEM_RECORDS, 'repair'), amount: accountMoneyFromAmount(-260), category: category('Transport/Car service and repairs').id }
    const coffee = { ...whole!, id: recordIdOf(ITEM_RECORDS, 'coffee'), amount: accountMoneyFromAmount(-40), category: category('Food/Eating out').id }
    const linked = linkedEntry({ row: service, items: [repair, coffee] }, { ...CAR, use: 'cost', parts: [repair.id] }, PLACE)
    expect(linked.entry.items.map((part) => [part.id, part.link])).toEqual([
      [repair.id, CAR.link],
      [coffee.id, null],
    ])
    expect(linked.entry.row).toBe(service)
  })

  it("starts a waiting row's category with that of the newest part linked to the asset the same way, never Bought assets", () => {
    const insurance = row(OTP, '2026-01-20', -420, 'Transport/Car registration and insurance', { link: CAR.link })
    const repair = row(OTP, '2026-06-02', -150, 'Transport/Car service and repairs', { link: CAR.link })
    const bought = row(OTP, '2026-09-01', -9000, null, { category: BOUGHT_ASSETS.id, link: CAR.link })
    const rent = row(OTP, '2026-05-01', 600, 'Income/Rental income', { link: CAR.link })
    const book = spendingBook([insurance, repair, bought, rent])
    expect([lastAssetCategory(book, CAR.link, 'cost'), lastAssetCategory(book, CAR.link, 'income'), lastAssetCategory(book, FLAT.link, 'cost')]).toEqual([
      category('Transport/Car service and repairs').id,
      category('Income/Rental income').id,
      null,
    ])
  })
})

describe('what Assets publishes and reads back', () => {
  const assets = ASSETS_DOCUMENT.read({ meta: META, revision: '1', document: fakeAssetsDocument(META.syncedAt, 'sample') }).workbook

  it('publishes each asset with its name, kind, day bought and page, which Spending reads as a record a row can link to', () => {
    const published = assetTargetsOf(assets)
    expect(published.map(({ name, kind, bought }) => [name, kind, bought])).toEqual([
      ['Flat in Zagreb', 'home', on('2025-03-15')],
      ['Family car', 'car', on('2024-01-15')],
      ['Sailing boat', 'other', on('2022-06-01')],
      ['Plot by the sea', 'other', null],
    ])
    expect(published[3]!.to).toEqual({ path: '/assets/asset', query: { asset: FAKE_PLOT } })
    expect(
      assetTargetsFrom([
        { app: 'assets', assets: published },
        { app: 'elsewhere', assets: 'opening' },
      ]).map(({ app, targets }) => [app, Array.isArray(targets) ? targets.length : targets]),
    ).toEqual([
      ['assets', 4],
      ['elsewhere', 'opening'],
    ])
  })

  it("sums what the fake assets set's rows linked as a purchase paid, a refund taking off and a row waiting on rates left out", () => {
    const day = on('2026-11-20')
    const spending = SPENDING_DOCUMENT.read({ meta: META, revision: '1', document: fakeSpendingDocument(META.syncedAt, 'assets', day) }).workbook
    const rows = assetRowsFrom([{ app: 'spending', links: rowLinksOf(spending, NO_RATES) }], 'assets')
    expect(paidFromAccounts(rows, FAKE_PLOT)).toEqual({ paid: moneyFromAmount(380), unrated: 0 })

    const linked = (euros: number | null, counts: AssetRow['counts'] = 'bought'): AssetRow => ({ asset: 'car', day, euros: euros === null ? null : moneyFromAmount(euros), counts })
    expect(paidFromAccounts([linked(-9000), linked(500), linked(null), linked(-60, 'spending')], 'car')).toEqual({ paid: moneyFromAmount(8500), unrated: 1 })
    expect([paidFromAccounts([linked(-60, 'spending')], 'car'), paidFromAccounts('unchecked', 'car')]).toEqual([null, 'unchecked'])
    expect(assetRowsFrom([{ app: 'spending', links: 'failed' }], 'assets')).toBe('unchecked')
  })
})

describe("the net of an asset's linked rows each year", () => {
  const day = on('2026-11-20')
  const linked = (date: string, euros: number | null, counts: AssetRow['counts'], asset = 'flat'): AssetRow => ({ asset, day: on(date), euros: euros === null ? null : moneyFromAmount(euros), counts })
  const rows = [
    linked('2025-03-01', 9600, 'income'),
    linked('2025-06-01', -1800, 'spending'),
    linked('2025-08-01', 200, 'spending'),
    linked('2026-02-01', 2400, 'income'),
    linked('2026-03-01', null, 'spending'),
    linked('2025-01-15', -150000, 'bought'),
    linked('2025-04-01', 999, 'income', 'car'),
  ]

  it('gives each full year what it earned, cost and netted, with the net as a share of the value in that year, and the year so far in euros only', () => {
    // 9,600.00 earned less 1,800.00 of costs and a refund of 200.00 nets 8,000.00, which is 4% of the 200,000.00 valued in 2025.
    expect(yearlyNet(rows, 'flat', day, held({ valuations: [['2025-09-01', 200_000]] }))).toEqual({
      full: [{ year: 2025, earned: moneyFromAmount(9600), cost: moneyFromAmount(-1600), net: moneyFromAmount(8000), share: 0.04, unrated: 0 }],
      soFar: { year: 2026, earned: moneyFromAmount(2400), cost: moneyFromAmount(0), net: moneyFromAmount(2400), share: null, unrated: 1 },
    })
  })

  it('measures a co-owned asset against your part, so half of the value doubles the share', () => {
    const years = yearlyNet(rows, 'flat', day, held({ valuations: [['2025-09-01', 200_000]], share: 50 }))
    expect(years !== null && years !== 'unchecked' ? years.full.map((year) => year.share) : null).toEqual([0.08])
  })

  it('gives no share with no value in the year, nothing for an asset with no cost or income linked, and unchecked while the rows cannot be read', () => {
    const years = yearlyNet(rows, 'flat', day, held({ price: null }))
    expect(years !== null && years !== 'unchecked' ? years.full.map((year) => year.share) : null).toEqual([null])
    expect([yearlyNet([linked('2025-01-15', -150000, 'bought')], 'flat', day, held({})), yearlyNet('unchecked', 'flat', day, held({}))]).toEqual([null, 'unchecked'])
  })
})

describe("your part of an asset's value in a year, which a past year's net is measured against", () => {
  it.each([
    {
      case: 'the last valuation dated in the year',
      valuations: [
        ['2024-03-01', 180_000],
        ['2025-02-01', 190_000],
        ['2025-10-01', 210_000],
        ['2026-01-10', 400_000],
      ],
      year: 2025,
      value: 210_000,
    },
    { case: 'an earlier valuation when the year has none', valuations: [['2023-06-01', 180_000]], year: 2025, value: 180_000 },
    { case: 'the price paid for a year before any valuation', valuations: [['2026-01-10', 400_000]], year: 2025, value: 150_000 },
    { case: 'your part from the start', valuations: [['2025-10-01', 210_000]], share: 50, year: 2025, value: 105_000 },
    { case: "your part on the year's last day, after buying out the other owner", valuations: [['2025-03-01', 200_000]], share: 50, changes: [['2025-11-01', 100]], year: 2025, value: 200_000 },
    { case: 'your part as the year ends, before a change the next year', valuations: [['2025-03-01', 200_000]], share: 50, changes: [['2026-01-01', 100]], year: 2025, value: 100_000 },
    { case: 'nothing with no valuation up to the year and no price', valuations: [['2026-03-01', 90_000]], price: null, year: 2025, value: null },
  ] as const)('is $case', (heldCase: HeldCase) => {
    expect(valueOfYourPartIn(held(heldCase), heldCase.year)).toEqual(heldCase.value === null ? null : moneyFromAmount(heldCase.value))
  })
})

interface HeldCase {
  readonly case: string
  readonly valuations?: readonly (readonly [string, number])[]
  readonly share?: number
  readonly changes?: readonly (readonly [string, number])[]
  readonly price?: number | null
  readonly year: number
  readonly value: number | null
}

/** A flat bought in 2020 for 150,000.00 with the valuations and parts given, all of it yours unless a share is given. */
function held({ valuations = [], share, changes = [], price = 150_000 }: Omit<HeldCase, 'case' | 'year' | 'value'>): HeldAsset {
  const asset = recordIdOf(ASSET_RECORDS, '3e9c6f4b-8a5d-4b12-ad04-6f7a8b9cadb3')
  return {
    asset: {
      id: asset,
      name: 'Flat',
      kind: 'other',
      bought: on('2020-05-04'),
      price: price === null ? null : moneyFromAmount(price),
      region: null,
      firstRegistration: null,
      loan: null,
      ...(share === undefined ? {} : { share: percentFromWhole(share) }),
      note: '',
    },
    valuations: valuations.map(([date, worth], at) => ({ id: recordIdOf(VALUATION_RECORDS, `valuation-${at}`), asset, date: on(date), value: moneyFromAmount(worth), note: '' })),
    shares: changes.map(([from, part], at) => ({ id: recordIdOf(ASSET_SHARE_RECORDS, `share-${at}`), asset, from: on(from), share: percentFromWhole(part), note: '' })),
  }
}
