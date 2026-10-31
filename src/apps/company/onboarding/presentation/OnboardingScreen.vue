<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

import FirstRunFindStep from '../../../../shared/storage/presentation/FirstRunFindStep.vue'
import FirstRunPage from '../../../../shared/storage/presentation/FirstRunPage.vue'
import type { StepFlow } from '../../../../shared/ui/StepCard.vue'
import { words as appWords } from '../../words'
import { makingStep, previousStep } from '../domain/onboardingSteps'
import type { OnboardingStep } from '../domain/onboardingSteps'
import AccessStep from './AccessStep.vue'
import CompanyStep from './CompanyStep.vue'
import FileStep from './FileStep.vue'
import FolderStep from './FolderStep.vue'
import HomeStep from './HomeStep.vue'
import MadeStep from './MadeStep.vue'
import StatementStep from './StatementStep.vue'
import WelcomeStep from './WelcomeStep.vue'
import { useCompanyFirstRun } from './useCompanyFirstRun'
import { useOnboarding } from './useOnboarding'
import { words } from './words'

/**
 * Onboarding at `#/company/start?step=…`, on the page of every first run, with the steps of the path in
 * a row over the step's card. The route holds the step, so a trip to Google comes back into it.
 * Back to the step that made the books of this run shows them made, so it never makes a second set.
 */
const onboarding = useOnboarding()
const { firstRun, steps } = useCompanyFirstRun()
const flow: StepFlow = {
  step: computed(() => onboarding.place.value.step),
  canGoBack: computed(() => previousStep(onboarding.place.value) !== null),
  back: () => void onboarding.back(),
}

const STEPS: Readonly<Record<Exclude<OnboardingStep, 'find'>, Component>> = {
  welcome: WelcomeStep,
  home: HomeStep,
  access: AccessStep,
  file: FileStep,
  folder: FolderStep,
  company: CompanyStep,
  statement: StatementStep,
}

const stepper = computed(() => onboarding.steps.value.map((step) => ({ step, title: words.stepTitles[step] })))
const component = computed(() => {
  const place = onboarding.place.value
  if (place.step === 'find') return null
  return onboarding.madeBooks.value !== null && place.step === makingStep(place) ? MadeStep : STEPS[place.step]
})

const privacyPage = `${import.meta.env.BASE_URL}privacy.html`
</script>

<template>
  <FirstRunPage :app-name="appWords.name" :lead="words.lead" :footer="words.footer" :flow="flow" :stepper="stepper">
    <component :is="component" v-if="component" :key="onboarding.place.value.step" />
    <FirstRunFindStep v-else :first-run="firstRun" :steps="steps" />
    <template #footer>
      <a :href="privacyPage" class="quiet-link inline-target">{{ words.privacy }}</a>
    </template>
  </FirstRunPage>
</template>
