import { ASSET_GROUPS } from './assets'
import type { Asset } from './assets'
import { newRecordId, recordIdOf } from '../../../../features/workbook/domain/recordId'
import type { RecordId } from '../../../../features/workbook/domain/recordId'
import { ASSET_RECORDS } from '../hrDooKinds'
import { SHARED_ID_REASON, idSharing, problemOf, refusedProblems } from '../../../../features/workbook/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../features/workbook/domain/recordsRead'
import { sharedKeys } from '../../../../features/workbook/domain/sharedKeys'
import { booleanOf, optionalDate, ownId, positiveMoney, refuse, requiredChoice, requiredDate, slugOf, textOf } from '../../../../features/workbook/domain/storedFields'
import type { StoredFields } from '../../../../features/workbook/domain/storedFields'
import type { RecordProblem } from '../../../../features/workbook/domain/workbook'

/** An asset made from its fields as an editor makes one, keeping the id it was stored with, or with one of its own. */
export function assetOfFields(fields: StoredFields, storedId: RecordId | null): Asset {
  return assetOf(fields, storedId ?? recordIdOf(ASSET_RECORDS, newRecordId()))
}

export function assetOf(fields: StoredFields, id: RecordId | null): Asset {
  const name = textOf(fields.asset)
  if (name === '') refuse('no asset name')
  const bought = requiredDate(fields, 'bought')
  const inUse = optionalDate(fields, 'in_use') ?? bought
  if (inUse < bought) refuse(`in_use ${inUse} is before bought ${bought}`)
  const costNet = positiveMoney(fields, 'cost_net')
  const group = requiredChoice(fields, 'group', ASSET_GROUPS)
  const doubledRate = fields.doubled === undefined ? false : (booleanOf(fields.doubled) ?? refuse(`doubled "${fields.doubled.text}" is neither TRUE nor FALSE`))
  const disposed = optionalDate(fields, 'disposed')
  if (disposed !== null && disposed < inUse) refuse(`disposed ${disposed} is before in_use ${inUse}`)
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
      problems.push(problemOf(stored, `"${asset.name}" is listed on more than one row, so none of them counts`))
      continue
    }
    if (asset.fundedBy !== '' && !grantSlugs.has(asset.fundedBy)) {
      problems.push(problemOf(stored, `${asset.fundedBy} is not on the grants tab, so the asset's depreciation releases no grant`))
    }
    facts.push(asset)
  }
  return { facts, problems }
}
