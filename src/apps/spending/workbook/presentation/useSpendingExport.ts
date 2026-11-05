import { useFileExport } from '../../../../shared/storage/presentation/useFileExport'
import type { FileExport } from '../../../../shared/storage/presentation/useFileExport'
import { useSpendingBooks } from '../application/spendingStore'
import { SPENDING_APP } from '../infrastructure/spendingDocument'
import { words } from './words'

/** One export button's behaviour, shared by the top bar and the Spending Settings. */
export function useSpendingExport(): FileExport {
  return useFileExport(useSpendingBooks(), SPENDING_APP, words)
}
