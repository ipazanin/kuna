import { pageAppData } from '../../../../shared/storage/presentation/pageAppData'
import { exportAppFile } from '../../../../shared/storage/presentation/exportAppFile'
import { saveLastFetch } from '../../bankSync/infrastructure/lastFetch'
import { savePendingLink, takeReturnNote } from '../../../../shared/bank-sync/infrastructure/bankBrowserState'
import { forgetLastAccount } from '../../entries/infrastructure/lastAccount'
import { words as appWords } from '../../words'
import { useSpendingBooks } from '../application/spendingStore'
import { SPENDING_APP } from '../domain/spendingBooks'
import { words as fileWords } from './words'

const store = useSpendingBooks()

/** The Spending file as the delete dialogs reach it, with the last account and the bank link this device remembers. */
export const spendingData = pageAppData({
  id: SPENDING_APP,
  name: appWords.name,
  store,
  backUp: () => exportAppFile(store, SPENDING_APP, fileWords.nothingToExport),
  forgetOnThisDevice() {
    forgetLastAccount()
    savePendingLink(null)
    saveLastFetch(null)
    takeReturnNote()
  },
})
