import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useRouter } from 'vue-router'

import { today } from '../../../../shared/calendar/civilDate'
import type { DriveFirstRun } from '../../../../shared/storage/presentation/fileFirstRun'
import type { FirstRunMoves } from '../../../../shared/storage/presentation/useFirstRun'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useFindDriveFile } from '../../workbook/presentation/useFindDriveFile'
import { BOOKS_FILE_NAME, newBooksDocument } from '../../workbook/presentation/workbookFiles'
import { statementSettingsOf } from '../domain/statementsChoice'
import { onboardingStart, useOnboarding } from './useOnboarding'
import { words } from './words'

export interface CompanyFirstRun {
  readonly firstRun: ComputedRef<DriveFirstRun>
  readonly steps: FirstRunMoves
}

/** The company's books as the shared folder and find steps take them, and the moves those steps make on onboarding's paths. */
export function useCompanyFirstRun(): CompanyFirstRun {
  const onboarding = useOnboarding()
  const router = useRouter()
  const store = useWorkbook()
  const { findDriveFile } = useFindDriveFile()

  const firstRun = computed<DriveFirstRun>(() => {
    const { statements, mail } = onboarding.place.value
    return {
      testId: 'company-start',
      store,
      fileName: BOOKS_FILE_NAME,
      newContents: () => newBooksDocument(statementSettingsOf(statements, mail, today()), new Date().toISOString()),
      findFile: findDriveFile,
      words: {
        folder: {
          title: words.folder.title,
          savedIn: words.folder.savedIn,
          choose: words.folder.choose(statements === 'mail'),
          onDriveTitle: words.folder.onDriveTitle,
          onDriveDrops: words.folder.onDriveDrops,
          openOnDrive: words.folder.openOnDrive,
        },
        find: words.find,
      },
    }
  })

  return {
    firstRun,
    steps: {
      async go(step) {
        // The find step is on the open path alone.
        await (step === 'find' ? router.push(onboardingStart('open', 'find')) : onboarding.go({ step }))
      },
      async finish() {
        // Books the new and bring paths made stay named in the route, so going back finds them made.
        const path = onboarding.place.value.path
        await (path === 'new' || path === 'bring' ? onboarding.made() : onboarding.finish())
      },
    },
  }
}
