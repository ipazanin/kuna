<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import AppCard from '../../../shared/ui/AppCard.vue'
import { previousStep } from '../domain/onboardingSteps'
import { useOnboarding } from './useOnboarding'

/** One step of onboarding as one card: what it asks, then Back beside the step's one primary button. */
defineProps<{
  title: string
  subtitle?: string | undefined
}>()

const onboarding = useOnboarding()
</script>

<template>
  <AppCard :title="title" :subtitle="subtitle" tabindex="-1" class="outline-none" data-testid="onboarding-step" :data-step="onboarding.place.value.step">
    <div class="flex flex-col gap-5 px-4 pt-4 pb-5 sm:px-5">
      <slot />
      <div class="step-actions flex flex-wrap-reverse items-center justify-end gap-2 pt-4">
        <UButton
          v-if="previousStep(onboarding.place.value) !== null"
          label="Back"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          class="me-auto"
          data-testid="onboarding-back"
          @click="onboarding.back()"
        />
        <slot name="actions" />
      </div>
    </div>
  </AppCard>
</template>

<style scoped>
.step-actions {
  border-top: 1px solid var(--border-default);
}
</style>
