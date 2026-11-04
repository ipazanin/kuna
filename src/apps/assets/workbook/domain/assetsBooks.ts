import type { AssetBook, AssetsRecords } from './readAssetBook'

/** The assets the file holds, with the name of the file on screen. */
export interface AssetsWorkbook extends AssetBook {
  readonly title: string
}

/** What the Assets app reads from its file: its records of each kind and the assets they make. */
export interface AssetsBooks {
  readonly records: AssetsRecords
  readonly workbook: AssetsWorkbook
}
