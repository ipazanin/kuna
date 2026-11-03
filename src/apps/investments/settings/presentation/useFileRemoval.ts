import { withGoogleAccess } from '../../../../shared/google/withGoogleAccess'
import { usePageSync } from '../../../../shared/sync/presentation/pageSync'
import { deleteKeysFiles } from '../../prices/application/keysSync'
import { trashPricesFilesBeside } from '../../prices/application/pricesUpdate'
import { pageKeysDrive } from '../../prices/presentation/useKeysSync'
import { forgetPricesCopy, pagePricesDrive, usePrices } from '../../prices/presentation/usePrices'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { removeInvestmentsFile } from '../application/fileRemoval'
import type { FileRemovalPorts, RemovalReport } from '../application/fileRemoval'
import { words } from './words'

const store = useInvestmentsBooks()
const prices = usePrices()

const PAGE_REMOVAL: FileRemovalPorts = {
  async deleteKeysFiles(investmentsFileId) {
    await deleteKeysFiles(await pageKeysDrive(), investmentsFileId)
  },
  async trashPricesFiles(investmentsFileId) {
    await trashPricesFilesBeside(await pagePricesDrive(), investmentsFileId)
  },
  async dropFile(investmentsFileId, first) {
    return (await store.dropWorkbook(investmentsFileId, first)) ? null : (store.state.error ?? words.removal.notRemoved)
  },
  forgetPricesCopy,
  withoutPrices: (work) => prices.whileStopped(work),
  syncsOver: () => usePageSync().settled(),
  syncing: () => usePageSync().running(),
}

/**
 * Removes the Investments file on screen, as `removeInvestmentsFile` says, asking Google first for the two permissions
 * a file on Drive needs: `drive.file` for the files Kuna made and `drive.appdata` for its hidden folder. Null while no
 * file is chosen. Call it first in a click handler.
 */
export function removeShownFile(): Promise<RemovalReport | null> {
  const choice = store.state.choice
  if (choice === null) {
    return Promise.resolve(null)
  }
  return withGoogleAccess(choice.source === 'drive' ? ['drive.file', 'drive.appdata'] : [], () => removeInvestmentsFile(PAGE_REMOVAL, choice))
}
