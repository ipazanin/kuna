<script setup lang="ts">
import type { FileFirstRun } from '../../../../shared/storage/presentation/fileFirstRun'
import FirstRunScreen from '../../../../shared/storage/presentation/FirstRunScreen.vue'
import { LOANS_OVERVIEW_ROUTE, LOANS_START_ROUTE } from '../../overview/presentation/loanLinks'
import { words as appWords } from '../../words'
import { useLoansBooks } from '../../workbook/application/loansStore'
import { LOANS_FILE_NAME, LOCAL_LOANS_TITLE, newLoansFileContents } from '../../workbook/presentation/loansFile'
import { useFindLoansFile } from '../../workbook/presentation/useFindLoansFile'
import { words } from './words'

/** The Loans first run at `#/loans/start?step=…`. */
const store = useLoansBooks()
const firstRun: FileFirstRun = {
  testId: 'loans-start',
  appName: appWords.name,
  startRoute: LOANS_START_ROUTE,
  overviewRoute: LOANS_OVERVIEW_ROUTE,
  store,
  fileName: LOANS_FILE_NAME,
  localTitle: LOCAL_LOANS_TITLE,
  newContents: () => newLoansFileContents(store),
  findFile: useFindLoansFile(),
  words,
}
</script>

<template>
  <FirstRunScreen :first-run="firstRun" />
</template>
