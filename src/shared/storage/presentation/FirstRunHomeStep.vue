<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import StepCard from '../../ui/StepCard.vue'
import type { FileFirstRun } from './fileFirstRun'
import { useFirstRun } from './useFirstRun'
import { words } from './words'

type FileHome = 'drive' | 'browser' | 'open'

/** Where the app's file lives. A file kept in this browser is made here, since it needs nothing from Google. */
const props = defineProps<{ firstRun: FileFirstRun }>()
const start = useFirstRun(props.firstRun)
const store = props.firstRun.store
const appWords = props.firstRun.words.home

const CHOICES: { label: string; description: string; value: FileHome }[] = [
  { label: words.firstRun.home.drive, description: words.firstRun.home.driveNote, value: 'drive' },
  { label: words.firstRun.home.browser, description: words.firstRun.home.browserNote, value: 'browser' },
  { label: words.firstRun.home.open, description: words.firstRun.home.openNote, value: 'open' },
]

const chosen = ref<FileHome>('drive')
const starting = ref(false)
const failure = ref<string | null>(null)

/** Opening another file lets go of the one kept in this browser, which a new file would carry along. */
const dropsBrowserFile = computed(() => chosen.value === 'open' && store.state.choice?.source === 'browser')

async function proceed(): Promise<void> {
  if (chosen.value === 'drive') {
    await start.go('folder')
    return
  }
  if (chosen.value === 'open') {
    await start.go('find')
    return
  }
  starting.value = true
  failure.value = null
  await store.replaceLocalWorkbook(props.firstRun.newContents(), props.firstRun.localTitle)
  starting.value = false
  if (store.state.status === 'error') {
    failure.value = store.state.error
    return
  }
  await start.finish()
}
</script>

<template>
  <StepCard :title="appWords.title">
    <URadioGroup v-model="chosen" :items="CHOICES" :legend="appWords.title" variant="card" :ui="{ legend: 'sr-only', fieldset: 'gap-2' }" :data-testid="`${firstRun.testId}-home`" />
    <UAlert v-if="dropsBrowserFile" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="appWords.dropsTitle" :description="words.firstRun.home.drops" />
    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="appWords.notMade" :description="failure" />
    <template #actions>
      <UButton :label="words.firstRun.home.continue" trailing-icon="i-lucide-arrow-right" :loading="starting" :data-testid="`${firstRun.testId}-continue`" @click="proceed" />
    </template>
  </StepCard>
</template>
