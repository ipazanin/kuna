import { useFileExport } from '../../../../shared/storage/presentation/useFileExport'
import type { FileExport } from '../../../../shared/storage/presentation/useFileExport'
import { useInvestmentsBooks } from '../application/investmentsStore'
import { INVESTMENTS_APP } from '../infrastructure/investmentsDocument'
import { words } from './words'

/** One export button's behaviour, shared by the top bar and the Investments Settings. */
export function useInvestmentsExport(): FileExport {
  return useFileExport(useInvestmentsBooks(), INVESTMENTS_APP, words)
}
