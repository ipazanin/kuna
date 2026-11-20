import type { AppAssets, PublishedAsset } from '../../../../shared/app/assetTargets'
import { homeCardFigures } from '../../../../shared/app/homeCardFigures'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import { assetLink } from '../../overview/domain/assetRoute'
import { useAssetsBooks } from '../../workbook/application/assetsStore'
import { ASSETS_APP } from '../../workbook/domain/assetsApp'
import { ASSET_RECORDS } from '../../workbook/domain/assetKinds'
import type { AssetsWorkbook } from '../../workbook/domain/assetsBooks'
import type { AssetBook } from '../../workbook/domain/readAssetBook'

/** Each asset of the book as another app reads it, named by its id, with its name, what it is, the day it was bought and its page. */
export function assetTargetsOf(book: Pick<AssetBook, 'assets'>): readonly PublishedAsset[] {
  return book.assets.map(({ asset }) => ({
    link: { app: ASSETS_APP, kind: ASSET_RECORDS.name, key: keyOfRecordId(ASSET_RECORDS, asset.id), due: null },
    name: asset.name,
    kind: asset.kind,
    bought: asset.bought,
    to: assetLink(asset),
  }))
}

const { state } = useAssetsBooks()

/** The assets last worked out, built again only when a write or a sync gives the store a new book. */
let latest: { readonly workbook: AssetsWorkbook; readonly assets: readonly PublishedAsset[] } | null = null

/** The assets of the file on screen, a wait while it opens, a failure, or null while Assets is not set up. */
export function publishedAssets(): AppAssets {
  return homeCardFigures(state, (workbook) => {
    if (latest === null || latest.workbook !== workbook) latest = { workbook, assets: assetTargetsOf(workbook) }
    return latest.assets
  })
}
