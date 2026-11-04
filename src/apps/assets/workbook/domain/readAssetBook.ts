import type { Asset } from './asset'
import { ASSET_RECORDS, VALUATION_RECORDS } from './assetKinds'
import type { Valuation } from './valuation'
import type { RecordKind, RecordNoun } from '../../../../shared/storage/domain/recordKind'
import { problemOf, readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'
import { words } from './words'

/** What the Assets file holds of each kind. */
export interface AssetsRecords {
  readonly assets: RecordsRead<Asset>
  readonly valuations: RecordsRead<Valuation>
}

/** The kind each part of the records holds. */
export const ASSET_PARTS: { readonly [Part in keyof AssetsRecords]: RecordKind<AssetsRecords[Part]['records'][number]['record']> } = {
  assets: ASSET_RECORDS,
  valuations: VALUATION_RECORDS,
}

/** The records of every Assets kind, as `of` gives each kind. */
export function assetsRecordsOf(of: <R>(kind: RecordKind<R>) => RecordsRead<R>): AssetsRecords {
  return { assets: of(ASSET_PARTS.assets), valuations: of(ASSET_PARTS.valuations) }
}

/** Which records of each kind count, and why the rest do not or are doubted. */
export type AssetReadings = { readonly [Part in keyof AssetsRecords]: Reading<AssetsRecords[Part]['records'][number]['record']> }

/** An asset with the valuations that name it, oldest first. */
export interface AssetWithValuations {
  readonly asset: Asset
  readonly valuations: readonly Valuation[]
  /** Another asset names its loan too, so neither counts the loan. */
  readonly loanShared: boolean
}

/** A record problem with the kind of the record it is about, by its name and by what a sentence calls it. */
export interface AssetProblem extends RecordProblem {
  readonly kind: string
  readonly noun: RecordNoun
}

export interface AssetBook {
  readonly assets: readonly AssetWithValuations[]
  readonly readings: AssetReadings
  /** Every kind's problems, in the order of the kinds. */
  readonly problems: readonly AssetProblem[]
}

/**
 * Reads the Assets file with the rules across records: a valuation names an asset that counts, is not before the day
 * it was bought, and is the only one of its asset on its day. A bank loan goes on one asset, so two assets that name
 * the same loan both count but are doubted, and neither counts the loan.
 */
export function readAssetBook(records: AssetsRecords): AssetBook {
  const read = readEach(records.assets, () => [])
  const sharedLoans = sharedKeys(
    records.assets.records.flatMap((stored) => (stored.record.loan === null ? [] : [stored.record.loan])),
    (loan) => loan,
  )
  const sharesLoan = (asset: Asset): boolean => asset.loan !== null && sharedLoans.has(asset.loan)
  const assetReading = {
    facts: read.facts,
    problems: [...read.problems, ...records.assets.records.filter((stored) => sharesLoan(stored.record)).map((stored) => problemOf(stored, words.loanShared))],
  }
  const assets = new Map(assetReading.facts.map((asset) => [asset.id, asset]))
  const sharingDay = sharedKeys(records.valuations.records, (stored) => `${stored.record.asset} ${stored.record.date}`)
  const valuations = readEach(records.valuations, ({ record: valuation }) => {
    const asset = assets.get(valuation.asset)
    if (asset === undefined) return [words.noAsset]
    if (asset.bought !== null && valuation.date < asset.bought) return [words.beforeBought(valuation.date, asset.name, asset.bought)]
    return sharingDay.has(`${valuation.asset} ${valuation.date}`) ? [words.valuationSharesDay(asset.name, valuation.date)] : []
  })
  const readings: AssetReadings = { assets: assetReading, valuations }
  return {
    assets: assetReading.facts.map((asset) => ({
      asset,
      valuations: valuations.facts.filter((valuation) => valuation.asset === asset.id).sort((earlier, later) => earlier.date.localeCompare(later.date)),
      loanShared: sharesLoan(asset),
    })),
    readings,
    problems: (Object.keys(ASSET_PARTS) as (keyof AssetsRecords)[]).flatMap((part) =>
      readings[part].problems.map((problem) => ({ kind: ASSET_PARTS[part].name, noun: ASSET_PARTS[part].noun, ...problem })),
    ),
  }
}
