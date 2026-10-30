<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { DriveFileLookup } from '../../../../shared/storage/application/workbookPorts'
import StepCard from '../../../../shared/ui/StepCard.vue'
import { LOANS_FILE_NAME } from '../../workbook/presentation/loansFile'
import { useFindLoansFile } from '../../workbook/presentation/useFindLoansFile'
import { useLoansStart } from './useLoansStart'
import { words } from './words'

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
  <StepCard :title="words.find.title">
    <p class="text-sm text-toned">
      {{ words.find.before }}<span class="identifier">{{ LOANS_FILE_NAME }}</span
      >{{ words.find.after }}
    </p>
    <template #actions>
      <UButton :label="words.find.pick" icon="i-lucide-file-search" color="neutral" variant="outline" :loading="lookingUp === 'pick'" :disabled="lookingUp !== null" @click="find('pick')" />
      <UButton :label="words.find.find" icon="i-lucide-search" :loading="lookingUp === 'find'" :disabled="lookingUp !== null" data-testid="loans-start-find" @click="find('find')" />
    </template>
  </StepCard>
</template>
