<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { DriveFileLookup } from '../../../../shared/storage/application/workbookPorts'
import { LOANS_FILE_NAME } from '../../workbook/presentation/loansFile'
import { useFindLoansFile } from '../../workbook/presentation/useFindLoansFile'
import StepCard from './StepCard.vue'
import { useLoansStart } from './useLoansStart'

/** The Loans file another device keeps on Drive: found by the app's mark, or picked. Once it is on screen, the Loans Overview. */
const start = useLoansStart()
const findLoansFile = useFindLoansFile()
const lookingUp = ref<DriveFileLookup | null>(null)

async function find(lookup: DriveFileLookup): Promise<void> {
  lookingUp.value = lookup
  const opened = await findLoansFile(lookup)
  lookingUp.value = null
  if (opened) await start.finish()
}
</script>

<template>
  <StepCard title="Find your Loans file on Drive">
    <p class="text-sm text-toned">
      Find the file opens <span class="identifier">{{ LOANS_FILE_NAME }}</span>, the file the app marked as the Loans file, or asks you to pick it when there is none.
      Pick another file lets you choose the .json file yourself. The app keeps a copy in this browser.
    </p>
    <template #actions>
      <UButton label="Pick another file" icon="i-lucide-file-search" color="neutral" variant="outline" :loading="lookingUp === 'pick'" :disabled="lookingUp !== null" @click="find('pick')" />
      <UButton label="Find the file" icon="i-lucide-search" :loading="lookingUp === 'find'" :disabled="lookingUp !== null" data-testid="loans-start-find" @click="find('find')" />
    </template>
  </StepCard>
</template>
