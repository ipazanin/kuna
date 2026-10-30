<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import StepCard from '../../ui/StepCard.vue'
import type { DriveFileLookup } from '../application/workbookPorts'
import type { FileFirstRun } from './fileFirstRun'
import { useFirstRun } from './useFirstRun'
import { words } from './words'

/** The app's file another device keeps on Drive: found by the app's mark, or picked. Once it is on screen, the app's overview. */
const props = defineProps<{ firstRun: FileFirstRun }>()
const start = useFirstRun(props.firstRun)
const appWords = props.firstRun.words.find
const lookingUp = ref<DriveFileLookup | null>(null)

async function find(lookup: DriveFileLookup): Promise<void> {
  lookingUp.value = lookup
  const opened = await props.firstRun.findFile(lookup)
  lookingUp.value = null
  if (opened) await start.finish()
}
</script>

<template>
  <StepCard :title="appWords.title">
    <p class="text-sm text-toned">
      {{ appWords.before }}<span class="identifier">{{ firstRun.fileName }}</span
      >{{ appWords.after }}
    </p>
    <template #actions>
      <UButton :label="words.firstRun.find.pick" icon="i-lucide-file-search" color="neutral" variant="outline" :loading="lookingUp === 'pick'" :disabled="lookingUp !== null" @click="find('pick')" />
      <UButton :label="words.firstRun.find.find" icon="i-lucide-search" :loading="lookingUp === 'find'" :disabled="lookingUp !== null" :data-testid="`${firstRun.testId}-find`" @click="find('find')" />
    </template>
  </StepCard>
</template>
