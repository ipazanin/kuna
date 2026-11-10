import type { RouteLocationRaw } from 'vue-router'

import type { Asset } from '../../workbook/domain/asset'
import { ASSET_RECORDS } from '../../workbook/domain/assetKinds'
import type { AssetBook, AssetWithValuations } from '../../workbook/domain/readAssetBook'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'

export const ASSETS_OVERVIEW_ROUTE = '/assets'
/** The Assets first run, with its step in the query. */
export const ASSETS_START_ROUTE = '/assets/start'
export const ASSETS_SETTINGS_ROUTE = '/assets/settings'
/** The Assistant tab of the Assets settings, which says whether the chat asks before it reads. */
export const ASSETS_ASSISTANT_LINK = `${ASSETS_SETTINGS_ROUTE}?tab=assistant`
export const ASSET_ROUTE = '/assets/asset'

/** An asset's page, which names the asset by its bare UUID in `?asset=`. */
export function assetLink(asset: Asset): RouteLocationRaw {
  return { path: ASSET_ROUTE, query: { asset: keyOfRecordId(ASSET_RECORDS, asset.id) } }
}

/** The asset the page's `?asset=` names, or null when the file has none by that id. */
export function assetNamed(book: AssetBook, key: unknown): AssetWithValuations | null {
  return typeof key === 'string' ? (book.assets.find((entry) => entry.asset.id === recordIdOf(ASSET_RECORDS, key)) ?? null) : null
}
