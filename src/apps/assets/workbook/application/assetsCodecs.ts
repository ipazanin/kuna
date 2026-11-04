import { ASSET_CODEC } from '../domain/assetReading'
import { VALUATION_CODEC } from '../domain/valuationReading'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'

const ASSETS_CODECS = [ASSET_CODEC, VALUATION_CODEC] as readonly RecordCodec<unknown>[]

/** The codec of an Assets kind. Throws for a kind the Assets file does not keep. */
export function codecOfAssetsKind<R>(kind: RecordKind<R>): RecordCodec<R> {
  const codec = ASSETS_CODECS.find((candidate) => candidate.kind.name === kind.name)
  if (codec === undefined) {
    throw new Error(`The Assets file keeps no ${kind.noun.en.many}.`)
  }
  return codec as RecordCodec<R>
}
