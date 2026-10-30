<script setup lang="ts">
import type { FileFirstRun } from '../../../../shared/storage/presentation/fileFirstRun'
import FirstRunScreen from '../../../../shared/storage/presentation/FirstRunScreen.vue'
import { useFindFile } from '../../../../shared/storage/presentation/useFindFile'
import { INVESTMENTS_OVERVIEW_ROUTE, INVESTMENTS_START_ROUTE } from '../../overview/presentation/investmentLinks'
import { words as appWords } from '../../words'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { INVESTMENTS_FILE_NAME, LOCAL_INVESTMENTS_TITLE, newInvestmentsFileContents } from '../../workbook/presentation/investmentsFile'
import { words as fileWords } from '../../workbook/presentation/words'
import { words } from './words'

/** The Investments first run at `#/investments/start?step=…`. */
const store = useInvestmentsBooks()
const firstRun: FileFirstRun = {
  testId: 'investments-start',
  appName: appWords.name,
  startRoute: INVESTMENTS_START_ROUTE,
  overviewRoute: INVESTMENTS_OVERVIEW_ROUTE,
  store,
  fileName: INVESTMENTS_FILE_NAME,
  localTitle: LOCAL_INVESTMENTS_TITLE,
  newContents: () => newInvestmentsFileContents(store),
  findFile: useFindFile(store, fileWords),
  words,
}
</script>

<template>
  <FirstRunScreen :first-run="firstRun" />
</template>
