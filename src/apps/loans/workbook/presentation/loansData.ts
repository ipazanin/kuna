import { pageAppData } from '../../../../shared/storage/presentation/pageAppData'
import { exportAppFile } from '../../../../shared/storage/presentation/exportAppFile'
import { words as appWords } from '../../words'
import { useLoansBooks } from '../application/loansStore'
import { LOANS_APP } from '../infrastructure/loansDocument'
import { words as fileWords } from './words'

const store = useLoansBooks()

/** The Loans file as the delete dialogs reach it. */
export const loansData = pageAppData({
  id: LOANS_APP,
  name: appWords.name,
  store,
  backUp: () => exportAppFile(store, LOANS_APP, fileWords.nothingToExport),
})
