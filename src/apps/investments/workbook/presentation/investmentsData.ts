import { pageAppData } from '../../../../shared/storage/presentation/pageAppData'
import { exportAppFile } from '../../../../shared/storage/presentation/exportAppFile'
import { trashPricesFilesBeside } from '../../prices/application/pricesUpdate'
import { PRICES_FILE_NAME } from '../../prices/domain/pricesFile'
import { forgetPricesCopy, pagePricesDrive, usePrices } from '../../prices/presentation/usePrices'
import { words as appWords } from '../../words'
import { useInvestmentsBooks } from '../application/investmentsStore'
import { INVESTMENTS_APP } from '../infrastructure/investmentsDocument'
import { words as fileWords } from './words'

const store = useInvestmentsBooks()

/** The Investments file as the delete dialogs reach it, with its prices file on Drive and its prices in this browser. */
export const investmentsData = pageAppData({
  id: INVESTMENTS_APP,
  name: appWords.name,
  store,
  backUp: () => exportAppFile(store, INVESTMENTS_APP, fileWords.nothingToExport),
  beside: {
    fileName: PRICES_FILE_NAME,
    async trashFiles(fileId) {
      await trashPricesFilesBeside(await pagePricesDrive(), fileId)
    },
    forgetCopy: forgetPricesCopy,
    whileStopped: (work) => usePrices().whileStopped(work),
  },
})
