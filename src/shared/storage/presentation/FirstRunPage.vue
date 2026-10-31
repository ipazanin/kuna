<script setup lang="ts">
import { computed, nextTick, provide, watch } from 'vue'

import { words as sharedWords } from '../../app/words'
import HomeLink from '../../ui/HomeLink.vue'
import { STEP_FLOW } from '../../ui/StepCard.vue'
import type { StepFlow } from '../../ui/StepCard.vue'
import { words } from './words'

/**
 * The ruled page of a first run: the app's name and lead, the step's card in the default slot, and the
 * footer, which the `footer` slot adds to. It hands `flow` to the step cards.
 */
const props = defineProps<{
  appName: string
  lead: string
  footer: string
  flow: StepFlow
  /** The steps of the path in order, numbered in a row over the card and named from 640 px. The row only shows where the person is, so it holds no buttons. */
  stepper?: readonly { readonly step: string; readonly title: string }[] | undefined
}>()

provide(STEP_FLOW, props.flow)

// A new step takes focus, so a screen reader announces its card.
watch(
  () => props.flow.step.value,
  () => void nextTick(() => document.querySelector<HTMLElement>('[data-testid="onboarding-step"]')?.focus()),
)

const marks = computed(() => {
  const steps = props.stepper ?? []
  const current = steps.findIndex((item) => item.step === props.flow.step.value)
  return steps.map((item, index) => ({ ...item, state: index < current ? 'done' : index === current ? 'current' : 'ahead' }))
})
</script>

<template>
  <main class="first-run min-h-dvh">
    <div class="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
      <header class="flex flex-col gap-3">
        <HomeLink :label="sharedWords.homeLink" look="quiet" class="self-start" />
        <h1 data-testid="screen-title" tabindex="-1" class="screen-title text-title font-semibold text-highlighted">{{ appName }}</h1>
        <p class="max-w-[52ch] text-base text-toned">{{ lead }}</p>
      </header>
      <ol v-if="marks.length" class="first-run-steps" :aria-label="words.firstRun.steps" data-testid="onboarding-stepper">
        <li v-for="(mark, index) in marks" :key="mark.step" class="first-run-step" :data-state="mark.state" :aria-current="mark.state === 'current' ? 'step' : undefined">
          <span class="first-run-step-mark figure" aria-hidden="true">{{ index + 1 }}</span>
          <span class="first-run-step-title" :class="{ 'max-sm:sr-only': mark.state !== 'current' }">{{ mark.title }}</span>
        </li>
      </ol>
      <slot />
      <footer class="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
        <span>{{ footer }}</span>
        <slot name="footer" />
      </footer>
    </div>
  </main>
</template>
