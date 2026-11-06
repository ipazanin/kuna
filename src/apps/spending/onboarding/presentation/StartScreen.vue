<script setup lang="ts">
import type { FileFirstRun } from '../../../../shared/storage/presentation/fileFirstRun'
import FirstRunScreen from '../../../../shared/storage/presentation/FirstRunScreen.vue'
import { useFindFile } from '../../../../shared/storage/presentation/useFindFile'
import { SPENDING_OVERVIEW_ROUTE, SPENDING_START_ROUTE } from '../../overview/presentation/spendingLinks'
import { words as appWords } from '../../words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { LOCAL_SPENDING_TITLE, SPENDING_FILE_NAME, newSpendingFileContents } from '../../workbook/presentation/spendingFile'
import { words as fileWords } from '../../workbook/presentation/words'
import { words } from './words'

/** The Spending first run at `#/spending/start?step=…`. */
const store = useSpendingBooks()
const firstRun: FileFirstRun = {
  appId: 'spending',
  testId: 'spending-start',
  appName: appWords.name,
  startRoute: SPENDING_START_ROUTE,
  overviewRoute: SPENDING_OVERVIEW_ROUTE,
  store,
  fileName: SPENDING_FILE_NAME,
  localTitle: LOCAL_SPENDING_TITLE,
  newContents: () => newSpendingFileContents(store),
  findFile: useFindFile(store, fileWords),
  words,
}
</script>

<template>
  <FirstRunScreen :first-run="firstRun" />
</template>
