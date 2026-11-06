import type { SetUpLine } from '../../../../shared/app/appContribution'
import { words } from './words'

/** An Assets file has one thing to set up: its first asset. */
export function assetsSetUp(book: { readonly assets: readonly unknown[] }): SetUpLine[] {
  return book.assets.length > 0 ? [] : [{ key: 'first-asset', text: words.setUp.firstAsset }]
}
