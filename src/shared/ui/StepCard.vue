<script lang="ts">
import type { InjectionKey, Ref } from 'vue'

/** Where a first run stands, which its screen hands to the step cards it shows. */
export interface StepFlow {
  /** The step on screen, which the card names in `data-step`. */
  readonly step: Readonly<Ref<string>>
  readonly canGoBack: Readonly<Ref<boolean>>
  back(): void
}

export const STEP_FLOW: InjectionKey<StepFlow> = Symbol('step flow')
</script>

<script setup lang="ts">
import { inject } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import AppCard from './AppCard.vue'
import { words } from './words'

/** One step of a first run as one card: what it asks, then Back beside the step's buttons. The first step has no Back. */
defineProps<{
  title: string
  subtitle?: string | undefined
}>()

const flow = inject(STEP_FLOW)
if (flow === undefined) {
  throw new Error('A step card needs the screen of its first run to provide STEP_FLOW.')
}
</script>

<template>
  <AppCard :title="title" :subtitle="subtitle" tabindex="-1" class="outline-none" data-testid="onboarding-step" :data-step="flow.step.value">
    <div class="flex flex-col gap-5 px-4 pt-4 pb-5 sm:px-5">
      <slot />
      <div class="flex flex-wrap-reverse items-center justify-end gap-2 border-t border-default pt-4">
        <UButton v-if="flow.canGoBack.value" :label="words.back" icon="i-lucide-arrow-left" color="neutral" variant="ghost" class="me-auto" data-testid="onboarding-back" @click="flow.back()" />
        <slot name="actions" />
      </div>
    </div>
  </AppCard>
</template>
