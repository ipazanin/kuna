import { pageAppData } from '../../../../shared/storage/presentation/pageAppData'
import { switchMailDrafts } from '../../invoicing/infrastructure/mailDraftSwitch'
import { words as appWords } from '../../words'
import { useWorkbook } from '../application/workbookStore'
import { COMPANY_APP } from '../infrastructure/companyDocument'

const store = useWorkbook()

/** The company's books as the delete dialogs reach them, with the switch for invoice mail drafts on this device. */
export const companyData = pageAppData({
  id: COMPANY_APP,
  name: appWords.name,
  store,
  async backUp() {
    const { exportWorkbook } = await import('./workbookFiles')
    return exportWorkbook(store)
  },
  forgetOnThisDevice() {
    switchMailDrafts(false)
  },
})
