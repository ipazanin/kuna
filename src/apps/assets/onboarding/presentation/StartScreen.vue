<script setup lang="ts">
import type { FileFirstRun } from '../../../../shared/storage/presentation/fileFirstRun'
import FirstRunScreen from '../../../../shared/storage/presentation/FirstRunScreen.vue'
import { useFindFile } from '../../../../shared/storage/presentation/useFindFile'
import { ASSETS_OVERVIEW_ROUTE, ASSETS_START_ROUTE } from '../../overview/presentation/assetLinks'
import { words as appWords } from '../../words'
import { useAssetsBooks } from '../../workbook/application/assetsStore'
import { ASSETS_FILE_NAME, LOCAL_ASSETS_TITLE, newAssetsFileContents } from '../../workbook/presentation/assetsFile'
import { words as fileWords } from '../../workbook/presentation/words'
import { words as assistantWords } from '../../assistant/words'
import { words } from './words'

/** The Assets first run at `#/assets/start?step=…`. */
const store = useAssetsBooks()
const firstRun: FileFirstRun = {
  appId: 'assets',
  testId: 'assets-start',
  appName: appWords.name,
  startRoute: ASSETS_START_ROUTE,
  overviewRoute: ASSETS_OVERVIEW_ROUTE,
  store,
  fileName: ASSETS_FILE_NAME,
  localTitle: LOCAL_ASSETS_TITLE,
  chatTask: assistantWords.guides.setUp.title,
  newContents: () => newAssetsFileContents(store),
  findFile: useFindFile(store, fileWords),
  words,
}
</script>

<template>
  <FirstRunScreen :first-run="firstRun" />
</template>
