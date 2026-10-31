<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import StepCard from '../../../../shared/ui/StepCard.vue'
import { stepsOf } from '../domain/onboardingSteps'
import type { OnboardingPath } from '../domain/onboardingSteps'
import { useOnboarding } from './useOnboarding'
import { words } from './words'

/** Why the person came: new books, books from a file, or books another device keeps on Drive. */
const onboarding = useOnboarding()

const CHOICES: { label: string; description?: string; value: OnboardingPath }[] = [
  { label: words.welcome.new, value: 'new' },
  { label: words.welcome.bring, description: words.welcome.bringNote, value: 'bring' },
  { label: words.welcome.open, description: words.welcome.openNote, value: 'open' },
]

const chosen = ref<OnboardingPath>(onboarding.place.value.path === 'move' ? 'new' : onboarding.place.value.path)

function proceed(): void {
  void onboarding.go({ path: chosen.value, step: stepsOf(chosen.value, onboarding.place.value.home)[1]! })
}
</script>

<template>
  <StepCard :title="words.welcome.title">
    <URadioGroup v-model="chosen" :items="CHOICES" :legend="words.welcome.title" variant="card" :ui="{ legend: 'sr-only', fieldset: 'gap-2' }" data-testid="onboarding-path" />
    <template #actions>
      <UButton :label="words.continue" trailing-icon="i-lucide-arrow-right" data-testid="onboarding-continue" @click="proceed" />
    </template>
  </StepCard>
</template>
