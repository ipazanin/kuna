<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import StepCard from '../../../../shared/ui/StepCard.vue'
import { useLoansBooks } from '../../workbook/application/loansStore'
import { LOCAL_LOANS_TITLE, newLoansFileContents } from '../../workbook/presentation/loansFile'
import { useLoansStart } from './useLoansStart'
import { words } from './words'

type LoansHome = 'drive' | 'browser' | 'open'

/** Where the Loans file lives. A file kept in this browser is made here, since it needs nothing from Google. */
const start = useLoansStart()
const store = useLoansBooks()

const CHOICES: { label: string; description: string; value: LoansHome }[] = [
  { label: words.home.drive, description: words.home.driveNote, value: 'drive' },
  { label: words.home.browser, description: words.home.browserNote, value: 'browser' },
  { label: words.home.open, description: words.home.openNote, value: 'open' },
]

const chosen = ref<LoansHome>('drive')
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
  await store.replaceLocalWorkbook(newLoansFileContents(store), LOCAL_LOANS_TITLE)
  starting.value = false
  if (store.state.status === 'error') {
    failure.value = store.state.error
    return
  }
  await start.finish()
}
</script>

<template>
  <StepCard :title="words.home.title">
    <URadioGroup v-model="chosen" :items="CHOICES" :legend="words.home.title" variant="card" :ui="{ legend: 'sr-only', fieldset: 'gap-2' }" data-testid="loans-start-home" />
    <UAlert v-if="dropsBrowserFile" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="words.home.dropsTitle" :description="words.home.drops" />
    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="words.home.notMade" :description="failure" />
    <template #actions>
      <UButton :label="words.home.continue" trailing-icon="i-lucide-arrow-right" :loading="starting" data-testid="loans-start-continue" @click="proceed" />
    </template>
  </StepCard>
</template>
