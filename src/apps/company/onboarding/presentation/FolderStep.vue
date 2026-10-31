<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import FirstRunFolderStep from '../../../../shared/storage/presentation/FirstRunFolderStep.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { MAIL_STATEMENTS_FOLDER } from '../domain/statementsChoice'
import { useCompanyFirstRun } from './useCompanyFirstRun'
import { useOnboarding } from './useOnboarding'
import { words } from './words'

/**
 * The folder step of each path that makes a file on Drive: new books, the file brought along, or the
 * books this browser keeps. Statements from mail go into a folder the app makes beside the new
 * books, which `drive.file` can read.
 */
const onboarding = useOnboarding()
const store = useWorkbook()
const { firstRun, steps } = useCompanyFirstRun()

const path = computed(() => onboarding.place.value.path)
const fromMail = computed(() => onboarding.place.value.statements === 'mail')

/** The books the file keeps on the bring and move paths. Null when the page no longer holds them. New books are made from the choices instead. */
const moving = computed(() => {
  if (path.value === 'new') return undefined
  if (path.value === 'bring') return onboarding.heldFile.value?.document ?? null
  return store.state.choice?.source === 'browser' ? (store.state.snapshot?.document ?? null) : null
})
</script>

<template>
  <FirstRunFolderStep :first-run="firstRun" :steps="steps" :moving="moving" :beside-folders="fromMail ? [MAIL_STATEMENTS_FOLDER] : []">
    <template #missing>
      <UAlert
        icon="i-lucide-file-question"
        color="warning"
        variant="subtle"
        :title="path === 'bring' ? words.folder.reopen : words.folder.nothingToMove"
        :description="path === 'bring' ? words.folder.reopenNote : words.folder.nothingToMoveNote"
      />
    </template>
    <template v-if="fromMail" #beside>
      <p class="flex items-center gap-2 text-sm text-toned" data-testid="onboarding-folder-statements">
        <UIcon name="i-lucide-folder-input" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span class="min-w-0"
          >{{ words.folder.statementsBefore }}<span class="identifier">{{ MAIL_STATEMENTS_FOLDER }}</span
          >{{ words.folder.statementsAfter }}</span
        >
      </p>
    </template>
  </FirstRunFolderStep>
</template>
