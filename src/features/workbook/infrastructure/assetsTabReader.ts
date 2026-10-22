import { ASSET_GROUPS } from '../domain/assets'
import type { Asset } from '../domain/assets'
import { sharedKeys } from '../domain/sharedKeys'
import { booleanOf, isUnreadable, optionalDate, ownIdOf, positiveMoney, readRow, refuse, requiredChoice, requiredDate, sharedIds, slugOf, tabReading, textOf } from './cellReading'
import type { RowProblem, TabReading } from './cellReading'
import type { SheetRow } from './workbookSnapshot'

/**
 * The `assets` tab. A name on more than one row leaves out every row of it, since depreciation
 * would count the asset twice. A grant the grants tab does not hold is reported and the asset kept.
 */
export function readAssets(rows: readonly SheetRow[], grantSlugs: ReadonlySet<string>): TabReading<Asset> {
  const read: { readonly row: SheetRow; readonly asset: Asset }[] = []
  const problems: RowProblem[] = []
  const shared = sharedIds(rows)
  for (const row of rows) {
    const asset = readRow(() => readAssetRow(row, shared))
    if (isUnreadable(asset)) {
      problems.push({ sheetRow: row.sheetRow, reason: asset.unreadable })
    } else {
      read.push({ row, asset })
    }
  }
  const keyOf = (asset: Asset): string => asset.name.toLowerCase()
  const listedTwice = sharedKeys(
    read.map(({ asset }) => asset),
    keyOf,
  )
  const facts: Asset[] = []
  for (const { row, asset } of read) {
    if (listedTwice.has(keyOf(asset))) {
      problems.push({ sheetRow: row.sheetRow, reason: `"${asset.name}" is listed on more than one row, so none of them counts` })
      continue
    }
    if (asset.fundedBy !== '' && !grantSlugs.has(asset.fundedBy)) {
      problems.push({ sheetRow: row.sheetRow, reason: `${asset.fundedBy} is not on the grants tab, so the asset's depreciation releases no grant` })
    }
    facts.push(asset)
  }
  return tabReading('assets', rows, facts, problems)
}

function readAssetRow(row: SheetRow, shared: ReadonlySet<string>): Asset {
  const { cells } = row
  const name = textOf(cells.asset)
  if (name === '') refuse('no asset name')
  const bought = requiredDate(cells, 'bought')
  const inUse = optionalDate(cells, 'in_use') ?? bought
  if (inUse < bought) refuse(`in_use ${inUse} is before bought ${bought}`)
  const costNet = positiveMoney(cells, 'cost_net')
  const group = requiredChoice(cells, 'group', ASSET_GROUPS)
  const doubledRate = cells.doubled === undefined ? false : (booleanOf(cells.doubled) ?? refuse(`doubled "${textOf(cells.doubled)}" is neither TRUE nor FALSE`))
  const disposed = optionalDate(cells, 'disposed')
  if (disposed !== null && disposed < inUse) refuse(`disposed ${disposed} is before in_use ${inUse}`)
  return {
    name,
    bought,
    inUse,
    costNet,
    group,
    doubledRate,
    disposed,
    fundedBy: slugOf(cells.funded_by),
    ledgerReference: textOf(cells.ledger_reference),
    note: textOf(cells.note),
    id: ownIdOf('assets', row, shared),
  }
}
