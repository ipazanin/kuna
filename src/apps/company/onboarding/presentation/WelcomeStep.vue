<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import StepCard from '../../../../shared/ui/StepCard.vue'
import { stepsOf } from '../domain/onboardingSteps'
import type { OnboardingPath } from '../domain/onboardingSteps'
import { useOnboarding } from './useOnboarding'

/** Why the person came: new books, books from a file, or books another device keeps on Drive. */
const onboarding = useOnboarding()

const CHOICES: { label: string; description?: string; value: OnboardingPath }[] = [
  { label: 'Start new books', value: 'new' },
  { label: 'Bring my books', description: 'An Excel file, a Google Sheet download or a Kuna file', value: 'bring' },
  { label: 'Open my books on Google Drive', description: 'Another device already keeps them', value: 'open' },
]

const chosen = ref<OnboardingPath>(onboarding.place.value.path === 'move' ? 'new' : onboarding.place.value.path)

function proceed(): void {
  void onboarding.go({ path: chosen.value, step: stepsOf(chosen.value, onboarding.place.value.home)[1]! })
}
</script>

<template>
  <StepCard title="What brings you here?">
    <URadioGroup v-model="chosen" :items="CHOICES" legend="What brings you here?" variant="card" :ui="{ legend: 'sr-only', fieldset: 'gap-2' }" data-testid="onboarding-path" />
    <template #actions>
      <UButton label="Continue" trailing-icon="i-lucide-arrow-right" data-testid="onboarding-continue" @click="proceed" />
    </template>
  </StepCard>
</template>
