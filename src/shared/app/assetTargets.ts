import type { RouteLocationRaw } from 'vue-router'

import type { CivilDate } from '../calendar/civilDate'
import type { PublishedLinkTarget } from './rowLinks'

/** What an asset is, as another app reads it: a flat or house, a car, or anything else. */
export type PublishedAssetKind = 'home' | 'car' | 'other'

/** Something a person owns, as another app reads it: its name, what it is and the day it was bought, which a row of money can be paid for or earned by. */
export interface PublishedAsset {
  readonly link: PublishedLinkTarget
  readonly name: string
  readonly kind: PublishedAssetKind
  readonly bought: CivilDate | null
  readonly to: RouteLocationRaw
}

/** An app's assets, a wait while its file opens, a failure, or null while the app is not set up. */
export type AppAssets = readonly PublishedAsset[] | 'opening' | 'failed' | null

/** The assets one app publishes, under the app's id. */
export interface AssetsOfApp {
  readonly app: string
  readonly assets: AppAssets
}
