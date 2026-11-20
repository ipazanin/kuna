import type { AppLinkedRows } from '../../../../shared/app/rowLinks'
import { linksNaming } from '../../../../shared/app/rowLinks'
import { ASSET_RECORDS } from '../../workbook/domain/assetKinds'
import type { AssetRows } from '../domain/assetMoney'

/** The rows of every app linked to an asset of Assets, each part on its own, or unchecked while an app that links rows failed to open. */
export function assetRowsFrom(linked: readonly AppLinkedRows[], assetsApp: string): AssetRows {
  const links = linksNaming(linked, assetsApp)
  if (links === 'unchecked') return 'unchecked'
  return links.filter(({ target }) => target.kind === ASSET_RECORDS.name).map(({ target, day, euros, counts }) => ({ asset: target.key, day, euros, counts }))
}

let readRows: () => AssetRows = () => []

/** Keeps how Assets reads the rows linked to its assets, which `app.ts` builds from what the shell hands over as Assets installs. */
export function readAssetRowsThrough(read: () => AssetRows): void {
  readRows = read
}

/** The rows linked to assets on this page now. */
export function assetRows(): AssetRows {
  return readRows()
}
