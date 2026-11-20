import { ASSET_RECORDS } from '../../workbook/domain/assetKinds'
import type { AssetBook, AssetWithValuations } from '../../workbook/domain/readAssetBook'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'

export const ASSETS_OVERVIEW_ROUTE = '/assets'
/** The Assets first run, with its step in the query. */
export const ASSETS_START_ROUTE = '/assets/start'
export const ASSETS_SETTINGS_ROUTE = '/assets/settings'
/** The Assistant tab of the Assets settings, which says whether the chat asks before it reads. */
export const ASSETS_ASSISTANT_LINK = `${ASSETS_SETTINGS_ROUTE}?tab=assistant`

/** The asset the page's `?asset=` names, or null when the file has none by that id. */
export function assetNamed(book: AssetBook, key: unknown): AssetWithValuations | null {
  return typeof key === 'string' ? (book.assets.find((entry) => entry.asset.id === recordIdOf(ASSET_RECORDS, key)) ?? null) : null
}
