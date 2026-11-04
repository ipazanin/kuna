import { codecOfAssetsKind } from '../../application/assetsCodecs'
import type { Asset } from '../../domain/asset'
import { ASSET_RECORDS, VALUATION_RECORDS } from '../../domain/assetKinds'
import type { Valuation } from '../../domain/valuation'
import { emptyAssetsDocument } from '../assetsDocument'
import { parseCivilDate } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { moneyFromAmount } from '../../../../../shared/money/money'
import { recordIdOf } from '../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../../shared/storage/domain/recordKind'
import type { WorkbookDocument } from '../../../../../shared/storage/infrastructure/documentFormat'

function day(text: string): CivilDate {
  const parsed = parseCivilDate(text)
  if (parsed === null) throw new Error(`${text} is not a day.`)
  return parsed
}

/** A fixed id per record, so every load of the sample holds the same records. */
function fixedId(kind: RecordKind, place: number): RecordId {
  return recordIdOf(kind, `fa4e2000-0000-4000-8000-${String(place).padStart(12, '0')}`)
}

/** The fake Loans file's Home loan and Car loan, by their bare UUIDs, since a fake seed of Assets may not import Loans. */
const FAKE_HOME_LOAN = 'fa4e0000-0000-4000-8000-000000000001'
const FAKE_CAR_LOAN = 'fa4e0000-0000-4000-8000-000000000030'
/** A loan no fake Loans file holds. */
const GONE_LOAN = 'fa4e0000-0000-4000-8000-000000000999'

/** A made-up flat in the City of Zagreb, bought in March 2025 with no valuation since, so the house price index carries its price. */
const FLAT: Asset = {
  id: fixedId(ASSET_RECORDS, 1),
  name: 'Flat in Zagreb',
  kind: 'home',
  bought: day('2025-03-15'),
  price: moneyFromAmount(200_000),
  region: 'zagreb',
  firstRegistration: null,
  loan: FAKE_HOME_LOAN,
  note: 'Made up for the fake build.',
}

/** A made-up car bought new, which the customs table estimates. */
const CAR: Asset = {
  id: fixedId(ASSET_RECORDS, 2),
  name: 'Family car',
  kind: 'car',
  bought: day('2024-01-15'),
  price: moneyFromAmount(30_000),
  region: null,
  firstRegistration: day('2024-01-15'),
  loan: null,
  note: '',
}

const BOAT: Asset = {
  id: fixedId(ASSET_RECORDS, 3),
  name: 'Boat',
  kind: 'other',
  bought: day('2022-06-01'),
  price: moneyFromAmount(18_000),
  region: null,
  firstRegistration: null,
  loan: null,
  note: '',
}

/** Land with neither a price nor a valuation, so it has no value. */
const PLOT: Asset = { id: fixedId(ASSET_RECORDS, 4), name: 'Plot by the sea', kind: 'other', bought: null, price: null, region: null, firstRegistration: null, loan: null, note: 'Inherited' }

const BOAT_VALUATION: Valuation = { id: fixedId(VALUATION_RECORDS, 10), asset: BOAT.id, date: day('2026-05-01'), value: moneyFromAmount(15_500), note: "The marina broker's guess" }

function stored<R>(kind: RecordKind<R>, records: readonly R[]): WorkbookDocument['records'] {
  const codec = codecOfAssetsKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

/**
 * The fake build's Assets sets: `sample` the flat linked to the fake Home loan, the car with no loan, a boat with one
 * valuation and a plot with no value, `house-and-car` the flat and the car linked to the fake Car loan, and `loan-gone`
 * the sample with the flat naming a loan no fake Loans file holds.
 */
export type FakeAssetsSet = 'sample' | 'house-and-car' | 'loan-gone'

export function fakeAssetsDocument(savedAt: string, set: FakeAssetsSet = 'sample'): WorkbookDocument {
  const assets = set === 'house-and-car' ? [FLAT, { ...CAR, loan: FAKE_CAR_LOAN }] : set === 'loan-gone' ? [{ ...FLAT, loan: GONE_LOAN }, CAR, BOAT, PLOT] : [FLAT, CAR, BOAT, PLOT]
  return { ...emptyAssetsDocument(savedAt), records: { ...stored(ASSET_RECORDS, assets), ...stored(VALUATION_RECORDS, set === 'house-and-car' ? [] : [BOAT_VALUATION]) } }
}
