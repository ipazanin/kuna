<script setup lang="ts">
import { ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import { answerFromFirstRun } from '../../../../shared/app/kunaStart'
import StepCard from '../../../../shared/ui/StepCard.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { NEW_BOOKS_TITLE, newBooksDocument } from '../../workbook/presentation/workbookFiles'
import { nextStep } from '../domain/onboardingSteps'
import type { BooksHome } from '../domain/onboardingSteps'
import { STATEMENTS_BY_HAND } from '../domain/statementsChoice'
import { useOnboarding } from './useOnboarding'
import { words } from './words'

/** Where the books live, unless the person already said this browser. New books kept in this browser are made here, since they need nothing from Google. An answer here is the one answer every app reads. */
const onboarding = useOnboarding()
const store = useWorkbook()

const CHOICES: { label: string; description: string; value: BooksHome }[] = [
  { label: words.home.drive, description: words.home.driveNote, value: 'drive' },
  { label: words.home.browser, description: words.home.browserNote, value: 'browser' },
]

const chosen = ref<BooksHome>(onboarding.place.value.home)
const starting = ref(false)
const failure = ref<string | null>(null)

async function proceed(): Promise<void> {
  const place = { ...onboarding.place.value, home: chosen.value }
  answerFromFirstRun(chosen.value, 'company', store.state.choice !== null)
  if (place.path !== 'new' || place.home !== 'browser') {
    await onboarding.go({ home: chosen.value, step: nextStep(place)! })
    return
  }
  starting.value = true
  failure.value = null
  await store.replaceLocalWorkbook(newBooksDocument(STATEMENTS_BY_HAND, new Date().toISOString()), NEW_BOOKS_TITLE)
  starting.value = false
  if (store.state.status === 'error') {
    failure.value = store.state.error
    return
  }
  await onboarding.made({ home: chosen.value })
}
</script>

<template>
  <StepCard :title="words.home.title">
    <div v-if="!onboarding.place.value.asksHome" class="rounded-control border border-default bg-elevated/40 px-3 py-3" data-testid="onboarding-in-browser">
      <p class="text-sm font-medium text-highlighted">{{ words.home.browser }}</p>
      <p class="text-sm text-toned">{{ words.home.browserNote }}</p>
    </div>
    <URadioGroup v-else v-model="chosen" :items="CHOICES" :legend="words.home.title" variant="card" :ui="{ legend: 'sr-only', fieldset: 'gap-2' }" data-testid="onboarding-home" />
    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="words.home.notMade" :description="failure" />
    <template #actions>
      <UButton :label="words.continue" trailing-icon="i-lucide-arrow-right" :loading="starting" data-testid="onboarding-continue" @click="proceed" />
    </template>
  </StepCard>
</template>
