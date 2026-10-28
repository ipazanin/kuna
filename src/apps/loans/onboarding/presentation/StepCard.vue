<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import { useLoansStart } from './useLoansStart'

/** One step of the Loans first run as one card: what it asks, then Back beside the step's buttons. The first step has no Back. */
defineProps<{
  title: string
  subtitle?: string | undefined
}>()

const start = useLoansStart()
</script>

<template>
  <AppCard :title="title" :subtitle="subtitle" tabindex="-1" class="outline-none" data-testid="loans-start-step" :data-step="start.step.value">
    <div class="flex flex-col gap-5 px-4 pt-4 pb-5 sm:px-5">
      <slot />
      <div class="step-actions flex flex-wrap-reverse items-center justify-end gap-2 pt-4">
        <UButton v-if="start.step.value !== 'home'" label="Back" icon="i-lucide-arrow-left" color="neutral" variant="ghost" class="me-auto" data-testid="loans-start-back" @click="start.go('home')" />
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
