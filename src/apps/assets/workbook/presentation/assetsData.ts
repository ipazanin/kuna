import { pageAppData } from '../../../../shared/storage/presentation/pageAppData'
import { exportAppFile } from '../../../../shared/storage/presentation/exportAppFile'
import { words as appWords } from '../../words'
import { useAssetsBooks } from '../application/assetsStore'
import { ASSETS_APP } from '../infrastructure/assetsDocument'
import { words as fileWords } from './words'

const store = useAssetsBooks()

/** The Assets file as the delete dialogs reach it. */
export const assetsData = pageAppData({
  id: ASSETS_APP,
  name: appWords.name,
  store,
  backUp: () => exportAppFile(store, ASSETS_APP, fileWords.nothingToExport),
})
