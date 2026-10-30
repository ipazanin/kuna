import { useFileExport } from '../../../../shared/storage/presentation/useFileExport'
import type { FileExport } from '../../../../shared/storage/presentation/useFileExport'
import { useLoansBooks } from '../application/loansStore'
import { LOANS_APP } from '../infrastructure/loansDocument'
import { words } from './words'

/** One export button's behaviour, shared by the top bar and the Loans Settings. */
export function useLoansExport(): FileExport {
  return useFileExport(useLoansBooks(), LOANS_APP, words)
}
