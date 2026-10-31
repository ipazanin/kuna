<script setup lang="ts">
import { ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { DriveFileLookup } from '../../../../shared/storage/application/workbookPorts'
import StepCard from '../../../../shared/ui/StepCard.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useFindDriveFile } from '../../workbook/presentation/useFindDriveFile'
import { useOnboarding } from './useOnboarding'
import { words } from './words'

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
  <StepCard :title="words.find.title">
    <p class="text-sm text-toned">{{ words.find.body }}</p>
    <template #actions>
      <UButton :label="words.find.pick" icon="i-lucide-file-search" color="neutral" variant="outline" :loading="lookingUp === 'pick'" :disabled="lookingUp !== null" @click="find('pick')" />
      <UButton :label="words.find.find" icon="i-lucide-search" :loading="lookingUp === 'find'" :disabled="lookingUp !== null" data-testid="onboarding-find" @click="find('find')" />
    </template>
  </StepCard>
</template>
