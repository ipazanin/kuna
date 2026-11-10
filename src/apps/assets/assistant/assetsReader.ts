import { ASSET_ROUTE } from '../overview/presentation/assetLinks'
import { carriedByIndex } from '../values/domain/assetValue'
import type { ValueBasis } from '../values/domain/assetValue'
import { assetsOnDay, assetsTotal } from '../values/presentation/assetsOnDay'
import type { LoansOnScreen } from '../values/presentation/assetsOnDay'
import type { HouseIndexState } from '../houseIndex/presentation/useHouseIndex'
import type { Asset } from '../workbook/domain/asset'
import { ASSET_RECORDS, VALUATION_RECORDS } from '../workbook/domain/assetKinds'
import type { AssetBook } from '../workbook/domain/readAssetBook'
import type { Valuation } from '../workbook/domain/valuation'
import { readableKind } from '../../../shared/app/assistantReader'
import type { AppReader, ReportFigure } from '../../../shared/app/assistantReader'
import { distinctNames } from '../../../shared/app/distinctNames'
import { parseCivilDate, today } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { EURO } from '../../../shared/money/currencyCode'
import { sumMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import type { FieldDocs } from '../../../shared/privacy/domain/exposure'
import { words } from './words'

/** What the reader reads from, which `app.ts` hands in over the app's own store, so this folder holds no store. */
export interface AssetsReading {
  status(): ReturnType<AppReader['status']>
  book(): AssetBook | null
  /** The house price index as the screens hold it, which carries a home's value. */
  index(): HouseIndexState
  /** The bank loans Loans lists on the day, which an asset names. */
  loans(day: CivilDate): LoansOnScreen
}

function dayOfPeriod(period: string | null): CivilDate {
  if (period === null) return today()
  const day = parseCivilDate(period)
  if (day === null) throw new RangeError('Not a day.')
  return day
}

function amount(label: string, cents: Money): ReportFigure {
  return { label, of: 'app', cents, currency: EURO }
}

/** The name of the bank loan an asset names, as Loans lists it, or why that is not known. */
function loanNameOf(asset: Asset, loans: LoansOnScreen): string | null {
  if (asset.loan === null) return null
  if (loans === null) return words.reads.loanNotSetUp
  if (typeof loans !== 'object') return words.reads.loanUnknown
  return loans.find((loan) => loan.key === asset.loan)?.name ?? words.reads.loanGone
}

function assetFields(loans: () => LoansOnScreen): FieldDocs<Asset> {
  return {
    id: { exposure: 'ref', to: ASSET_RECORDS.name, meaning: 'The asset.' },
    name: { exposure: 'free-text', meaning: 'The name the owner gave it.' },
    kind: { exposure: 'plain', meaning: 'home is a flat or house, car, or other.' },
    bought: { exposure: 'plain', meaning: 'The day it was bought, or empty.' },
    price: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'What was paid for it, above zero, or empty.' },
    region: { exposure: 'plain', meaning: "A home's region for the house price index: zagreb, adriatic or rest, or empty." },
    firstRegistration: { exposure: 'plain', meaning: "A car's first registration, from which the customs table counts its months, or empty." },
    loan: { exposure: 'free-text', meaning: 'The name of the bank loan on it, as Loans lists it, or empty.', read: (asset) => loanNameOf(asset, loans()) },
    note: { exposure: 'free-text', meaning: "The owner's note." },
  }
}

const VALUATION_FIELDS: FieldDocs<Valuation> = {
  id: { exposure: 'ref', to: VALUATION_RECORDS.name, meaning: 'The valuation.' },
  asset: { exposure: 'ref', to: ASSET_RECORDS.name, meaning: 'The asset it values.' },
  date: { exposure: 'plain', meaning: 'The day the value is for.' },
  value: { exposure: 'plain', amount: 'app', sign: 'zero-or-more', meaning: 'What the asset was worth on that day, zero or more.' },
  note: { exposure: 'free-text', meaning: "The owner's note, such as the bank's appraisal or a guess." },
}

const KIND_NAMES = { home: 'home', car: 'car', other: 'other asset' } as const

/** How a value was reached, as a label says it, with the days and quarters but no amount. */
function basisText(basis: ValueBasis): string {
  const kept = (base: 'valuation' | 'price') => (base === 'price' ? 'the price paid' : 'the valuation')
  switch (basis.kind) {
    case 'valuation':
      return `from the valuation of ${basis.date}`
    case 'price':
      return `from the price paid on ${basis.date}`
    case 'index-not-out':
      return `kept at ${kept(basis.base)} of ${basis.date}, as the house price index has no figure for ${basis.quarter} yet`
    case 'index-not-reached':
      return `kept at ${kept(basis.base)} of ${basis.date}, as the house price index starts only in ${basis.first}`
    case 'house-index':
      return `from ${basis.date}, carried to ${basis.quarter} by the house price index for the ${basis.region} region`
    case 'customs':
      return 'estimated by the customs table'
  }
}

/** What the assets are worth on the day, together and each, as the Overview and each asset's page show it. Assets go by their kind and purchase day, never by a name a person gave. */
function worthReport(book: AssetBook, period: string | null, index: HouseIndexState, loans: (day: CivilDate) => LoansOnScreen): readonly ReportFigure[] {
  const day = dayOfPeriod(period)
  const total = assetsTotal(book, day, index, loans(day))
  if (total === null) return []
  if (total === 'opening') return [{ label: 'assets worth together: waiting for the house price index, so there is no figure yet', count: 1 }]
  const onDay = assetsOnDay(book, day, index, loans(day))
  const names = distinctNames(onDay.map(({ asset }) => `${KIND_NAMES[asset.kind]}${asset.bought === null ? '' : ` bought ${asset.bought}`}`))
  const each = onDay.flatMap(({ value, link, equity }, at): ReportFigure[] => {
    const named = names[at]!
    return [
      value === null ? { label: `${named}: has no value, with no valuation and no price`, count: 1 } : amount(`${named}: worth, ${basisText(value.basis)}`, value.cents),
      ...(link.kind === 'linked' && equity.owed !== null ? [amount(`${named}: owed on its bank loan`, equity.owed)] : []),
      ...(equity.yours === null ? [] : [amount(`${named}: yours after its bank loan`, equity.yours)]),
    ]
  })
  return [
    amount('assets worth together', total.value),
    ...(total.yoursAfter.length === 0 ? [] : [amount('assets with a bank loan: yours after their loans', sumMoney(total.yoursAfter.map((after) => after.yours)))]),
    { label: 'assets with no value', count: total.unvalued },
    ...(total.indexFailed ? [{ label: 'homes valued without the house price index, which did not load', count: book.assets.filter(({ asset }) => carriedByIndex(asset)).length }] : []),
    ...each,
  ]
}

/** What the chat can read of Assets: its two kinds, with every field classified, and the worth the screens show, from the same functions. Nothing here writes. */
export function assetsReader(reading: AssetsReading): AppReader {
  const loansToday = () => reading.loans(today())
  return {
    status: () => reading.status(),
    kinds: [
      readableKind({
        kind: ASSET_RECORDS,
        about: words.reads.asset,
        fields: assetFields(loansToday),
        dated: 'bought',
        rows: () => reading.book()?.readings.assets.facts ?? [],
        currencyOf: () => EURO,
        page: ASSET_ROUTE,
      }),
      readableKind({
        kind: VALUATION_RECORDS,
        about: words.reads.valuation,
        fields: VALUATION_FIELDS,
        dated: 'date',
        rows: () => reading.book()?.readings.valuations.facts ?? [],
        currencyOf: () => EURO,
      }),
    ],
    reports: [
      {
        id: 'worth',
        title: words.reports.worth.title,
        about: words.reports.worth.about,
        period: 'day',
        figures: (period) => {
          const book = reading.book()
          return book === null ? [] : worthReport(book, period, reading.index(), reading.loans)
        },
      },
    ],
  }
}
