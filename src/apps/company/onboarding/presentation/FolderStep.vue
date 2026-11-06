<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'

import FirstRunFolderStep from '../../../../shared/storage/presentation/FirstRunFolderStep.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useCompanyFirstRun } from './useCompanyFirstRun'
import { useOnboarding } from './useOnboarding'
import { words } from './words'

/** The folder step of each path that makes a file on Drive: new books, the file brought along, or the books this browser keeps. */
const onboarding = useOnboarding()
const store = useWorkbook()
const { firstRun, steps } = useCompanyFirstRun()

const path = computed(() => onboarding.place.value.path)

/** The books the file keeps on the bring and move paths. Null when the page no longer holds them. New books are made from the choices instead. */
const moving = computed(() => {
  if (path.value === 'new') return undefined
  if (path.value === 'bring') return onboarding.heldFile.value?.document ?? null
  return store.state.choice?.source === 'browser' ? (store.state.snapshot?.document ?? null) : null
})
</script>

<template>
  <FirstRunFolderStep :first-run="firstRun" :steps="steps" :moving="moving">
    <template #missing>
      <UAlert
        icon="i-lucide-file-question"
        color="warning"
        variant="subtle"
        :title="path === 'bring' ? words.folder.reopen : words.folder.nothingToMove"
        :description="path === 'bring' ? words.folder.reopenNote : words.folder.nothingToMoveNote"
      />
    </template>
  </FirstRunFolderStep>
</template>
