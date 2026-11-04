import { useFileExport } from '../../../../shared/storage/presentation/useFileExport'
import type { FileExport } from '../../../../shared/storage/presentation/useFileExport'
import { useAssetsBooks } from '../application/assetsStore'
import { ASSETS_APP } from '../infrastructure/assetsDocument'
import { words } from './words'

/** One export button's behaviour, shared by the top bar and the Assets Settings. */
export function useAssetsExport(): FileExport {
  return useFileExport(useAssetsBooks(), ASSETS_APP, words)
}
