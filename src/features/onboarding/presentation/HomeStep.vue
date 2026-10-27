<script setup lang="ts">
import { ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import { today } from '../../../shared/calendar/civilDate'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { NEW_BOOKS_TITLE, newBooksDocument } from '../../workbook/presentation/workbookFiles'
import { nextStep } from '../domain/onboardingSteps'
import type { BooksHome } from '../domain/onboardingSteps'
import { statementSettingsOf } from '../domain/statementsChoice'
import StepCard from './StepCard.vue'
import { useOnboarding } from './useOnboarding'

/** Where the books live. New books kept in this browser are made here, since they need nothing from Google. */
const onboarding = useOnboarding()
const store = useWorkbook()

const CHOICES: { label: string; description: string; value: BooksHome }[] = [
  { label: 'Google Drive', description: 'One file you open on your phone and computer. Backed up daily.', value: 'drive' },
  { label: 'Only this browser', description: 'No Google. One device. Export to keep a copy.', value: 'browser' },
]

const chosen = ref<BooksHome>(onboarding.place.value.home)
const starting = ref(false)
const failure = ref<string | null>(null)

async function proceed(): Promise<void> {
  const place = { ...onboarding.place.value, home: chosen.value }
  const step = nextStep(place)!
  if (place.path === 'new' && place.home === 'browser') {
    starting.value = true
    failure.value = null
    await store.replaceLocalWorkbook(newBooksDocument(statementSettingsOf('hand', place.mail, today()), new Date().toISOString()), NEW_BOOKS_TITLE)
    starting.value = false
    if (store.state.status === 'error') {
      failure.value = store.state.error
      return
    }
  }
  await onboarding.go({ home: chosen.value, step })
}
</script>

<template>
  <StepCard title="Where the books live">
    <URadioGroup v-model="chosen" :items="CHOICES" legend="Where the books live" variant="card" :ui="{ legend: 'sr-only', fieldset: 'gap-2' }" data-testid="onboarding-home" />
    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" title="The books were not made" :description="failure" />
    <template #actions>
      <UButton label="Continue" trailing-icon="i-lucide-arrow-right" :loading="starting" data-testid="onboarding-continue" @click="proceed" />
    </template>
  </StepCard>
</template>
