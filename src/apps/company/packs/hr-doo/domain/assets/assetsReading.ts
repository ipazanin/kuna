import { SHARED_ID_REASON, idSharing, problemOf, refusedProblems } from '../../../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../../../shared/storage/domain/recordsRead'
import { ASSET_GROUPS } from './assets'
import type { Asset } from './assets'
import { labelWords, withIdField } from '../../../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../../../shared/storage/domain/recordFields'
import { newRecordId, recordIdOf } from '../../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import { ASSET_RECORDS } from '../hrDooKinds'
import { sharedKeys } from '../../../../../../shared/storage/domain/sharedKeys'
import { booleanOf, optionalDate, ownId, positiveMoney, refuse, requiredChoice, requiredDate, slugOf, textOf } from '../../../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../../../shared/storage/domain/storedFields'
import { words } from '../words'

/** An asset made from its fields as an editor makes one, keeping the id it was stored with, or with one of its own. */
export function assetOfFields(fields: StoredFields, storedId: RecordId | null): Asset {
  return assetOf(fields, storedId ?? recordIdOf(ASSET_RECORDS, newRecordId()))
}

export function assetOf(fields: StoredFields, id: RecordId | null): Asset {
  const name = textOf(fields.asset)
  if (name === '') refuse(words.reading.noAssetName)
  const bought = requiredDate(fields, 'bought')
  const inUse = optionalDate(fields, 'in_use') ?? bought
  if (inUse < bought) refuse(words.reading.before('in_use', inUse, 'bought', bought))
  const costNet = positiveMoney(fields, 'cost_net')
  const group = requiredChoice(fields, 'group', ASSET_GROUPS)
  const doubledRate = fields.doubled === undefined ? false : (booleanOf(fields.doubled) ?? refuse(words.reading.notAFlag('doubled', fields.doubled.text)))
  const disposed = optionalDate(fields, 'disposed')
  if (disposed !== null && disposed < inUse) refuse(words.reading.before('disposed', disposed, 'in_use', inUse))
  return {
    name,
    bought,
    inUse,
    costNet,
    group,
    doubledRate,
    disposed,
    fundedBy: slugOf(fields.funded_by),
    ledgerReference: textOf(fields.ledger_reference),
    note: textOf(fields.note),
    id: ownId(id),
  }
}

export const ASSET_CODEC: RecordCodec<Asset> = withIdField(
  ASSET_RECORDS,
  (fields) => labelWords([textOf(fields.asset)]),
  assetOf,
  (asset) =>
    filledFields({
      asset: asset.name,
      bought: asset.bought,
      // A blank in_use reads as the day it was bought, so that day is kept blank.
      in_use: asset.inUse === asset.bought ? null : asset.inUse,
      cost_net: amountText(asset.costNet),
      group: asset.group,
      doubled: asset.doubledRate ? true : null,
      disposed: asset.disposed,
      funded_by: asset.fundedBy,
      ledger_reference: asset.ledgerReference,
      note: asset.note,
    }),
)

/**
 * The assets. A name on more than one record leaves out every record of it, since depreciation
 * would count the asset twice. A grant the grants tab does not hold is reported and the asset kept.
 */
export function readAssets(read: RecordsRead<Asset>, grantSlugs: ReadonlySet<string>): Reading<Asset> {
  const sharesId = idSharing(read)
  const problems: RecordProblem[] = [...refusedProblems(read), ...read.records.filter(sharesId).map((stored) => problemOf(stored, SHARED_ID_REASON))]
  const unshared = read.records.filter((stored) => !sharesId(stored))
  const keyOf = (asset: Asset): string => asset.name.toLowerCase()
  const listedTwice = sharedKeys(
    unshared.map((stored) => stored.record),
    keyOf,
  )
  const facts: Asset[] = []
  for (const stored of unshared) {
    const asset = stored.record
    if (listedTwice.has(keyOf(asset))) {
      problems.push(problemOf(stored, words.reading.listedTwice(asset.name)))
      continue
    }
    if (asset.fundedBy !== '' && !grantSlugs.has(asset.fundedBy)) {
      problems.push(problemOf(stored, words.reading.noGrantOnTab(asset.fundedBy)))
    }
    facts.push(asset)
  }
  return { facts, problems }
}
