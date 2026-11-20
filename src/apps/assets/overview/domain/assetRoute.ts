import type { Asset } from '../../workbook/domain/asset'
import { ASSET_RECORDS } from '../../workbook/domain/assetKinds'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'

/** An asset's page, which its own screens and the links of other apps open. */
export const ASSET_ROUTE = '/assets/asset'

/** Where an asset's page is, naming the asset by its bare UUID in `?asset=`, as a router takes it. */
export interface AssetPlace {
  readonly path: typeof ASSET_ROUTE
  readonly query: { readonly asset: string }
}

/** An asset's page. */
export function assetLink(asset: Pick<Asset, 'id'>): AssetPlace {
  return { path: ASSET_ROUTE, query: { asset: keyOfRecordId(ASSET_RECORDS, asset.id) } }
}
