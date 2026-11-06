<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import { answerFromFirstRun, kunaStart } from '../../app/kunaStart'
import StepCard from '../../ui/StepCard.vue'
import type { FileFirstRun } from './fileFirstRun'
import type { FirstRunMoves } from './useFirstRun'
import { words } from './words'

type FileHome = 'drive' | 'browser' | 'open'

/**
 * Where the app's file lives, unless the person already said. A file kept in this browser is made here, since it needs nothing from Google,
 * and someone who said this browser only taps to make it. An answer here counts as the one answer, so the next app does not ask again.
 */
const props = defineProps<{ firstRun: FileFirstRun; steps: FirstRunMoves }>()
const store = props.firstRun.store
const appWords = props.firstRun.words.home

const CHOICES: { label: string; description: string; value: FileHome }[] = [
  { label: words.firstRun.home.drive, description: words.firstRun.home.driveNote, value: 'drive' },
  { label: words.firstRun.home.browser, description: words.firstRun.home.browserNote, value: 'browser' },
  { label: words.firstRun.home.open, description: words.firstRun.home.openNote, value: 'open' },
]

const answered = computed(() => kunaStart()?.home === 'browser' && store.state.choice === null)
const chosen = ref<FileHome>(answered.value ? 'browser' : 'drive')
const starting = ref(false)
const failure = ref<string | null>(null)

/** Opening another file lets go of the one kept in this browser, which a new file would carry along. */
const dropsBrowserFile = computed(() => chosen.value === 'open' && store.state.choice?.source === 'browser')

async function proceed(): Promise<void> {
  if (chosen.value !== 'open') answerFromFirstRun(chosen.value, props.firstRun.appId, store.state.choice !== null)
  if (chosen.value === 'drive') {
    await props.steps.go('folder')
    return
  }
  if (chosen.value === 'open') {
    await props.steps.go('find')
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
  await props.steps.finish()
}
</script>

<template>
  <StepCard :title="appWords.title">
    <div v-if="answered" class="rounded-control border border-default bg-elevated/40 px-3 py-3" :data-testid="`${firstRun.testId}-in-browser`">
      <p class="text-sm font-medium text-highlighted">{{ words.firstRun.home.browser }}</p>
      <p class="text-sm text-toned">{{ words.firstRun.home.browserNote }}</p>
    </div>
    <URadioGroup v-else v-model="chosen" :items="CHOICES" :legend="appWords.title" variant="card" :ui="{ legend: 'sr-only', fieldset: 'gap-2' }" :data-testid="`${firstRun.testId}-home`" />
    <UAlert v-if="dropsBrowserFile" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="appWords.dropsTitle" :description="words.firstRun.home.drops" />
    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="appWords.notMade" :description="failure" />
    <template #actions>
      <UButton :label="words.firstRun.home.continue" trailing-icon="i-lucide-arrow-right" :loading="starting" :data-testid="`${firstRun.testId}-continue`" @click="proceed" />
    </template>
  </StepCard>
</template>
