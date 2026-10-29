<script setup lang="ts">
import { ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { DriveFileLookup } from '../../../../shared/storage/application/workbookPorts'
import StepCard from '../../../../shared/ui/StepCard.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useFindDriveFile } from '../../workbook/presentation/useFindDriveFile'
import { useOnboarding } from './useOnboarding'

/** The books another device keeps on Drive: found by the app's mark, or picked. Once they are on screen, Overview. */
const onboarding = useOnboarding()
const store = useWorkbook()
const { findDriveFile } = useFindDriveFile()
const lookingUp = ref<DriveFileLookup | null>(null)

const before = store.state.choice
// A find that a trip to Google resumed lands here too.
watch(
  () => store.state.choice,
  (choice) => {
    if (choice?.source === 'drive' && choice !== before) void onboarding.finish()
  },
)

async function find(lookup: DriveFileLookup): Promise<void> {
  lookingUp.value = lookup
  await findDriveFile(lookup)
  lookingUp.value = null
}
</script>

<template>
  <StepCard title="Find your books on Drive">
    <p class="text-sm text-toned">
      Find the file opens the file the app marked as its books, or asks you to pick it when there is none. Pick another file lets you choose the .json file yourself. The app keeps a copy in this
      browser, and writes only that file and the backups folder beside it.
    </p>
    <template #actions>
      <UButton label="Pick another file" icon="i-lucide-file-search" color="neutral" variant="outline" :loading="lookingUp === 'pick'" :disabled="lookingUp !== null" @click="find('pick')" />
      <UButton label="Find the file" icon="i-lucide-search" :loading="lookingUp === 'find'" :disabled="lookingUp !== null" data-testid="onboarding-find" @click="find('find')" />
    </template>
  </StepCard>
</template>
