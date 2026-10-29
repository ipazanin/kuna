<script setup lang="ts">
import { computed, nextTick, provide, watch } from 'vue'
import type { Component } from 'vue'

import { STEP_FLOW } from '../../../../shared/ui/StepCard.vue'
import FindStep from './FindStep.vue'
import FolderStep from './FolderStep.vue'
import HomeStep from './HomeStep.vue'
import { useLoansStart } from './useLoansStart'
import type { LoansStartStep } from './useLoansStart'

/** The Loans first run at `#/loans/start?step=…`, on the ruled page of a first run: where the file lives, then the folder or the find for a file on Drive. */
const start = useLoansStart()
provide(STEP_FLOW, { step: start.step, canGoBack: computed(() => start.step.value !== 'home'), back: () => void start.go('home') })

const STEPS: Readonly<Record<LoansStartStep, Component>> = { home: HomeStep, folder: FolderStep, find: FindStep }

// A new step takes focus, so a screen reader announces its card.
watch(
  () => start.step.value,
  () => void nextTick(() => document.querySelector<HTMLElement>('[data-testid="onboarding-step"]')?.focus()),
)

const step = computed(() => STEPS[start.step.value])
</script>

<template>
  <main class="first-run min-h-dvh">
    <div class="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
      <header class="flex flex-col gap-3">
        <h1 data-testid="screen-title" tabindex="-1" class="screen-title text-title font-semibold text-highlighted">Loans</h1>
        <p class="max-w-[52ch] text-base text-toned">Your loans, in a file of their own beside the company's books.</p>
      </header>
      <component :is="step" :key="start.step.value" />
      <footer class="text-xs text-muted">No server. The Loans file stays in your Google Drive, this browser and the files you export.</footer>
    </div>
  </main>
</template>

<style scoped>
/* The heading takes focus on arrival so a screen reader announces the screen. It is not a control, so it shows no ring. */
.screen-title:focus {
  outline: none;
}

/* Faint ruled lines, as on a ledger page, fading out further down, as the company's first run has. */
.first-run {
  background-color: var(--surface-page);
  background-image: linear-gradient(to bottom, transparent 0, var(--surface-page) 42rem), repeating-linear-gradient(to bottom, transparent 0 31px, var(--border-default) 31px 32px);
}
</style>
